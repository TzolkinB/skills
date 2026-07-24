#!/usr/bin/env node
// Gate — the deterministic core of the Gate skill (Sentinel stage 7).
//
// Ingests the evidence a PR already produced (E2E execution evidence — a Playwright
// JSON report and/or a Cypress Module API result — plus an audit-test verdict, either a
// PARSED emission or an opaque Markdown report), binds it into one readable evidence
// bundle (in-toto-shaped Statements — DSSE-signed attestations when a key is supplied,
// ADR-0032/ADR-0037 §1; unsigned bundles stay "shaped, not signed" — over
// content-addressed subjects: the PR head commit plus a sha256 digest of each ingested
// input file, #139/ADR-0037 §2 — so swapping a report out from under the verdict changes
// its recorded digest), and derives a
// categorical, advisory release decision — `ship | canary | hold` — by worst-wins
// (ordinal min under hold < canary < ship).
// It appends its reasoning back into the bundle as a `gate.local/gate/v0` entry
// that shows its work, carries NO number anywhere, and NEVER fails the build
// (advisory / report-first).
//
// `ship` is reachable ONLY when Playwright PASSED and a PARSED audit-test verdict is
// execution-confirmed clean (`PASSED`+`confirmed`) — the B→A graduation (TzolkinB/skills#49)
// — AND the deep-audited fraction clears the examined-floor (default 50%, `--examined-floor`
// overridable down to a 25% minimum) — the coverage-aware ship gate (#127, ADR-0035): a
// confirmed-clean verdict that examined a minority of the suite is disclosed, not upgraded.
// An opaque or absent audit-test still caps credibility at `canary`, and a parsed run
// that examined nothing derives `unexamined` → also canary (theater guard).
//
// This is DETERMINISTIC CODE, not model judgment: the same bundle always yields
// the same decision (a release gate must be reproducible). The SKILL.md
// orchestrates by running it. Contract v0 = TzolkinB/skills#102; gate spec v0 =
// #103; parsed audit-test = #49 (ADR-0029). Zero external deps by design.
//
// Usage:
//   node gate.mjs (--playwright=<results.json> | --cypress=<cypress-results.json>) \
//                    [--audit-test-json=<tally.json>] [--audit-test=<report.md>] \
//                    [--examined-floor=<pct>] [--commit=<sha>] [--out=<bundle.json>] \
//                    [--sign-key=<private-key.pem>]   # ≥1 execution report; both allowed
//   node gate.mjs --gen-key=<path-prefix>              # writes <prefix>.pem + <prefix>.pub.pem
//   node gate.mjs --verify --bundle=<bundle.json> --pubkey=<public-key.pem>
//   node gate.mjs --self-test        # golden truth-table gate (deterministic)

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash, sign as cryptoSign, verify as cryptoVerify, createPrivateKey, createPublicKey, generateKeyPairSync } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));

// ---- constants (gate:// namespace everywhere — plugin-neutral, contract Q9) ----
const SCHEMA_VERSION = 'gate-evidence-bundle/v0.5'; // v0.1 = v0 (LOCKED, #102) + ADDITIVE `EMPTY` (#111, ADR-0031); v0.2 = witness:// -> gate:// internal rename (ADR-0033); v0.3 = proven -> confirmed taxonomy rename (#126, ADR-0034); v0.4 = ADDITIVE per-input sha256 subjects (#139, ADR-0037 §2); v0.5 = ADDITIVE optional DSSE envelope (#141, ADR-0037 §1)
const STATEMENT_TYPE = 'https://in-toto.io/Statement/v1';
const EVIDENCE_PREDICATE = 'https://gate.local/evidence/qa-stage/v0';
const GATE_PREDICATE = 'https://gate.local/gate/v0';
const DSSE_PAYLOAD_TYPE = 'application/vnd.in-toto+json'; // the in-toto JSON media type (ADR-0037 §1)
const RANK = { hold: 0, canary: 1, ship: 2 }; // worst-wins ordinal: hold < canary < ship
// Coverage-aware ship gate (#127, ADR-0035): a confirmed-clean audit-test verdict must ALSO
// clear this examined-fraction (deepAudited/audited) to reach `ship`, not just narrate it.
// `--examined-floor` overrides the default; never clamps below the minimum (never 0, never
// silently trusts a 1-of-500 deep-audit).
const EXAMINED_FLOOR_DEFAULT = 50;
const EXAMINED_FLOOR_MIN = 25;
// E2E frameworks that produce execution evidence on the same axis (result → proposal).
// Both feed the gate identically; worst-wins across all present (a green Playwright can't
// paper over a red Cypress). audit-test is the separate CREDIBILITY axis, not here.
const EXECUTION_STAGES = new Set(['playwright', 'cypress']);

// ---- ingest: Playwright (mechanical fact-restatement, contract v0) ----------

// 0 tests executed → EMPTY (an empty/unrun report is NOT a pass — #111); else
// stats.unexpected > 0 → FAILED; else stats.flaky > 0 → WARNED; else PASSED.
// `flaky` NEVER appears in `unexpected` — it must be read explicitly.
export function deriveResult(stats = {}) {
  const executed = Number(stats.expected ?? 0) + Number(stats.unexpected ?? 0) + Number(stats.flaky ?? 0);
  if (executed === 0) return 'EMPTY'; // `{}`, `{stats:{}}`, or all-skipped: nothing ran to a verdict
  if (Number(stats.unexpected ?? 0) > 0) return 'FAILED';
  if (Number(stats.flaky ?? 0) > 0) return 'WARNED';
  return 'PASSED';
}

export function playwrightEntry(report, { uri = 'test-results/results.json' } = {}) {
  const stats = report.stats ?? {};
  const metrics = ['expected', 'unexpected', 'flaky', 'skipped']
    .filter((n) => stats[n] !== undefined)
    .map((n) => ({ name: n, value: Number(stats[n]) }));
  return statement(EVIDENCE_PREDICATE, {
    stage: 'playwright',
    producer: { id: 'gate://playwright@1.x', startedOn: stats.startTime },
    verdict: { result: deriveResult(stats), metrics }, // raw counts only; NO confidence (Q6)
    byproducts: [{ name: 'playwright-json', uri, mediaType: 'application/json' }],
    annotations: {},
  });
}

// ---- ingest: Cypress (Module API CypressRunResult — mechanical fact-restatement) --
//
// Cypress's official aggregate result — what `cypress.run()` resolves to — is the analog
// of Playwright's JSON report, but with ONE load-bearing asymmetry: it has NO `flaky`
// count. A flaky test (failed an attempt, then passed on retry) ends up in `totalPassed`,
// its earlier failure preserved only in that test's `attempts[]`. So flake must be
// DERIVED by scanning per-test attempts — the exact check Cypress's own retries docs show
// (`_.some(test.attempts, {state:'failed'})`) — not read from a stats field. Verified
// against the Module API + test-retries docs (docs.cypress.io, 2026-07-17). Everything
// else parallels Playwright: hard failure dominates, a survived flake is surfaced not buried.

// A test is flaky iff it did NOT end failed but has ≥1 failed attempt (retried→passed).
// Scans runs[].tests[].attempts[] because there is no aggregate flaky count to read.
export function countCypressFlaky(result = {}) {
  let flaky = 0;
  for (const run of result.runs ?? []) {
    for (const t of run.tests ?? []) {
      if (t?.state !== 'failed' && (t?.attempts ?? []).some((a) => a?.state === 'failed')) flaky += 1;
    }
  }
  return flaky;
}

// 0 tests produced a pass/fail verdict → EMPTY (#111); else totalFailed>0 → FAILED; else any
// DERIVED flaky → WARNED; else PASSED. Same ordering as deriveResult (Playwright): an empty/unrun
// result is not a pass, a hard failure dominates a flake, and a survived flake is a WARN never
// folded into the greens.
export function deriveCypressResult(result = {}) {
  const executed = Number(result.totalPassed ?? 0) + Number(result.totalFailed ?? 0);
  if (executed === 0) return 'EMPTY'; // no test resolved to passed/failed (0 tests, or all pending/skipped)
  if (Number(result.totalFailed ?? 0) > 0) return 'FAILED';
  if (countCypressFlaky(result) > 0) return 'WARNED';
  return 'PASSED';
}

export function cypressEntry(result, { uri = 'cypress-results.json' } = {}) {
  const metrics = [
    ['totalTests', result.totalTests],
    ['totalPassed', result.totalPassed],
    ['totalFailed', result.totalFailed],
    ['totalPending', result.totalPending],
    ['totalSkipped', result.totalSkipped],
  ]
    .filter(([, v]) => v !== undefined)
    .map(([name, v]) => ({ name, value: Number(v) }));
  // `flaky` is DERIVED (Cypress emits no such count) — labelled so the bundle doesn't
  // imply the source reported it. Raw/derived counts only; NO confidence (Q6).
  metrics.push({ name: 'flakyDerived', value: countCypressFlaky(result) });
  return statement(EVIDENCE_PREDICATE, {
    stage: 'cypress',
    producer: { id: 'gate://cypress@1.x', startedOn: result.startedTestsAt },
    verdict: { result: deriveCypressResult(result), metrics },
    byproducts: [{ name: 'cypress-json', uri, mediaType: 'application/json' }],
    annotations: {},
  });
}

// ---- ingest: audit-test (opaque — no prose scraping; Markdown rides inline) --

export function auditTestEntry(markdown) {
  return statement(EVIDENCE_PREDICATE, {
    stage: 'audit-test',
    producer: { id: 'gate://audit-test@0.x' },
    verdict: {}, // opaque: no result/label/metrics parsed from prose (contract Q7)
    byproducts: [{ name: 'audit-test-report', mediaType: 'text/markdown', text: markdown }],
    annotations: {},
  });
}

// ---- ingest: audit-test (PARSED — the B→A graduation, TzolkinB/skills#49) -----
//
// `/audit-test --emit-json` writes its batch provenance tally as structured data
// (the per-class COUNTS — the model's judgment crystallised into numbers). Gate
// ingests those counts and DERIVES the category (result + label) mechanically —
// exactly as `deriveResult` restates Playwright's `stats`. The gate downstream
// reads only the derived CATEGORY, never these counts (honesty guard #1). Deriving
// the label HERE (not trusting a skill-supplied label) is what makes the theater
// guard structural: a run that deep-audited nothing derives `unexamined` → the gate
// floors it at canary, so a parsed-but-vacuous audit still cannot reach `ship`.
const AUDIT_EMISSION_SCHEMA = 'gate-audit-test/v0.3'; // exact match — the published schema pins `schema` to this const; v0.3 = ADDITIVE optional `runs[]` trace (#140/#142, ADR-0037 §3)
const AUDIT_COUNTS = ['audited', 'deepAudited', 'confirmedSolid', 'confirmedHollow', 'likelyHollow', 'baselineLock', 'unexamined'];

// Any confirmed-hollow test is a confirmed credibility FAILURE; a likely-hollow or a
// baseline-lock is a WARNING (short of proof / a caution); otherwise PASSED.
export function deriveAuditResult(t = {}) {
  if (Number(t.confirmedHollow ?? 0) > 0) return 'FAILED';
  if (Number(t.likelyHollow ?? 0) > 0 || Number(t.baselineLock ?? 0) > 0) return 'WARNED';
  return 'PASSED';
}

// Proof-grade of the roll-up: `confirmed` if any deep audit was EXECUTION-confirmed (a
// killed or a hollow mutation), `likely` if deep audits ran but only by reasoning
// (env not runnable), `unexamined` if nothing left triage. Only `PASSED`+`confirmed`
// unlocks `ship` — so an audit that examined nothing is never ship-eligible.
export function deriveAuditLabel(t = {}) {
  if (Number(t.confirmedSolid ?? 0) > 0 || Number(t.confirmedHollow ?? 0) > 0) return 'confirmed';
  if (Number(t.deepAudited ?? 0) > 0) return 'likely';
  return 'unexamined';
}

// Validate the emission's shape (a model produced it — never trust it blind). Returns
// a normalised tally object, or null if malformed so the caller can fall back to the
// opaque/absent canary floor rather than crash or silently upgrade.
export function parseAuditEmission(raw) {
  let obj;
  try {
    obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object') return null;
  // Exact schema version, not a prefix (#111): `startsWith('gate-audit-test/')` let a bogus
  // `gate-audit-test/v999` through; the published schema pins `schema` to a const.
  if (obj.schema !== AUDIT_EMISSION_SCHEMA) return null;
  const tally = {};
  for (const k of AUDIT_COUNTS) {
    const v = Number(obj[k] ?? 0);
    if (!Number.isFinite(v) || v < 0 || !Number.isInteger(v)) return null;
    tally[k] = v;
  }
  // Cross-field consistency (#111, tightened #155): reject an arithmetically impossible tally rather
  // than silently deriving `confirmed` from it. A model produced these counts, so
  // `{confirmedSolid:1, deepAudited:0}` must not slip through. These are the counts' own definitions,
  // not a trust/authenticity check:
  //   • every triaged test is either deep-audited or not →  audited === deepAudited + unexamined
  //   • every deep-audited test lands in EXACTLY one outcome class (🟢/🔴/🟡/⚠️, per audit-test
  //     Verdicts) →  Σ(outcomes) === deepAudited. This is `===`, not `≤` (#155/F1): the loose
  //     bound let `{deepAudited:100, confirmedSolid:1, rest:0}` derive `confirmed` from 99 deep
  //     audits with no recorded outcome. Equality forces every claimed deep audit to be accounted for.
  const outcomes = tally.confirmedSolid + tally.confirmedHollow + tally.likelyHollow + tally.baselineLock;
  if (tally.deepAudited + tally.unexamined !== tally.audited) return null;
  if (outcomes !== tally.deepAudited) return null;

  // Run trace (#142, B2, ADR-0037 §3) — OPTIONAL, additive: an emission with no `runs` is
  // unaffected (behaves exactly as v0.2). When present, it's a per-test record of an
  // EXECUTED mutation (killed|survived) and must agree with the tally it rides alongside —
  // a model wrote both, so a disagreement is treated exactly like an arithmetically-impossible
  // tally: the whole emission is rejected (never a silent upgrade; the caller degrades to the
  // opaque report or absence). `runs.length` must never exceed `deepAudited`, and each outcome's
  // record count must equal its matching count (killed→confirmedSolid, survived→confirmedHollow).
  // Two further internal-consistency checks (#155/F3):
  //   • outcome/exit-signal agreement — a `killed` record means the test FAILED as it should, so its
  //     process exitCode must be non-zero; a `survived` record means it stayed green, so exitCode
  //     must be 0. A `killed`+`exitCode:0` record is self-contradictory and rejected.
  //   • record uniqueness — a confirmed outcome maps to a DISTINCT test identity; four identical
  //     (test, mutation, command) records must not satisfy `killed === confirmedSolid:4`.
  if (obj.runs !== undefined) {
    if (!Array.isArray(obj.runs)) return null;
    const runs = [];
    const seen = new Set();
    for (const r of obj.runs) {
      if (!r || typeof r !== 'object') return null;
      if (typeof r.test !== 'string' || typeof r.mutation !== 'string' || typeof r.command !== 'string') return null;
      if (r.outcome !== 'killed' && r.outcome !== 'survived') return null;
      const exitCode = Number(r.exitCode);
      if (!Number.isFinite(exitCode) || !Number.isInteger(exitCode) || exitCode < 0) return null;
      if (r.outcome === 'killed' && exitCode === 0) return null; // failed-as-it-should ⇒ non-zero exit
      if (r.outcome === 'survived' && exitCode !== 0) return null; // stayed-green ⇒ exit 0
      const identity = JSON.stringify([r.test, r.mutation, r.command]);
      if (seen.has(identity)) return null; // duplicate (test, mutation, command) record
      seen.add(identity);
      runs.push({ test: r.test, mutation: r.mutation, command: r.command, outcome: r.outcome, exitCode });
    }
    if (runs.length > tally.deepAudited) return null;
    const killed = runs.filter((r) => r.outcome === 'killed').length;
    const survived = runs.filter((r) => r.outcome === 'survived').length;
    if (killed !== tally.confirmedSolid || survived !== tally.confirmedHollow) return null;
    tally.runs = runs;
  }
  return tally;
}

export function auditTestParsedEntry(tally, { markdown } = {}) {
  const metrics = AUDIT_COUNTS.map((n) => ({ name: n, value: Number(tally[n] ?? 0) }));
  // Run-trace count (#142, B2, ADR-0037 §3) — lives HERE, on the audit-test evidence entry's own
  // metrics, exactly where the counts it cross-checks against already live. Only added when a
  // trace rode along; the gate predicate never sees it (honesty guard #3 stays untouched).
  if (tally.runs) metrics.push({ name: 'runsVerified', value: tally.runs.length });
  const byproducts = markdown ? [{ name: 'audit-test-report', mediaType: 'text/markdown', text: markdown }] : [];
  return statement(EVIDENCE_PREDICATE, {
    stage: 'audit-test',
    producer: { id: 'gate://audit-test@0.x' },
    verdict: { result: deriveAuditResult(tally), label: deriveAuditLabel(tally), metrics },
    byproducts,
    annotations: {},
  });
}

function statement(predicateType, predicate) {
  return { _type: STATEMENT_TYPE, predicateType, subject: [], predicate };
}

// ---- content-address the inputs (#139, B1, ADR-0037 §2) --------------------
//
// Pure hashing over bytes the caller already has in hand — no file I/O here (that stays
// in the CLI wrapper, `main()`, so this is exercisable offline in the self-test). A sha256
// digest is a lowercase hex STRING and lives in the Statement's `subject`, never in the gate
// `predicate` — honesty guard #3 (`findNumbers` scans `predicate` only) is untouched.

export function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

// One subject per ingested input file, in the order given. Swap the bytes behind a `name`
// and its digest — and so its subject — changes; nothing else about the bundle notices on
// its own, which is exactly the point (the caller still has to re-gate to catch it).
export function inputSubjects(inputs = []) {
  return inputs.map(({ name, bytes }) => ({ name, digest: { sha256: sha256Hex(bytes) } }));
}

// ---- sign the gate Statement with a self-signed DSSE envelope (#141, A, ADR-0037 §1) ----
//
// Opt-in, additive, zero-dep (node:crypto's ed25519 support, no new package). Gate signs only
// the Statement IT produced — the bundle's content-addressed `subject[]` (pr-head + one sha256
// per ingested input, #139) plus its own `gate.local/gate/v0` predicate — never the ingested
// Playwright/Cypress/audit-test entries (signing those would falsely imply their producer
// vouched for them). Self-signed ed25519 proves INTEGRITY (not altered after signing) and
// CONTINUITY (same key across runs), never third-party IDENTITY — this is not Sigstore.
//
// Every function here is pure: it takes key material (a node:crypto KeyObject) and bytes/objects
// as arguments and never touches the filesystem, so the self-test exercises sign, verify, and
// keyid derivation entirely offline with in-memory keys. Key loading (reading PEM files) and key
// generation live in the CLI wrapper (`main()`), not here.

// DSSE pre-authentication encoding (PAE) — https://github.com/secure-systems-lab/dsse. The
// signature covers this framed encoding of (payloadType, payload), never the raw JSON bytes
// alone, so a payloadType confusion can't be used to reinterpret a signed payload.
function dssePae(payloadType, payloadBytes) {
  const typeBytes = Buffer.from(payloadType, 'utf8');
  return Buffer.concat([
    Buffer.from('DSSEv1 '),
    Buffer.from(`${typeBytes.length} `),
    typeBytes,
    Buffer.from(` ${payloadBytes.length} `),
    payloadBytes,
  ]);
}

// The gate Statement, in the textbook in-toto shape this ADR is built on: a predicate (the
// decision) asserted over named, content-addressed subjects (the exact bytes it ingested).
// Reconstructed fresh from a bundle + its gate entry so signing and verification always see
// the SAME shape — nothing is cached or trusted from an earlier run.
export function gateStatementPayload(bundle, gateEntry) {
  return { _type: STATEMENT_TYPE, predicateType: GATE_PREDICATE, subject: bundle.subject, predicate: gateEntry.predicate };
}

// `keyid` = sha256 of the public key (ADR-0037 §1) — a stable fingerprint independent of PEM
// formatting, derived from the canonical SPKI/DER encoding so the same key always yields the
// same id regardless of how it was loaded.
export function keyidFromPublicKey(publicKey) {
  return sha256Hex(publicKey.export({ type: 'spki', format: 'der' }));
}

// Sign an arbitrary JSON-serializable payload as a DSSE envelope. `privateKey` is a node:crypto
// ed25519 KeyObject (or a PEM/DER input `crypto.sign` accepts) — never read from disk here.
export function dsseSign(payload, privateKey) {
  const payloadBytes = Buffer.from(JSON.stringify(payload), 'utf8');
  const sig = cryptoSign(null, dssePae(DSSE_PAYLOAD_TYPE, payloadBytes), privateKey); // ed25519: algorithm arg is null
  const publicKey = createPublicKey(privateKey);
  return {
    payloadType: DSSE_PAYLOAD_TYPE,
    payload: payloadBytes.toString('base64'),
    signatures: [{ keyid: keyidFromPublicKey(publicKey), sig: sig.toString('base64') }],
  };
}

// Verify a DSSE envelope's signature against a public key. Checks ONLY that some signature in
// the envelope validates against these exact `payload` bytes under this exact key — it does not
// know whether `payload` still matches any particular bundle (that's `verifyGateBundle` below).
// A malformed envelope, an unknown payloadType, or a bad base64/signature all fail closed.
export function dsseVerify(envelope, publicKey) {
  if (!envelope || envelope.payloadType !== DSSE_PAYLOAD_TYPE || !Array.isArray(envelope.signatures)) return false;
  let payloadBytes;
  try {
    payloadBytes = Buffer.from(envelope.payload, 'base64');
  } catch {
    return false;
  }
  const pae = dssePae(envelope.payloadType, payloadBytes);
  return envelope.signatures.some((s) => {
    try {
      return cryptoVerify(null, pae, publicKey, Buffer.from(s.sig, 'base64'));
    } catch {
      return false;
    }
  });
}

// Sign a bundle's gate entry, producing the DSSE envelope to attach at `bundle.dsseEnvelope`.
export function signGateBundle(bundle, gateEntry, privateKey) {
  return dsseSign(gateStatementPayload(bundle, gateEntry), privateKey);
}

// Verify a (possibly tampered) bundle end to end: the envelope's signature must validate AND
// the payload it was signed over must still equal what the bundle currently says — so editing
// `bundle.subject` (swapping an input's recorded digest) or the gate entry's `predicate` (the
// decision, inputs, or rationale) AFTER signing, while leaving the old envelope in place, is
// caught here even though the envelope's own signature still checks out against its embedded
// (stale) payload.
//
// A valid result reports `attested` — the decision and the subject names the signature actually
// covers — because the envelope wraps ONLY the gate Statement (subject[] + gate predicate). The
// surrounding bundle fields — `producedOn`, `schemaVersion`, and the ingested Playwright/Cypress/
// audit-test evidence entries — are deliberately outside the signature (ADR-0037 §1: "Gate signs
// only what Gate produced"), so a caller must not read `valid` as "the whole file is authentic."
// NOTE: this checks the SIGNATURE, not the bundle's SHAPE — it binds to the first gate entry it
// finds, so callers verifying an untrusted bundle should `validateBundle` it first (the `--verify`
// CLI path does) to reject a structurally-malformed bundle (e.g. a duplicate gate entry).
export function verifyGateBundle(bundle, publicKey) {
  const envelope = bundle?.dsseEnvelope;
  if (!envelope) return { valid: false, reason: 'bundle is unsigned (no dsseEnvelope)' };
  if (!dsseVerify(envelope, publicKey)) return { valid: false, reason: 'signature invalid for the given public key' };
  const gateEntry = (bundle.entries ?? []).find((e) => e.predicate?.stage === 'gate');
  if (!gateEntry) return { valid: false, reason: 'bundle has no gate entry to check the signed payload against' };
  let signedPayload;
  try {
    signedPayload = JSON.parse(Buffer.from(envelope.payload, 'base64').toString('utf8'));
  } catch {
    return { valid: false, reason: 'envelope payload is not valid base64 JSON' };
  }
  const expected = gateStatementPayload(bundle, gateEntry);
  if (JSON.stringify(signedPayload) !== JSON.stringify(expected))
    return { valid: false, reason: 'signed payload no longer matches the bundle (tampered after signing)' };
  return {
    valid: true,
    keyid: keyidFromPublicKey(publicKey),
    attested: { decision: gateEntry.predicate?.decision, subjects: (bundle.subject ?? []).map((s) => s.name) },
  };
}

// ---- assemble --------------------------------------------------------------

// `inputs`: [{ name, bytes }] — the raw bytes of each ingested report/emission, read by the
// CLI wrapper. Retains the existing `pr-head` commit subject, then adds one content-addressed
// subject per input (#139) — additive, so a bundle with no inputs is identical to pre-#139.
export function assembleBundle({ commit, entries, producedOn, inputs = [] }) {
  return {
    schemaVersion: SCHEMA_VERSION,
    subject: [{ name: 'pr-head', digest: { gitCommit: commit ?? 'unknown' } }, ...inputSubjects(inputs)],
    producedOn: producedOn ?? new Date().toISOString(),
    entries,
  };
}

// ---- gate: worst-wins ordinal min (gate spec v0) ---------------------------

function auditMetricsOf(auditEntry) {
  return Object.fromEntries((auditEntry?.predicate?.verdict?.metrics ?? []).map((x) => [x.name, x.value]));
}

// Human-readable scope of an audit-test verdict, drawn from the evidence entry's own metrics
// (#112): `ship` proves only the DEEP-AUDITED subset, so the rationale/report must say how much
// of the suite that was and how much rode along `unexamined` (not evidence of health). Returns a
// plain string — the digits live in prose, never as a numeric field in the gate predicate.
function auditScope(auditEntry) {
  const m = auditMetricsOf(auditEntry);
  if (m.deepAudited === undefined || m.audited === undefined) return 'the deep-audited subset';
  return `the deep-audited subset (${m.deepAudited} of ${m.audited} triaged tests mutation-audited; ${m.unexamined ?? 0} unexamined — not evidence of health)`;
}

// Clamp a requested examined-floor into [EXAMINED_FLOOR_MIN, 100], defaulting when unset/invalid.
// A human CLI flag, not attacker-controlled model output — but still never trusted past the
// floor's own minimum, so `--examined-floor=0` can't reopen the 1-of-500 exploit (#127).
export function resolveExaminedFloor(requested) {
  if (requested === undefined || requested === null || requested === '') return EXAMINED_FLOOR_DEFAULT;
  const n = Number(requested);
  if (!Number.isFinite(n)) return EXAMINED_FLOOR_DEFAULT;
  return Math.min(100, Math.max(EXAMINED_FLOOR_MIN, n));
}

export function gate(bundle, { examinedFloor } = {}) {
  const floor = resolveExaminedFloor(examinedFloor);
  const entries = bundle.entries ?? [];
  const stageOf = (e) => e.predicate?.stage;
  const known = new Set([...EXECUTION_STAGES, 'audit-test', 'gate']);
  const execEntries = entries.filter((e) => EXECUTION_STAGES.has(stageOf(e)));
  const audit = entries.find((e) => stageOf(e) === 'audit-test');

  const inputs = [];
  const rationale = [];

  // Execution axis — every E2E result present (Playwright and/or Cypress) proposes on the
  // same scale: FAILED → hold, WARNED (flaky) → canary, PASSED → ship-baseline. Worst-wins
  // across them, so ship requires EVERY execution suite green; one red suite dominates.
  if (execEntries.length === 0) {
    inputs.push({ stage: 'execution', proposed: 'hold' });
    rationale.push('no execution evidence (no Playwright or Cypress report) → hold');
  } else {
    for (const e of execEntries) {
      const stage = stageOf(e);
      const result = e.predicate?.verdict?.result ?? 'FAILED';
      const proposed = result === 'FAILED' || result === 'EMPTY' ? 'hold' : result === 'WARNED' ? 'canary' : 'ship';
      inputs.push({ stage, result, proposed });
      rationale.push(
        result === 'FAILED'
          ? `${stage} FAILED → hold (execution failed — dominates)`
          : result === 'EMPTY'
            ? `${stage} produced no test results (empty/zero-test report) → hold (an unrun or empty report is not a pass — #111)`
            : result === 'WARNED'
              ? `${stage} WARNED (flaky) → canary (a trust defect, not buried under a note)`
              : `${stage} PASSED → ship-baseline`,
      );
    }
  }

  // Credibility axis. A PARSED audit-test verdict (result+label, both categories the
  // ingest derived) can propose `ship` — but ONLY when it is execution-confirmed clean
  // (`PASSED`+`confirmed`) AND the deep-audited fraction clears the examined-floor (#127,
  // ADR-0035); anything less proposes `canary`. An OPAQUE or ABSENT audit both floor at
  // `canary`, so there is no "run less, grade better" incentive and a bare green Playwright
  // run can never launder into `ship` (theater guard).
  const auditResult = audit?.predicate?.verdict?.result;
  if (audit && auditResult) {
    const label = audit.predicate.verdict.label;
    const confirmedClean = auditResult === 'PASSED' && label === 'confirmed';
    const m = auditMetricsOf(audit);
    const examinedPct = m.audited > 0 ? Math.round((m.deepAudited / m.audited) * 100) : 0;
    // Integer-domain comparison (deepAudited*100 vs floor*audited) — avoids float rounding
    // ever letting a borderline fraction slip past the floor it was just short of.
    const floorMet = confirmedClean && m.audited > 0 && m.deepAudited * 100 >= floor * m.audited;
    const proposed = confirmedClean && floorMet ? 'ship' : 'canary';
    inputs.push({ stage: 'audit-test', result: auditResult, label, proposed });
    rationale.push(
      proposed === 'ship'
        ? `audit-test PASSED + confirmed → ship-eligible — no hollow tests among ${auditScope(audit)} (${examinedPct}% examined, clears the ${floor}% examined-floor)`
        : confirmedClean
          ? `audit-test PASSED + confirmed but only ${examinedPct}% examined (${m.deepAudited} of ${m.audited} triaged tests) → canary (below the ${floor}% examined-floor — coverage-aware ship gate, #127)`
          : auditResult === 'FAILED'
            ? 'audit-test FAILED (confirmed false-confidence) → canary (a hollow test — fix it; not a red build)'
            : auditResult === 'WARNED'
              ? 'audit-test WARNED (likely-hollow / baseline-lock) → canary (credibility concern — a human must confirm)'
              : label === 'unexamined'
                ? 'audit-test PASSED but examined nothing (deep-audited 0) → canary (no proof of credibility — theater guard)'
                : 'audit-test PASSED but reasoning-only (env not runnable) → canary (short of execution proof)',
    );
  } else if (audit) {
    inputs.push({ stage: 'audit-test', opaque: true, proposed: 'canary' });
    rationale.push('audit-test present but opaque → floor at canary (human must read the report)');
  } else {
    inputs.push({ stage: 'audit-test', opaque: false, proposed: 'canary' });
    rationale.push('audit-test absent → floor at canary (no-credibility-evidence: trust unverified)');
  }

  // Unrecognized future stages: listed for transparency, ignored for the decision.
  for (const e of entries) {
    const s = stageOf(e);
    if (!known.has(s)) {
      inputs.push({ stage: s, ignored: true, proposed: null });
      rationale.push(`unrecognized stage \`${s}\` → ignored for decision (listed for transparency)`);
    }
  }

  const proposals = inputs.map((i) => i.proposed).filter((p) => p != null);
  const decision = proposals.reduce((worst, p) => (RANK[p] < RANK[worst] ? p : worst), 'ship');
  rationale.push(`worst-wins over {${[...new Set(proposals)].join(', ')}} → ${decision}`);

  const gateEntry = statement(GATE_PREDICATE, {
    stage: 'gate',
    producer: { id: 'gate://gate@0.x' },
    decision,
    inputs, // shows its work — the worst-wins arithmetic is reconstructable from the bundle
    rationale,
  });
  return { decision, gateEntry };
}

// ---- validation (honesty guard #3 — zero-dep, no JSON-Schema engine) --------

// The published contract is schema/evidence-bundle.v0.schema.json; this in-script
// check enforces its LOAD-BEARING constraint: the gate predicate carries NO
// numeric field anywhere, so a smuggled `confidence`/score is rejected and
// re-adding one forces a schemaVersion bump (the signal calibration has landed).
export function validateGateEntry(gateEntry) {
  const errors = [];
  const p = gateEntry?.predicate;
  if (!p) return ['gate entry has no predicate'];
  for (const req of ['stage', 'producer', 'decision', 'inputs', 'rationale'])
    if (p[req] === undefined) errors.push(`gate predicate missing required field: ${req}`);
  if (p.stage !== 'gate') errors.push(`gate predicate stage must be "gate", got ${JSON.stringify(p.stage)}`);
  if (!['ship', 'canary', 'hold'].includes(p.decision))
    errors.push(`gate decision must be ship|canary|hold, got ${JSON.stringify(p.decision)}`);
  const nums = findNumbers(p);
  if (nums.length)
    errors.push(`gate predicate carries numeric field(s) — forbidden in v0 (honesty guard #3): ${nums.join(', ')}`);
  return errors;
}

export function validateBundle(bundle) {
  const errors = [];
  if (bundle.schemaVersion !== SCHEMA_VERSION) errors.push(`schemaVersion must be "${SCHEMA_VERSION}"`);
  if (!Array.isArray(bundle.subject) || bundle.subject.length < 1) errors.push('bundle.subject must have ≥1 entry');
  if (!Array.isArray(bundle.entries)) errors.push('bundle.entries must be an array');
  const gates = (bundle.entries ?? []).filter((e) => e.predicate?.stage === 'gate');
  if (gates.length > 1) errors.push('exactly one gate entry is allowed per bundle');
  for (const g of gates) errors.push(...validateGateEntry(g));
  // Optional DSSE envelope (#141, ADR-0037 §1) — a bundle with none is unaffected (additive);
  // a present one gets a shape check only (a signature check needs a public key, which
  // `validateBundle` doesn't take — that's `verifyGateBundle`, given one explicitly).
  if (bundle.dsseEnvelope !== undefined) {
    const e = bundle.dsseEnvelope;
    if (e.payloadType !== DSSE_PAYLOAD_TYPE) errors.push(`dsseEnvelope.payloadType must be "${DSSE_PAYLOAD_TYPE}"`);
    if (typeof e.payload !== 'string') errors.push('dsseEnvelope.payload must be a base64 string');
    if (!Array.isArray(e.signatures) || e.signatures.length < 1) errors.push('dsseEnvelope.signatures must have ≥1 entry');
    for (const s of e.signatures ?? []) {
      if (typeof s.keyid !== 'string' || typeof s.sig !== 'string') errors.push('dsseEnvelope.signatures[] entries need string keyid + sig');
    }
  }
  return errors;
}

function findNumbers(value, path = 'predicate') {
  if (typeof value === 'number') return [path];
  if (Array.isArray(value)) return value.flatMap((v, i) => findNumbers(v, `${path}[${i}]`));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => findNumbers(v, `${path}.${k}`));
  return [];
}

// ---- report (terminal) -----------------------------------------------------

export function renderReport(bundle, gateEntry) {
  const d = gateEntry.predicate.decision;
  const icon = { ship: '🟢', canary: '🟡', hold: '🔴' }[d];
  const L = [];
  L.push(`## Gate decision: ${icon} ${d.toUpperCase()}  ·  advisory (did not fail the build)`);
  L.push('');
  L.push(`subject: pr-head \`${bundle.subject?.[0]?.digest?.gitCommit ?? 'unknown'}\`  ·  ${bundle.entries.length} entries`);
  // Signed status (#141, A, ADR-0037 §1) — say "signed" ONLY when a DSSE envelope is actually
  // present; the unsigned default keeps saying "shaped, not signed" (ADR-0032's hedge).
  L.push(
    bundle.dsseEnvelope
      ? `signed: ✓ DSSE (ed25519, self-signed) — keyid \`${bundle.dsseEnvelope.signatures?.[0]?.keyid ?? '?'}\``
      : 'signed: ✗ unsigned — in-toto-shaped, not a signed attestation (pass --sign-key to sign)',
  );
  // Content-addressed inputs (#139): one sha256 subject per ingested file, alongside pr-head.
  // Surfacing them is what lets a reader see the decision is bound to these exact bytes.
  const inputSubjectsList = (bundle.subject ?? []).filter((s) => s.name !== 'pr-head');
  if (inputSubjectsList.length) {
    L.push('');
    L.push('### Input digests (content-addressed — swap a file\'s bytes and this changes)');
    for (const s of inputSubjectsList) {
      const [algo, hex] = Object.entries(s.digest ?? {})[0] ?? [];
      L.push(`- \`${s.name}\` — ${algo}:${hex}`);
    }
  }
  L.push('');
  L.push('### Inputs — worst-wins (each input proposed a category)');
  for (const i of gateEntry.predicate.inputs) {
    const detail = i.ignored
      ? 'ignored (unrecognized stage)'
      : i.label // a PARSED audit-test verdict carries result + proof-grade label
        ? `${i.result} · ${i.label}`
        : i.result
          ? `result=${i.result}`
          : i.opaque
            ? 'present but opaque (unread)'
            : 'absent';
    L.push(`- \`${i.stage}\` — ${detail} → proposes **${i.proposed ?? '—'}**`);
  }
  L.push('');
  L.push('### Rationale');
  for (const r of gateEntry.predicate.rationale) L.push(`- ${r}`);
  L.push('');
  // `ship` is reachable now (the B→A graduation), but only via a parsed confirmed-clean
  // audit-test. An opaque/absent audit-test still caps credibility at `canary`.
  const audit = gateEntry.predicate.inputs.find((i) => i.stage === 'audit-test');
  const auditOpaqueOrAbsent = audit && !('label' in audit);
  // PASSED + confirmed + proposed canary is reachable only one way: confirmed-clean but the
  // deep-audited fraction fell short of the examined-floor (#127, ADR-0035).
  const belowExaminedFloor = audit?.result === 'PASSED' && audit?.label === 'confirmed' && audit?.proposed === 'canary';
  if (d === 'ship') {
    const execStages = gateEntry.predicate.inputs.filter((i) => EXECUTION_STAGES.has(i.stage)).map((i) => i.stage);
    const suites = execStages.join(' + ') || 'the E2E suite';
    const auditEv = bundle.entries.find((e) => e.predicate?.stage === 'audit-test');
    L.push(`> \`ship\` earned: ${suites} passed and \`audit-test\` found no hollow tests among ${auditScope(auditEv)}.`);
  } else if (belowExaminedFloor) {
    const auditEv = bundle.entries.find((e) => e.predicate?.stage === 'audit-test');
    L.push(`> \`ship\` needs a *confirmed-clean* \`audit-test\` verdict that also clears the examined-floor — this run found no hollow tests but only deep-audited ${auditScope(auditEv)}. Deep-audit more of the suite, or re-gate with a lower (but never below ${EXAMINED_FLOOR_MIN}%) \`--examined-floor\` if you consciously accept the narrower scope.`);
  } else if (auditOpaqueOrAbsent) {
    L.push('> `ship` needs a *parsed* confirmed-clean `audit-test` verdict to unlock — an opaque or absent `audit-test` caps credibility at `canary`. Run `/audit-test --emit-json=<path>` and pass it via `--audit-test-json` to raise the ceiling.');
  }
  L.push('> Advisory / report-first: a recommendation, not a build failure (blocking is a future opt-in, ADR-0026).');
  return L.join('\n');
}

// ---- CLI -------------------------------------------------------------------

function main(argv) {
  const flags = new Set(argv.filter((a) => a.startsWith('--') && !a.includes('=')));
  const opts = Object.fromEntries(
    argv.filter((a) => a.startsWith('--') && a.includes('=')).map((a) => a.slice(2).split(/=(.*)/s)),
  );

  if (flags.has('--self-test')) process.exit(runSelfTest() ? 0 : 1);

  // Key generation (#141, A, ADR-0037 §1) — a convenience the CLI wrapper owns; the core
  // sign/verify/keyid functions never generate or load keys themselves. ed25519, node:crypto,
  // zero new dependency. Writes PKCS8 private / SPKI public PEM, the formats `--sign-key` and
  // `--pubkey` read back in below.
  if (opts['gen-key']) {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const prefix = abs(opts['gen-key']);
    writeFileSync(`${prefix}.pem`, privateKey.export({ type: 'pkcs8', format: 'pem' }));
    writeFileSync(`${prefix}.pub.pem`, publicKey.export({ type: 'spki', format: 'pem' }));
    console.log(`Wrote ${prefix}.pem (private — keep secret, pass via --sign-key) and ${prefix}.pub.pem (public — share for --verify).`);
    console.log(`keyid: ${keyidFromPublicKey(publicKey)}`);
    process.exit(0);
  }

  // Verify an existing bundle against a public key (#141, A) — standalone, no execution report
  // needed. Self-signed ed25519 proves the bundle wasn't altered after Gate produced it and
  // continuity of the signing key; it does NOT prove third-party identity (not Sigstore).
  if (flags.has('--verify')) {
    if (!opts.bundle || !opts.pubkey) {
      console.error('usage: gate.mjs --verify --bundle=<gate-bundle.json> --pubkey=<public-key.pem>');
      process.exit(2);
    }
    const bundle = JSON.parse(readFileSync(abs(opts.bundle), 'utf8'));
    // Shape-validate before trusting the crypto result: verifyGateBundle binds to the FIRST gate
    // entry it finds, so a structurally-invalid bundle (e.g. a duplicate gate entry) could otherwise
    // report "✓ signature valid" despite failing the contract. Fail closed on a malformed bundle.
    const shapeErrors = validateBundle(bundle);
    if (shapeErrors.length) {
      console.error('✗ not a well-formed gate bundle (cannot vouch for a malformed bundle):\n' + shapeErrors.map((e) => '  - ' + e).join('\n'));
      process.exit(1);
    }
    const publicKey = createPublicKey(readFileSync(abs(opts.pubkey), 'utf8'));
    const result = verifyGateBundle(bundle, publicKey);
    if (result.valid) {
      console.log(`✓ signature valid — the gate decision \`${result.attested.decision}\` and its ${result.attested.subjects.length} content-addressed subject(s) are unaltered since signing (keyid ${result.keyid}).`);
      console.log('  scope: the signature covers the gate Statement only — producedOn, schemaVersion, and the ingested evidence entries are outside it (ADR-0037 §1).');
    } else {
      console.log(`✗ verification failed: ${result.reason}`);
    }
    process.exit(result.valid ? 0 : 1);
  }

  const hasExec = opts.playwright || opts.cypress;
  if (flags.has('--help') || !hasExec) {
    console.log('usage: gate.mjs (--playwright=<results.json> | --cypress=<cypress-results.json>)  # ≥1 required, both allowed');
    console.log('                   [--audit-test-json=<tally.json>] [--audit-test=<report.md>] [--commit=<sha>] [--out=<bundle.json>]');
    console.log(`                   [--examined-floor=<pct>]  # default ${EXAMINED_FLOOR_DEFAULT}, clamped to a ${EXAMINED_FLOOR_MIN} minimum`);
    console.log('                   [--sign-key=<private-key.pem>]  # opt-in DSSE signing (ed25519) — unsigned by default');
    console.log('       gate.mjs --gen-key=<path-prefix>              # writes <prefix>.pem + <prefix>.pub.pem');
    console.log('       gate.mjs --verify --bundle=<bundle.json> --pubkey=<public-key.pem>');
    console.log('       gate.mjs --self-test');
    process.exit(hasExec ? 0 : 2);
  }

  // Execution evidence: Playwright JSON report and/or Cypress Module API result. At least
  // one is required; both may be present (worst-wins across them in the gate). Raw bytes are
  // kept alongside the parsed form so they can be content-addressed into the bundle's
  // subjects (#139) — the hashing itself is pure (`inputSubjects`), only the read is here.
  const entries = [];
  const inputs = [];
  if (opts.playwright) {
    const { raw, parsed } = readJsonInputForCli(opts.playwright);
    entries.push(playwrightEntry(parsed, { uri: opts.playwright }));
    inputs.push({ name: 'playwright-json', bytes: raw });
  }
  if (opts.cypress) {
    const { raw, parsed } = readJsonInputForCli(opts.cypress);
    entries.push(cypressEntry(parsed, { uri: opts.cypress }));
    inputs.push({ name: 'cypress-json', bytes: raw });
  }

  // Credibility evidence: prefer a PARSED audit-test emission (can unlock `ship`);
  // fall back to the OPAQUE Markdown report (floors at canary). A malformed emission
  // degrades to opaque-if-md-else-absent — never crash, never silently upgrade. Only
  // bytes that actually made it into an entry are content-addressed — a rejected,
  // never-ingested emission contributes no subject.
  const md = opts['audit-test'] ? readFileSync(abs(opts['audit-test']), 'utf8') : undefined;
  const auditJsonRaw = opts['audit-test-json'] ? readFileSync(abs(opts['audit-test-json']), 'utf8') : undefined;
  const tally = auditJsonRaw ? parseAuditEmission(auditJsonRaw) : null;
  if (auditJsonRaw && !tally)
    console.error(`⚠ --audit-test-json is not a valid gate-audit-test emission — ignoring it (falling back to ${md ? 'the opaque report' : 'no credibility evidence'}).`);
  if (tally) {
    entries.push(auditTestParsedEntry(tally, { markdown: md }));
    inputs.push({ name: 'audit-test-json', bytes: auditJsonRaw });
    if (md) inputs.push({ name: 'audit-test-report', bytes: md });
  } else if (md) {
    entries.push(auditTestEntry(md));
    inputs.push({ name: 'audit-test-report', bytes: md });
  }

  // Coverage-aware ship gate (#127, ADR-0035): disclose when a requested floor gets clamped,
  // the same "never silently trust it" treatment as a malformed --audit-test-json.
  const examinedFloor = resolveExaminedFloor(opts['examined-floor']);
  if (opts['examined-floor'] !== undefined && Number(opts['examined-floor']) !== examinedFloor)
    console.error(`⚠ --examined-floor=${opts['examined-floor']} is invalid or below the ${EXAMINED_FLOOR_MIN}% minimum — using ${examinedFloor}%.`);

  const bundle = assembleBundle({ commit: opts.commit, entries, inputs });
  const { gateEntry } = gate(bundle, { examinedFloor });
  bundle.entries.push(gateEntry);

  const errors = validateBundle(bundle);
  if (errors.length) {
    console.error('✗ bundle failed validation:\n' + errors.map((e) => '  - ' + e).join('\n'));
    process.exit(1); // a malformed bundle is a real defect, not an advisory decision
  }

  // Opt-in DSSE signing (#141, A, ADR-0037 §1) — strictly additive: with no --sign-key the
  // bundle is byte-for-byte the same unsigned shape as before this capability landed. Only the
  // CLI wrapper reads the key file; signing itself (`signGateBundle`) is pure.
  if (opts['sign-key']) {
    const privateKey = createPrivateKey(readFileSync(abs(opts['sign-key']), 'utf8'));
    bundle.dsseEnvelope = signGateBundle(bundle, gateEntry, privateKey);
    // keyid already lives on the envelope signGateBundle just produced — read it back rather than
    // re-deriving it from the public key a second time.
    console.log(`✓ signed (keyid ${bundle.dsseEnvelope.signatures[0].keyid})`);
  }

  const out = opts.out ?? 'gate-bundle.json';
  writeFileSync(abs(out), JSON.stringify(bundle, null, 2) + '\n');
  console.log(renderReport(bundle, gateEntry));
  console.log(`\nBundle written to ${out}`);
  process.exit(0); // advisory — the decision NEVER fails the build (Q1)
}

function abs(p) {
  return isAbsolute(p) ? p : resolve(process.cwd(), p);
}

// Reads a JSON input file once, keeping the raw bytes alongside the parsed form — the raw
// bytes are what gets content-addressed (#139), the parsed form is what gets ingested. The
// `ForCli` suffix marks this as the CLI wrapper's own I/O helper: the file-read invariant
// (all filesystem access stays with `main()`, never in the pure core) holds by name here.
function readJsonInputForCli(path) {
  const raw = readFileSync(abs(path), 'utf8');
  return { raw, parsed: JSON.parse(raw) };
}

// ---- golden truth-table self-test (deterministic, offline, zero-dep) -------

function runSelfTest() {
  const R = [];
  const check = (name, cond) => R.push({ name, ok: !!cond });

  // deriveResult
  check('deriveResult: unexpected>0 → FAILED', deriveResult({ expected: 8, unexpected: 2, flaky: 0 }) === 'FAILED');
  check('deriveResult: flaky>0 → WARNED (read explicitly)', deriveResult({ expected: 10, unexpected: 0, flaky: 1 }) === 'WARNED');
  check('deriveResult: clean run → PASSED', deriveResult({ expected: 12, unexpected: 0, flaky: 0 }) === 'PASSED');
  check('deriveResult: flaky not masked by expected count', deriveResult({ expected: 10, unexpected: 0, flaky: 3 }) === 'WARNED');
  // #111 — an empty / unrun / all-skipped report is NOT a pass
  check('deriveResult: empty {} → EMPTY (unrun report is not a pass)', deriveResult({}) === 'EMPTY');
  check('deriveResult: all-skipped (0 executed) → EMPTY', deriveResult({ expected: 0, unexpected: 0, flaky: 0, skipped: 5 }) === 'EMPTY');

  const mkPw = (result) =>
    playwrightEntry({
      stats: {
        FAILED: { expected: 8, unexpected: 2, flaky: 0, skipped: 1 },
        WARNED: { expected: 11, unexpected: 0, flaky: 1, skipped: 0 },
        PASSED: { expected: 12, unexpected: 0, flaky: 0, skipped: 0 },
      }[result],
    });
  const bundleOf = (pw, audit) =>
    assembleBundle({
      commit: 'deadbeef',
      entries: [...(pw ? [mkPw(pw)] : []), ...(audit ? [auditTestEntry('# audit-test\n(opaque)')] : [])],
    });
  const decide = (pw, audit) => gate(bundleOf(pw, audit)).decision;

  // Truth table — OPAQUE / ABSENT audit-test (credibility caps at canary; ship unreachable here)
  check('FAILED + opaque-audit → hold', decide('FAILED', true) === 'hold');
  check('FAILED + no-audit → hold', decide('FAILED', false) === 'hold');
  check('PASSED + opaque-audit → canary (human-must-read)', decide('PASSED', true) === 'canary');
  check('PASSED + no-audit → canary (no-credibility-evidence)', decide('PASSED', false) === 'canary');
  check('WARNED + opaque-audit → canary', decide('WARNED', true) === 'canary');
  check('WARNED + no-audit → canary', decide('WARNED', false) === 'canary');
  check('no-playwright entry → hold', decide(null, true) === 'hold');
  check('empty bundle → hold', gate(assembleBundle({ commit: 'x', entries: [] })).decision === 'hold');

  // ---- PARSED audit-test (the B→A graduation) — derivation is a mechanical restatement
  // `confirmedClean` clears the default 50% examined-floor (4 of 8 = 50%, #127/ADR-0035);
  // `confirmedBelowFloor` is the ISSUE'S OWN EXAMPLE (4 of 12 = 33%, was ship-eligible pre-#127).
  const T = {
    confirmedClean:      { audited: 8,  deepAudited: 4, confirmedSolid: 4, confirmedHollow: 0, likelyHollow: 0, baselineLock: 0, unexamined: 4 },
    confirmedBelowFloor: { audited: 12, deepAudited: 4, confirmedSolid: 4, confirmedHollow: 0, likelyHollow: 0, baselineLock: 0, unexamined: 8 },
    confirmedVeryLow:    { audited: 20, deepAudited: 2, confirmedSolid: 2, confirmedHollow: 0, likelyHollow: 0, baselineLock: 0, unexamined: 18 },
    confirmedHollow:     { audited: 12, deepAudited: 4, confirmedSolid: 3, confirmedHollow: 1, likelyHollow: 0, baselineLock: 0, unexamined: 8 },
    likely:              { audited: 12, deepAudited: 2, confirmedSolid: 1, confirmedHollow: 0, likelyHollow: 1, baselineLock: 0, unexamined: 10 },
    baselineLock:        { audited: 12, deepAudited: 2, confirmedSolid: 1, confirmedHollow: 0, likelyHollow: 0, baselineLock: 1, unexamined: 10 },
    examinedNothing:     { audited: 12, deepAudited: 0, confirmedSolid: 0, confirmedHollow: 0, likelyHollow: 0, baselineLock: 0, unexamined: 12 },
    inconclusive:        { audited: 0,  deepAudited: 0, confirmedSolid: 0, confirmedHollow: 0, likelyHollow: 0, baselineLock: 0, unexamined: 0 },
  };
  check('deriveAuditResult: confirmedHollow>0 → FAILED', deriveAuditResult(T.confirmedHollow) === 'FAILED');
  check('deriveAuditResult: likelyHollow>0 → WARNED', deriveAuditResult(T.likely) === 'WARNED');
  check('deriveAuditResult: baselineLock>0 → WARNED', deriveAuditResult(T.baselineLock) === 'WARNED');
  check('deriveAuditResult: clean → PASSED', deriveAuditResult(T.confirmedClean) === 'PASSED');
  check('deriveAuditLabel: confirmed-solid → confirmed', deriveAuditLabel(T.confirmedClean) === 'confirmed');
  check('deriveAuditLabel: confirmed-hollow is still execution-confirmed', deriveAuditLabel(T.confirmedHollow) === 'confirmed');
  check('deriveAuditLabel: examined nothing → unexamined', deriveAuditLabel(T.examinedNothing) === 'unexamined');

  const decideP = (pw, tally) =>
    gate(assembleBundle({ commit: 'deadbeef', entries: [...(pw ? [mkPw(pw)] : []), auditTestParsedEntry(tally)] })).decision;

  check('PASSED + parsed confirmed-clean → ship (THE UNLOCK)', decideP('PASSED', T.confirmedClean) === 'ship');
  check('WARNED + parsed confirmed-clean → canary (worst-wins)', decideP('WARNED', T.confirmedClean) === 'canary');
  check('FAILED + parsed confirmed-clean → hold (worst-wins)', decideP('FAILED', T.confirmedClean) === 'hold');
  check('PASSED + parsed confirmed-HOLLOW → canary (fix the test, not a red build)', decideP('PASSED', T.confirmedHollow) === 'canary');
  check('PASSED + parsed WARNED(likely) → canary', decideP('PASSED', T.likely) === 'canary');
  check('PASSED + parsed WARNED(baseline-lock) → canary', decideP('PASSED', T.baselineLock) === 'canary');
  check('PASSED + parsed examined-nothing → canary (THEATER GUARD)', decideP('PASSED', T.examinedNothing) === 'canary');
  check('PASSED + parsed inconclusive → canary', decideP('PASSED', T.inconclusive) === 'canary');

  // ship-reachability invariant — ship IFF playwright PASSED AND parsed PASSED+confirmed
  const shipElsewhere = [
    decideP('WARNED', T.confirmedClean), decideP('FAILED', T.confirmedClean),
    decideP('PASSED', T.confirmedHollow), decideP('PASSED', T.likely), decideP('PASSED', T.baselineLock),
    decideP('PASSED', T.examinedNothing), decideP('PASSED', T.inconclusive),
    decide('PASSED', true), decide('PASSED', false), // opaque + absent never ship
  ];
  check('ship reachable ONLY via playwright PASSED + parsed confirmed-clean', decideP('PASSED', T.confirmedClean) === 'ship' && !shipElsewhere.includes('ship'));

  // ---- coverage-aware ship gate (#127, ADR-0035): confirmed-clean alone is not enough —
  // the deep-audited fraction must also clear the examined-floor (default 50%, min 25%).
  const decideF = (pw, tally, floorOpts) =>
    gate(assembleBundle({ commit: 'deadbeef', entries: [...(pw ? [mkPw(pw)] : []), auditTestParsedEntry(tally)] }), floorOpts).decision;

  check('deriveAuditLabel: confirmed-clean at 33% examined is still proof-grade "confirmed" (unaffected by the floor)',
    deriveAuditLabel(T.confirmedBelowFloor) === 'confirmed');
  check('resolveExaminedFloor: default when unset', resolveExaminedFloor(undefined) === EXAMINED_FLOOR_DEFAULT);
  check('resolveExaminedFloor: clamps below the 25% minimum', resolveExaminedFloor(10) === EXAMINED_FLOOR_MIN);
  check('resolveExaminedFloor: clamps above 100', resolveExaminedFloor(150) === 100);
  check('resolveExaminedFloor: passes a valid override through', resolveExaminedFloor(30) === 30);
  check('resolveExaminedFloor: invalid input falls back to default', resolveExaminedFloor('not-a-number') === EXAMINED_FLOOR_DEFAULT);

  check('PASSED + parsed confirmed-clean at default 50% examined-floor → ship', decideF('PASSED', T.confirmedClean) === 'ship');
  check("PASSED + parsed confirmed-clean at issue #127's own 33%-examined example → canary (THE FIX — was ship pre-#127)",
    decideF('PASSED', T.confirmedBelowFloor) === 'canary');
  check('override: lowering the floor to 25% lets the 33%-examined example ship (a conscious, disclosed choice)',
    decideF('PASSED', T.confirmedBelowFloor, { examinedFloor: 25 }) === 'ship');
  check('override: requesting a 10% floor is clamped to the 25% minimum — a 10%-examined run still cannot ship',
    decideF('PASSED', T.confirmedVeryLow, { examinedFloor: 10 }) === 'canary');
  check('override: a 30% floor still blocks the same 10%-examined run', decideF('PASSED', T.confirmedVeryLow, { examinedFloor: 30 }) === 'canary');
  check('a run at exactly the floor (50%) ships — inclusive boundary', decideF('PASSED', T.confirmedClean, { examinedFloor: 50 }) === 'ship');

  const belowFloorBundle = assembleBundle({ commit: 'x', entries: [mkPw('PASSED'), auditTestParsedEntry(T.confirmedBelowFloor)] });
  const belowFloorGate = gate(belowFloorBundle);
  belowFloorBundle.entries.push(belowFloorGate.gateEntry);
  const belowFloorReport = renderReport(belowFloorBundle, belowFloorGate.gateEntry);
  check('below-floor report names the examined-floor and #127 in its rationale', /examined-floor/.test(belowFloorReport) && /#127/.test(belowFloorReport));
  check('below-floor report carries no manufactured number outside prose', !/\bconfidence\b\s*[:=]\s*\d/i.test(belowFloorReport));

  // #111 — empty/impossible evidence can never ship (the two disclosed exploits, defeated)
  const emptyPw = playwrightEntry({}); // `{}` → EMPTY
  check('empty Playwright report alone → hold (not a pass)', gate(assembleBundle({ commit: 'x', entries: [emptyPw] })).decision === 'hold');
  check('exploit: empty {} Playwright + parsed confirmed-clean → hold (empty exec dominates, never ship)',
    gate(assembleBundle({ commit: 'x', entries: [emptyPw, auditTestParsedEntry(T.confirmedClean)] })).decision === 'hold');
  check('exploit: impossible {confirmedSolid:1,deepAudited:0} emission is rejected (never derives confirmed)',
    parseAuditEmission(JSON.stringify({ schema: AUDIT_EMISSION_SCHEMA, audited: 0, deepAudited: 0, confirmedSolid: 1, confirmedHollow: 0, likelyHollow: 0, baselineLock: 0, unexamined: 0 })) === null);

  // ---- Cypress ingest — same execution axis as Playwright, but flake is DERIVED --------
  const CY = {
    passed: { totalTests: 12, totalPassed: 12, totalFailed: 0, totalPending: 0, totalSkipped: 0,
      runs: [{ tests: [{ state: 'passed', attempts: [{ state: 'passed' }] }] }] },
    failed: { totalTests: 12, totalPassed: 10, totalFailed: 2, totalPending: 0, totalSkipped: 0,
      runs: [{ tests: [{ state: 'failed', attempts: [{ state: 'failed' }, { state: 'failed' }] }] }] },
    flaky: { totalTests: 12, totalPassed: 12, totalFailed: 0, totalPending: 0, totalSkipped: 0,
      runs: [{ tests: [{ state: 'passed', attempts: [{ state: 'failed' }, { state: 'passed' }] }] }] },
    // ended failed AND had failed attempts → a FAILURE, never a flake (guards the derive rule)
    hardFailRetried: { totalTests: 1, totalPassed: 0, totalFailed: 1,
      runs: [{ tests: [{ state: 'failed', attempts: [{ state: 'failed' }, { state: 'failed' }] }] }] },
  };
  check('deriveCypressResult: totalFailed>0 → FAILED', deriveCypressResult(CY.failed) === 'FAILED');
  check('deriveCypressResult: derived flaky → WARNED', deriveCypressResult(CY.flaky) === 'WARNED');
  check('deriveCypressResult: clean → PASSED', deriveCypressResult(CY.passed) === 'PASSED');
  check('deriveCypressResult: no pass/fail verdict → EMPTY (#111)', deriveCypressResult({ totalTests: 0, totalPassed: 0, totalFailed: 0 }) === 'EMPTY');
  check('deriveCypressResult: only pending → EMPTY (#111)', deriveCypressResult({ totalPending: 3, totalPassed: 0, totalFailed: 0 }) === 'EMPTY');
  check('countCypressFlaky: retried-then-passed counts as flaky', countCypressFlaky(CY.flaky) === 1);
  check('countCypressFlaky: clean pass is not flaky', countCypressFlaky(CY.passed) === 0);
  check('countCypressFlaky: a test that ENDED failed is a failure, not a flake', countCypressFlaky(CY.hardFailRetried) === 0);
  check('cypressEntry: derived verdict lands on the entry', cypressEntry(CY.flaky).predicate.verdict.result === 'WARNED');
  check('cypressEntry: flaky metric is labelled DERIVED (Cypress emits no such count)',
    cypressEntry(CY.flaky).predicate.verdict.metrics.some((m) => m.name === 'flakyDerived' && m.value === 1));

  const bundleWith = (entries) => assembleBundle({ commit: 'deadbeef', entries });
  const mkCy = (kind) => cypressEntry(CY[kind]);
  const decideCy = (kind, tally) => gate(bundleWith([mkCy(kind), auditTestParsedEntry(tally)])).decision;

  // Cypress alone on the execution axis behaves exactly like Playwright
  check('cypress PASSED + parsed confirmed-clean → ship', decideCy('passed', T.confirmedClean) === 'ship');
  check('cypress WARNED(flaky) + parsed confirmed-clean → canary', decideCy('flaky', T.confirmedClean) === 'canary');
  check('cypress FAILED + parsed confirmed-clean → hold', decideCy('failed', T.confirmedClean) === 'hold');
  check('cypress PASSED + opaque audit → canary', gate(bundleWith([mkCy('passed'), auditTestEntry('# opaque')])).decision === 'canary');
  check('cypress-only, no audit → canary (credibility floor still applies)', gate(bundleWith([mkCy('passed')])).decision === 'canary');

  // Both frameworks present — worst-wins across execution suites (a green PW can't hide a red CY)
  check('playwright PASSED + cypress FAILED → hold (worst-wins across suites)', gate(bundleWith([mkPw('PASSED'), mkCy('failed'), auditTestParsedEntry(T.confirmedClean)])).decision === 'hold');
  check('playwright PASSED + cypress WARNED → canary', gate(bundleWith([mkPw('PASSED'), mkCy('flaky'), auditTestParsedEntry(T.confirmedClean)])).decision === 'canary');
  check('playwright PASSED + cypress PASSED + parsed confirmed → ship (both suites green)', gate(bundleWith([mkPw('PASSED'), mkCy('passed'), auditTestParsedEntry(T.confirmedClean)])).decision === 'ship');
  check('ship unreachable while ANY execution suite is not green', gate(bundleWith([mkPw('PASSED'), mkCy('failed'), auditTestParsedEntry(T.confirmedClean)])).decision !== 'ship');

  // end-to-end from Cypress fixture files → bundle → gate → full-bundle validation
  const cyPassed = JSON.parse(readFileSync(resolve(HERE, 'fixtures/cypress.passed.json'), 'utf8'));
  const cyFlaky = JSON.parse(readFileSync(resolve(HERE, 'fixtures/cypress.flaky.json'), 'utf8'));
  const cyFailed = JSON.parse(readFileSync(resolve(HERE, 'fixtures/cypress.failed.json'), 'utf8'));
  check('fixture: cypress.passed.json → PASSED', deriveCypressResult(cyPassed) === 'PASSED');
  check('fixture: cypress.flaky.json → WARNED (a real failed attempt, derived)', deriveCypressResult(cyFlaky) === 'WARNED' && countCypressFlaky(cyFlaky) === 1);
  check('fixture: cypress.failed.json → FAILED', deriveCypressResult(cyFailed) === 'FAILED');
  const cyShip = bundleWith([cypressEntry(cyPassed), auditTestParsedEntry(T.confirmedClean)]);
  const gCyShip = gate(cyShip);
  cyShip.entries.push(gCyShip.gateEntry);
  check('fixture e2e: cypress PASSED + parsed confirmed-clean → ship', gCyShip.decision === 'ship');
  check('fixture e2e: cypress ship bundle validates', validateBundle(cyShip).length === 0);
  check('fixture e2e: cypress ship report names the suite', /cypress/i.test(renderReport(cyShip, gCyShip.gateEntry)));

  // ---- content-addressed inputs (#139, B1, ADR-0037 §2) — sha256 into the gate Statement subject
  check('sha256Hex: known bytes → known digest', sha256Hex('hello') === '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  check('sha256Hex: digest is lowercase hex', /^[0-9a-f]{64}$/.test(sha256Hex('anything')));

  const twoSubjects = inputSubjects([{ name: 'playwright-json', bytes: '{}' }, { name: 'audit-test-report', bytes: '# md' }]);
  check('inputSubjects: one subject per input, in order', twoSubjects.length === 2 && twoSubjects[0].name === 'playwright-json' && twoSubjects[1].name === 'audit-test-report');
  check('inputSubjects: no inputs → no subjects', inputSubjects([]).length === 0);

  const [digestBefore] = inputSubjects([{ name: 'playwright-json', bytes: '{"a":1}' }]);
  const [digestAfter] = inputSubjects([{ name: 'playwright-json', bytes: '{"a":2}' }]);
  check('inputSubjects: swap-changes-digest (different bytes → different digest, same name)', digestBefore.digest.sha256 !== digestAfter.digest.sha256);

  const withInputs = assembleBundle({ commit: 'deadbeef', entries: [], inputs: [{ name: 'playwright-json', bytes: '{}' }, { name: 'audit-test-json', bytes: '{}' }] });
  check('assembleBundle: pr-head subject retained, then one subject per input', withInputs.subject.length === 3 && withInputs.subject[0].name === 'pr-head'
    && withInputs.subject[0].digest.gitCommit === 'deadbeef' && withInputs.subject[1].name === 'playwright-json' && withInputs.subject[2].name === 'audit-test-json');
  check('assembleBundle: no inputs → pr-head-only subject (pre-#139 shape, unchanged)', assembleBundle({ commit: 'x', entries: [] }).subject.length === 1);

  const bundleBeforeSwap = assembleBundle({ commit: 'x', entries: [], inputs: [{ name: 'playwright-json', bytes: 'original bytes' }] });
  const bundleAfterSwap = assembleBundle({ commit: 'x', entries: [], inputs: [{ name: 'playwright-json', bytes: 'tampered bytes' }] });
  check('assembleBundle: swap-changes-digest at the bundle level', bundleBeforeSwap.subject[1].digest.sha256 !== bundleAfterSwap.subject[1].digest.sha256);

  const digestBundle = assembleBundle({ commit: 'deadbeef', entries: [mkPw('PASSED'), auditTestParsedEntry(T.confirmedClean)], inputs: [{ name: 'playwright-json', bytes: 'fixture bytes' }] });
  const digestGate = gate(digestBundle);
  check("digest subjects are strings, not numbers — validateGateEntry's honesty guard #3 is unaffected",
    validateGateEntry(digestGate.gateEntry).length === 0 && typeof digestBundle.subject[1].digest.sha256 === 'string');
  digestBundle.entries.push(digestGate.gateEntry);
  const digestReport = renderReport(digestBundle, digestGate.gateEntry);
  check('report surfaces the input digest (or its presence) alongside pr-head', /playwright-json/.test(digestReport) && /sha256:[0-9a-f]{64}/.test(digestReport));

  const noInputsBundle = bundleOf('PASSED', true);
  const noInputsGate = gate(noInputsBundle);
  check('report with no inputs carries no "Input digests" section', !/Input digests/.test(renderReport(noInputsBundle, noInputsGate.gateEntry)));

  // ---- DSSE signing (#141, A, ADR-0037 §1) — self-signed ed25519. Sign/verify/keyid are pure
  // functions taking key material as arguments; keys are generated in-memory here (a node:crypto
  // call, not a file read) so every row runs fully offline, exactly as the ADR's Seam 1 asks.
  const { publicKey: pkA, privateKey: skA } = generateKeyPairSync('ed25519');
  const { publicKey: pkB, privateKey: skB } = generateKeyPairSync('ed25519'); // an unrelated key

  check('keyidFromPublicKey: sha256 hex, stable for the same key', /^[0-9a-f]{64}$/.test(keyidFromPublicKey(pkA)) && keyidFromPublicKey(pkA) === keyidFromPublicKey(pkA));
  check('keyidFromPublicKey: differs across keys', keyidFromPublicKey(pkA) !== keyidFromPublicKey(pkB));

  const envelope = dsseSign({ hello: 'world' }, skA);
  check('dsseSign: envelope carries the in-toto payloadType', envelope.payloadType === 'application/vnd.in-toto+json');
  check("dsseSign: envelope's keyid matches the signer's public key", envelope.signatures[0].keyid === keyidFromPublicKey(pkA));
  check('sign → verify round-trip: verifies against the signer\'s public key (THE UNLOCK)', dsseVerify(envelope, pkA) === true);
  check('verify: the WRONG key fails', dsseVerify(envelope, pkB) === false);
  const tamperedEnvelope = { ...envelope, payload: Buffer.from(JSON.stringify({ hello: 'tampered' })).toString('base64') };
  check('verify: a TAMPERED payload fails (no longer matches the signed PAE)', dsseVerify(tamperedEnvelope, pkA) === false);
  check('verify: a malformed/absent envelope fails closed, never throws', dsseVerify(null, pkA) === false && dsseVerify({}, pkA) === false);

  // Bundle-level signing pairs A with B1 (ADR-0037 sequencing): the signed payload is the
  // bundle's `subject` (pr-head + the #139 input digests) PLUS the gate predicate, so the
  // signature covers the input digests too, not just the decision.
  const signBundle = assembleBundle({
    commit: 'deadbeef',
    entries: [mkPw('PASSED'), auditTestParsedEntry(T.confirmedClean)],
    inputs: [{ name: 'playwright-json', bytes: 'fixture bytes' }],
  });
  const { gateEntry: signGateEntry } = gate(signBundle);
  signBundle.entries.push(signGateEntry);
  signBundle.dsseEnvelope = signGateBundle(signBundle, signGateEntry, skA);

  check('signGateBundle: the signed bundle still validates (shape)', validateBundle(signBundle).length === 0);
  check('verifyGateBundle: valid signature + unaltered bundle → valid', verifyGateBundle(signBundle, pkA).valid === true);
  check('verifyGateBundle: the WRONG key → invalid', verifyGateBundle(signBundle, pkB).valid === false);

  // A valid result reports the NARROW scope it attests — the decision + subject names it covers —
  // so a caller (and the --verify CLI message) can state the scope precisely instead of implying the
  // whole file is signed (producedOn / schemaVersion / ingested entries stay outside the signature).
  const attested = verifyGateBundle(signBundle, pkA).attested;
  check('verifyGateBundle: a valid result reports the attested decision + subject names (narrow scope)',
    attested.decision === 'ship' && attested.subjects.includes('pr-head') && attested.subjects.includes('playwright-json'));

  // Shape guard the --verify CLI path leans on: verifyGateBundle binds to the FIRST gate entry, so a
  // duplicate-gate bundle can still crypto-verify — validateBundle is what rejects it (fail closed).
  const twoGateBundle = JSON.parse(JSON.stringify(signBundle));
  twoGateBundle.entries.unshift(JSON.parse(JSON.stringify(signGateEntry)));
  check('validateBundle: a duplicate gate entry is rejected (the --verify shape guard)',
    validateBundle(twoGateBundle).some((e) => /exactly one gate entry/.test(e)));

  const decisionTampered = JSON.parse(JSON.stringify(signBundle));
  decisionTampered.entries.find((e) => e.predicate?.stage === 'gate').predicate.decision = 'hold';
  check('verifyGateBundle: the DECISION edited after signing (stale envelope left in place) → invalid',
    verifyGateBundle(decisionTampered, pkA).valid === false);

  const subjectTampered = JSON.parse(JSON.stringify(signBundle));
  subjectTampered.subject[1].digest.sha256 = '0'.repeat(64);
  check('verifyGateBundle: an INPUT DIGEST edited after signing → invalid (signature covers the #139 subjects too)',
    verifyGateBundle(subjectTampered, pkA).valid === false);

  const unsignedVerify = verifyGateBundle(digestBundle, pkA); // `digestBundle` from the #139 block above — never signed
  check('verifyGateBundle: an unsigned bundle → invalid, reason names it unsigned', unsignedVerify.valid === false && /unsigned/.test(unsignedVerify.reason));
  check('assembleBundle: no dsseEnvelope field at all unless signing ran (strictly additive)', assembleBundle({ commit: 'x', entries: [] }).dsseEnvelope === undefined);

  const unsignedReport = renderReport(noInputsBundle, noInputsGate.gateEntry);
  check('report: an unsigned bundle says "unsigned" / "not a signed attestation" (ADR-0032\'s hedge, unsigned default)',
    /unsigned/.test(unsignedReport) && /not a signed attestation/.test(unsignedReport));
  const signedReport = renderReport(signBundle, signGateEntry);
  check('report: a SIGNED bundle says "signed" and surfaces its keyid', /signed: ✓/.test(signedReport) && signedReport.includes(keyidFromPublicKey(pkA)));

  // emission robustness — a model produced it, so never trust it blind
  check('parseAuditEmission: rejects non-JSON', parseAuditEmission('not json {') === null);
  check('parseAuditEmission: rejects missing/foreign schema', parseAuditEmission(JSON.stringify({ confirmedSolid: 1 })) === null);
  check('parseAuditEmission: rejects a negative count', parseAuditEmission(JSON.stringify({ schema: 'gate-audit-test/v0.3', confirmedSolid: -1 })) === null);
  check('parseAuditEmission: rejects a fractional count', parseAuditEmission(JSON.stringify({ schema: 'gate-audit-test/v0.3', confirmedSolid: 1.5 })) === null);
  check('parseAuditEmission: accepts a well-formed emission', parseAuditEmission(JSON.stringify({ schema: 'gate-audit-test/v0.3', ...T.confirmedClean })) !== null);
  // #111 — exact schema version (not a prefix) + cross-field consistency
  check('parseAuditEmission: rejects a bogus version (v999 — exact match, not prefix)', parseAuditEmission(JSON.stringify({ schema: 'gate-audit-test/v999', ...T.confirmedClean })) === null);
  check('parseAuditEmission: rejects impossible confirmedSolid>deepAudited', parseAuditEmission(JSON.stringify({ schema: 'gate-audit-test/v0.3', audited: 0, deepAudited: 0, confirmedSolid: 1, confirmedHollow: 0, likelyHollow: 0, baselineLock: 0, unexamined: 0 })) === null);
  check('parseAuditEmission: rejects audited≠deepAudited+unexamined', parseAuditEmission(JSON.stringify({ schema: 'gate-audit-test/v0.3', audited: 12, deepAudited: 4, confirmedSolid: 4, confirmedHollow: 0, likelyHollow: 0, baselineLock: 0, unexamined: 0 })) === null);
  check('parseAuditEmission: the old v0.2 string is no longer accepted (exact-match, not backward-compatible aliasing)',
    parseAuditEmission(JSON.stringify({ schema: 'gate-audit-test/v0.2', ...T.confirmedClean })) === null);

  // ---- run trace (`runs[]`) cross-check (#142, B2, ADR-0037 §3) — optional, additive; a tally
  // that disagrees with its own trace is rejected the SAME way an arithmetically-impossible
  // tally is (never a silent upgrade), so the caller's existing null-fallback handles it for free.
  const mkRun = (test, outcome, exitCode = outcome === 'killed' ? 1 : 0) =>
    ({ test, mutation: `mutated ${test}`, command: `npx playwright test ${test}`, outcome, exitCode });
  const killedRuns = (n) => Array.from({ length: n }, (_, i) => mkRun(`t${i}`, 'killed'));

  check('parseAuditEmission: consistent tally + trace is accepted (THE UNLOCK)',
    parseAuditEmission(JSON.stringify({ schema: 'gate-audit-test/v0.3', ...T.confirmedClean, runs: killedRuns(4) })) !== null);
  check('parseAuditEmission: absent `runs[]` remains valid — unaffected (additive, behaves exactly as v0.2)',
    parseAuditEmission(JSON.stringify({ schema: 'gate-audit-test/v0.3', ...T.confirmedClean })) !== null);
  check('parseAuditEmission: confirmedSolid ≠ killed-record count → rejected (degrades to opaque)',
    parseAuditEmission(JSON.stringify({ schema: 'gate-audit-test/v0.3', ...T.confirmedClean, runs: killedRuns(3) })) === null);
  check('parseAuditEmission: confirmedHollow ≠ survived-record count → rejected',
    parseAuditEmission(JSON.stringify({ schema: 'gate-audit-test/v0.3', ...T.confirmedHollow, runs: killedRuns(3) })) === null);
  check('parseAuditEmission: runs.length > deepAudited → rejected (over-count)',
    parseAuditEmission(JSON.stringify({ schema: 'gate-audit-test/v0.3', ...T.confirmedClean, runs: killedRuns(5) })) === null);
  check('parseAuditEmission: a malformed run record (bad outcome) → rejected',
    parseAuditEmission(JSON.stringify({ schema: 'gate-audit-test/v0.3', ...T.confirmedClean, runs: [{ test: 't0', mutation: 'm', command: 'c', outcome: 'ambiguous', exitCode: 1 }] })) === null);
  check('parseAuditEmission: `runs` present but not an array → rejected',
    parseAuditEmission(JSON.stringify({ schema: 'gate-audit-test/v0.3', ...T.confirmedClean, runs: 'nope' })) === null);

  // ---- exact outcome accounting (#155/F1): Σ(outcomes) === deepAudited, not ≤. Every claimed deep
  // audit must land in exactly one outcome class — an unaccounted-for deep audit is rejected.
  check('parseAuditEmission #155/F1: unclassified deep audits (deepAudited:100, confirmedSolid:1, rest:0) → rejected (the F1 exploit)',
    parseAuditEmission(JSON.stringify({ schema: 'gate-audit-test/v0.3', audited: 100, deepAudited: 100, confirmedSolid: 1, confirmedHollow: 0, likelyHollow: 0, baselineLock: 0, unexamined: 0 })) === null);
  check('parseAuditEmission #155/F1: Σ(outcomes) < deepAudited (deepAudited:4, one class short) → rejected',
    parseAuditEmission(JSON.stringify({ schema: 'gate-audit-test/v0.3', audited: 7, deepAudited: 4, confirmedSolid: 3, confirmedHollow: 0, likelyHollow: 0, baselineLock: 0, unexamined: 3 })) === null);
  check('parseAuditEmission #155/F1: Σ(outcomes) === deepAudited (every deep audit classified) → accepted',
    parseAuditEmission(JSON.stringify({ schema: 'gate-audit-test/v0.3', ...T.confirmedClean })) !== null);

  // ---- run-trace exit-signal consistency + uniqueness (#155/F3) --------------------------------
  // `mkRun` already takes an explicit exitCode (3rd arg), so it covers the contradictory-exit and
  // duplicate-identity cases directly — no separate helper needed.
  check('parseAuditEmission #155/F3: killed record with exitCode:0 (failed-as-it-should but green exit) → rejected',
    parseAuditEmission(JSON.stringify({ schema: 'gate-audit-test/v0.3', ...T.confirmedClean, runs: [...killedRuns(3), mkRun('t3', 'killed', 0)] })) === null);
  check('parseAuditEmission #155/F3: survived record with non-zero exitCode → rejected',
    parseAuditEmission(JSON.stringify({ schema: 'gate-audit-test/v0.3', ...T.confirmedHollow, runs: [...killedRuns(3), mkRun('t3', 'survived', 1)] })) === null);
  check('parseAuditEmission #155/F3: four identical (test,mutation,command) killed records satisfying killed===confirmedSolid:4 → rejected (the F3 dup exploit)',
    parseAuditEmission(JSON.stringify({ schema: 'gate-audit-test/v0.3', ...T.confirmedClean, runs: Array.from({ length: 4 }, () => mkRun('dup', 'killed', 1)) })) === null);
  check('parseAuditEmission #155/F3: distinct killed records with non-zero exits still accepted (regression guard)',
    parseAuditEmission(JSON.stringify({ schema: 'gate-audit-test/v0.3', ...T.confirmedClean, runs: killedRuns(4) })) !== null);

  const consistentHollowTally = parseAuditEmission(JSON.stringify({
    schema: 'gate-audit-test/v0.3', ...T.confirmedHollow, runs: [...killedRuns(3), mkRun('t3', 'survived')],
  }));
  check('parseAuditEmission: killed+survived trace matching confirmedSolid+confirmedHollow is accepted',
    consistentHollowTally !== null && consistentHollowTally.runs.length === 4);

  // Run-trace numbers live in the audit-test EVIDENCE entry, not the gate predicate (honesty
  // guard #3 stays scoped to the `gate` stage only) — `runsVerified` is a metric on the
  // audit-test entry, exactly alongside the counts it was cross-checked against.
  const withRunsEntry = auditTestParsedEntry(parseAuditEmission(JSON.stringify({ schema: 'gate-audit-test/v0.3', ...T.confirmedClean, runs: killedRuns(4) })));
  check('auditTestParsedEntry: a verified trace surfaces as `runsVerified` on the audit-test entry',
    withRunsEntry.predicate.verdict.metrics.some((m) => m.name === 'runsVerified' && m.value === 4));
  const noRunsEntry = auditTestParsedEntry(parseAuditEmission(JSON.stringify({ schema: 'gate-audit-test/v0.3', ...T.confirmedClean })));
  check('auditTestParsedEntry: no `runs[]` → no `runsVerified` metric (additive-only)',
    !noRunsEntry.predicate.verdict.metrics.some((m) => m.name === 'runsVerified'));
  const runsGateEntry = gate(assembleBundle({ commit: 'x', entries: [mkPw('PASSED'), withRunsEntry] })).gateEntry;
  check('gate predicate stays number-free even when the audit-test entry carries `runsVerified` (honesty guard #3 intact)',
    validateGateEntry(runsGateEntry).length === 0);

  // A trace-verified confirmed-clean tally still ships exactly like an untraced one — B2 hardens
  // the evidence behind the label, it does not open a new path to `ship` (issue #142's own AC).
  const shipWithRuns = gate(assembleBundle({ commit: 'x', entries: [mkPw('PASSED'), withRunsEntry] })).decision;
  check('ship-eligibility is unchanged by a verified run trace — same PASSED+confirmed+floor rule', shipWithRuns === 'ship');

  // end-to-end from the emission-with-runs[] fixture (#142)
  const confirmedWithRuns = JSON.parse(readFileSync(resolve(HERE, 'fixtures/audit-test.confirmed-with-runs.json'), 'utf8'));
  const withRunsFixtureTally = parseAuditEmission(JSON.stringify(confirmedWithRuns));
  check('fixture: audit-test.confirmed-with-runs.json parses and cross-checks cleanly', withRunsFixtureTally !== null && withRunsFixtureTally.runs.length === 6);
  check('fixture: audit-test.confirmed-with-runs.json — a hollow finding among the traced runs → FAILED (fix the test, not a red build)',
    deriveAuditResult(withRunsFixtureTally) === 'FAILED');

  // honesty guard #3 — clean validates; a smuggled number is rejected. Holds for the
  // PARSED path too: the audit label/result are string categories, so the raw counts
  // stay in the evidence entry and never leak a number into the gate predicate.
  const clean = gate(bundleOf('PASSED', true)).gateEntry;
  check('clean gate entry validates', validateGateEntry(clean).length === 0);
  const dirty = JSON.parse(JSON.stringify(clean));
  dirty.predicate.confidence = 0.85; // smuggle a number
  check('numeric field in gate predicate is rejected', validateGateEntry(dirty).length > 0);
  check('gate entry shows its work (every input has `proposed`)', clean.predicate.inputs.every((i) => 'proposed' in i));
  const parsedGate = gate(assembleBundle({ commit: 'x', entries: [mkPw('PASSED'), auditTestParsedEntry(T.confirmedClean)] })).gateEntry;
  check('parsed-path gate entry carries no number (counts stayed in the evidence entry)', validateGateEntry(parsedGate).length === 0);

  // end-to-end from fixture files → bundle → gate → full-bundle validation
  const rep = JSON.parse(readFileSync(resolve(HERE, 'fixtures/playwright.warned.json'), 'utf8'));
  const md = readFileSync(resolve(HERE, 'fixtures/audit-test.report.md'), 'utf8');
  const e2e = assembleBundle({ commit: 'fixture', entries: [playwrightEntry(rep), auditTestEntry(md)] });
  const g = gate(e2e);
  e2e.entries.push(g.gateEntry);
  check('fixture e2e: WARNED + audit → canary', g.decision === 'canary');
  check('fixture e2e: full bundle validates', validateBundle(e2e).length === 0);
  const report = renderReport(e2e, g.gateEntry);
  check('report names the decision', /canary/i.test(report));
  check('report states it is advisory', /advisory/i.test(report));
  check('report carries no manufactured number', !/\bconfidence\b\s*[:=]\s*\d/i.test(report));

  // end-to-end SHIP path from fixture files — PASSED Playwright + parsed confirmed-clean audit-test
  const passedRep = JSON.parse(readFileSync(resolve(HERE, 'fixtures/playwright.passed.json'), 'utf8'));
  const confirmedTally = parseAuditEmission(readFileSync(resolve(HERE, 'fixtures/audit-test.confirmed.json'), 'utf8'));
  check('fixture: audit-test.confirmed.json is a valid emission', confirmedTally !== null);
  const shipB = assembleBundle({ commit: 'fixture', entries: [playwrightEntry(passedRep), auditTestParsedEntry(confirmedTally)] });
  const gShip = gate(shipB);
  shipB.entries.push(gShip.gateEntry);
  check('fixture e2e: PASSED + parsed confirmed-clean → ship', gShip.decision === 'ship');
  check('fixture e2e: ship bundle validates', validateBundle(shipB).length === 0);
  const shipReport = renderReport(shipB, gShip.gateEntry);
  check('ship report says ship earned', /`ship` earned/i.test(shipReport));
  check('ship report states examined/unexamined scope (#112)', /deep-audited subset/i.test(shipReport) && /unexamined/i.test(shipReport));
  check('ship report carries no manufactured number', !/\bconfidence\b\s*[:=]\s*\d/i.test(shipReport));

  // end-to-end from the committed signed-bundle fixture (#141) — the demo key is fixture-only,
  // committed for reproducibility; it signs nothing but this fixture and is not a secret worth
  // protecting.
  const signedFixtureBundle = JSON.parse(readFileSync(resolve(HERE, 'fixtures/gate-bundle.signed.json'), 'utf8'));
  const demoPubKey = createPublicKey(readFileSync(resolve(HERE, 'fixtures/gate-signing-key.demo.pub.pem'), 'utf8'));
  check('fixture: gate-bundle.signed.json carries a dsseEnvelope', signedFixtureBundle.dsseEnvelope !== undefined);
  check('fixture: gate-bundle.signed.json validates (shape)', validateBundle(signedFixtureBundle).length === 0);
  check('fixture: gate-bundle.signed.json verifies against its committed demo public key', verifyGateBundle(signedFixtureBundle, demoPubKey).valid === true);
  const fixtureTampered = JSON.parse(JSON.stringify(signedFixtureBundle));
  fixtureTampered.entries.find((e) => e.predicate?.stage === 'gate').predicate.decision = 'hold';
  check('fixture: tampering with the committed signed fixture is caught', verifyGateBundle(fixtureTampered, demoPubKey).valid === false);

  const passed = R.every((r) => r.ok);
  console.log('gate.mjs self-test:');
  for (const r of R) console.log(`  ${r.ok ? '✓' : '✗'} ${r.name}`);
  console.log(passed ? '→ OK (gate is deterministic + honest)\n' : '→ BROKEN\n');
  return passed;
}

// Run main only as a CLI, never when imported by a test.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}
