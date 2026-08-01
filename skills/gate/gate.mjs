#!/usr/bin/env node
// Gate — the deterministic core of the Gate skill (Sentinel stage 7).
//
// Ingests the evidence a PR already produced (E2E execution evidence — a Playwright
// JSON report and/or a Cypress Module API result — plus an audit-test verdict, either a
// PARSED emission or an opaque Markdown report), binds it into one readable evidence
// bundle (in-toto-shaped Statements — DSSE-signed attestations when a key is supplied,
// ADR-0032/ADR-0037 §1, widened to the whole normalized bundle by ADR-0040/#158; unsigned
// bundles stay "shaped, not signed" — over content-addressed subjects: the PR head commit,
// a sha256 digest of each ingested input file (#139/ADR-0037 §2), and (when signed) a sha256
// digest of each parsed evidence entry plus producedOn/schemaVersion (#158/ADR-0040) — so
// swapping a report OR editing its rendered entry out from under the verdict changes its
// recorded digest), and derives a
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
// that examined nothing derives `unexamined` → also canary (theater guard). A PASSED execution
// suite must ALSO clear an executed-floor (default 50%, `--executed-floor` overridable down to
// a 25% minimum) on its own discovered-vs-executed fraction — the execution-completeness gate
// (#157): a 1-of-1000 run with the rest skipped reads PASSED but is capped at canary, not
// laundered into `ship`.
//
// This is DETERMINISTIC CODE, not model judgment: the same bundle always yields
// the same decision (a release gate must be reproducible). The SKILL.md
// orchestrates by running it. Contract v0 = TzolkinB/skills#102; gate spec v0 =
// #103; parsed audit-test = #49 (ADR-0029). Zero external deps by design.
//
// Usage:
//   node gate.mjs (--playwright=<results.json> | --cypress=<cypress-results.json>) \
//                    [--audit-test-json=<tally.json>] [--audit-test=<report.md>] \
//                    [--trace-json=<trace-matrix.json>] \
//                    [--examined-floor=<pct>] [--executed-floor=<pct>] [--max-age=<minutes>] [--commit=<sha>] \
//                    [--out=<bundle.json>] [--sign-key=<private-key.pem>]   # ≥1 execution report; both allowed
//   node gate.mjs --gen-key=<path-prefix>              # writes <prefix>.pem + <prefix>.pub.pem
//   node gate.mjs --verify --bundle=<bundle.json> --pubkey=<public-key.pem>
//   node gate.mjs --self-test        # golden truth-table gate (deterministic)

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, resolve, join, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash, sign as cryptoSign, verify as cryptoVerify, createPrivateKey, createPublicKey, generateKeyPairSync } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));

// ---- constants (gate:// namespace everywhere — plugin-neutral, contract Q9) ----
const SCHEMA_VERSION = 'gate-evidence-bundle/v0.8'; // v0.1 = v0 (LOCKED, #102) + ADDITIVE `EMPTY` (#111, ADR-0031); v0.2 = witness:// -> gate:// internal rename (ADR-0033); v0.3 = proven -> confirmed taxonomy rename (#126, ADR-0034); v0.4 = ADDITIVE per-input sha256 subjects (#139, ADR-0037 §2); v0.5 = ADDITIVE optional DSSE envelope (#141, ADR-0037 §1); v0.6 = ADDITIVE — the DSSE payload (when signed) also digest-binds each parsed evidence entry + producedOn/schemaVersion (#158, ADR-0040) — a v0.6 signature is a STRONGER claim than a v0.5 one, not just a shape bump; v0.7 = ADDITIVE `rejected` boolean on a gate-predicate input (hostile-review finding #2, 2026-07-25, ADR-0042) — a rejected audit-test-json emission now renders/persists as its own state, distinct from `absent`; v0.8 = ADDITIVE optional `business-risk` entry (#199, ADR-0045) — a stateless join of a `--trace-json` traceability matrix against the audit-test emission's `runs[]`, appended to `bundle.entries` AFTER the gate decision is computed so it never becomes a decision input; a bundle with no `--trace-json` is byte-for-byte unchanged from v0.7
const STATEMENT_TYPE = 'https://in-toto.io/Statement/v1';
const EVIDENCE_PREDICATE = 'https://gate.local/evidence/qa-stage/v0';
const GATE_PREDICATE = 'https://gate.local/gate/v0';
const BUSINESS_RISK_PREDICATE = 'https://gate.local/business-risk/v0'; // #199, ADR-0045 — informational join, never an input to the gate() decision
const DSSE_PAYLOAD_TYPE = 'application/vnd.in-toto+json'; // the in-toto JSON media type (ADR-0037 §1)
const RANK = { hold: 0, canary: 1, ship: 2 }; // worst-wins ordinal: hold < canary < ship
// Coverage-aware ship gate (#127, ADR-0035): a confirmed-clean audit-test verdict must ALSO
// clear this examined-fraction (deepAudited/audited) to reach `ship`, not just narrate it.
// `--examined-floor` overrides the default; never clamps below the minimum (never 0, never
// silently trusts a 1-of-500 deep-audit).
const EXAMINED_FLOOR_DEFAULT = 50;
const EXAMINED_FLOOR_MIN = 25;
// Execution-completeness floor (#157): a suite can report PASSED while having executed only a
// sliver of what the framework discovered (a discovery/filter/config mistake — `expected:1,
// skipped:999` is the disclosed exploit). Same shape as the examined-floor above: a fraction
// floor on discovered-but-unexecuted tests, gating `ship-baseline` separately from the
// PASSED/FAILED/WARNED verdict itself. `--executed-floor` overrides; never below the minimum.
const EXECUTED_FLOOR_DEFAULT = 50;
const EXECUTED_FLOOR_MIN = 25;
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

  // `scope` (#171, ADR-0038) — an OPTIONAL free-text passthrough, e.g. "certify(floor=50%) ·
  // --changed (12 of ~180 suite test files)". Informational only, per the published schema — it
  // is never validated for truthfulness and never drives the decision (honesty guard #1 still
  // reads only the derived category). It exists so a certified run's disclosed narrowness reaches
  // the human reading GATE's report, not only a reader of audit-test's own raw emission.
  if (obj.scope !== undefined) {
    if (typeof obj.scope !== 'string') return null;
    tally.scope = obj.scope;
  }

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
      // Non-empty, not just string-typed (#171 review) — a blank `test`/`mutation`/`command`
      // would still pass a bare `typeof` check and dilute `runsVerified` with content-free rows.
      if (typeof r.test !== 'string' || !r.test || typeof r.mutation !== 'string' || !r.mutation || typeof r.command !== 'string' || !r.command) return null;
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
  // `scope` rides as a string on the verdict, alongside (never inside) `metrics` — metrics stays
  // numeric-only (what the derivation reads), scope is disclosure-only prose the gate NEVER reads
  // for the decision (honesty guard #1 untouched; only `renderReport`/`auditScope` display it).
  const verdict = { result: deriveAuditResult(tally), label: deriveAuditLabel(tally), metrics };
  if (tally.scope) verdict.scope = tally.scope;
  return statement(EVIDENCE_PREDICATE, {
    stage: 'audit-test',
    producer: { id: 'gate://audit-test@0.x' },
    verdict,
    byproducts,
    annotations: {},
  });
}

// ---- ingest: audit-test (REJECTED — a distinct state from `absent`, hostile-review finding #2, 2026-07-25, ADR-0042) --
//
// `parseAuditEmission` returning null means the JSON was PROVIDED but is malformed or
// arithmetically inconsistent — the single strongest signal Gate can produce about a broken or
// dishonest producer. Previously that signal only reached a stderr warning and the bundle/report
// then read identically to `absent` (nothing was ever sent). This entry persists the rejection
// itself: no result/label/metrics (there is nothing trustworthy to derive them from), `reason` a
// short fixed diagnostic string. It still floors the credibility axis at `canary` — exactly what
// `absent` already got — so honesty guard #1 (the decision) is unchanged; only the DISCLOSURE of
// why is new.
export function auditTestRejectedEntry(reason) {
  return statement(EVIDENCE_PREDICATE, {
    stage: 'audit-test',
    producer: { id: 'gate://audit-test@0.x' },
    verdict: { rejected: true, reason },
    byproducts: [],
    annotations: {},
  });
}

function statement(predicateType, predicate) {
  return { _type: STATEMENT_TYPE, predicateType, subject: [], predicate };
}

// ---- ingest: trace-matrix + business-risk join (#199, ADR-0045) ------------
//
// "What business risks are actually covered?" — answered as a JOIN over an external
// requirement->test traceability matrix and an audit-test emission, never as a risk register
// Gate maintains itself (ADR-0045 rejects that option outright: it would duplicate TEA's
// `trace` workflow, which already owns requirement->test mapping and is free). TEA's matrix is
// PRESENCE-based — Verified against the `bmad-testarch-trace` workflow source (v1.19.1,
// 2026-07-29, comparisons/tea.md §3): a requirement is marked covered because a *matching test
// exists*, never because that test would fail if the code broke. So a P0 requirement whose only
// test is hollow reads as covered and gates PASS. This join closes exactly that gap by adding a
// credibility read on top of TEA's presence read — it does not replace or re-derive TEA's own
// FULL/PARTIAL/NONE call.
//
// `gate-trace-matrix/v0` (schema/trace-matrix.v0.schema.json) is Gate's OWN minimal shape, not
// TEA's internal format (orchestrate-don't-couple) — see that schema file's header for why. A
// user (or a small adapter) converts a `trace` run's output into this shape.
const TRACE_MATRIX_SCHEMA = 'gate-trace-matrix/v0';
const PRIORITIES = ['P0', 'P1', 'P2', 'P3'];
const PRESENCE_STATUSES = ['FULL', 'PARTIAL', 'NONE'];
const MATRIX_GATE_STATUSES = ['PASS', 'CONCERNS', 'FAIL', 'WAIVED', 'NOT_EVALUATED']; // producer-agnostic — TEA's own vocabulary, but any producer's `gateStatus` must be one of these

// Validate the matrix's shape — same "a producer wrote this, never trust it blind" posture as
// `parseAuditEmission`. Returns a normalised matrix, or null if malformed so the caller can
// degrade to a rejected entry rather than crash or silently accept an impossible row.
export function parseTraceMatrix(raw) {
  let obj;
  try {
    obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object') return null;
  if (obj.schema !== TRACE_MATRIX_SCHEMA) return null; // exact match, not a prefix (#111's precedent)
  if (!Array.isArray(obj.requirements)) return null;
  const seen = new Set();
  const requirements = [];
  for (const r of obj.requirements) {
    if (!r || typeof r !== 'object') return null;
    if (typeof r.id !== 'string' || !r.id) return null;
    if (seen.has(r.id)) return null; // duplicate requirement id
    seen.add(r.id);
    if (!PRIORITIES.includes(r.priority)) return null;
    if (!PRESENCE_STATUSES.includes(r.status)) return null;
    if (!Array.isArray(r.tests) || !r.tests.every((t) => typeof t === 'string' && t)) return null;
    // status<->tests consistency, enforced both ways: a NONE row claiming a test, or a
    // FULL/PARTIAL row claiming none, is an arithmetically impossible row — reject the whole
    // matrix rather than silently guess which field is wrong.
    if (r.status === 'NONE' && r.tests.length !== 0) return null;
    if (r.status !== 'NONE' && r.tests.length === 0) return null;
    requirements.push({ id: r.id, priority: r.priority, status: r.status, tests: r.tests });
  }
  const matrix = { requirements };
  if (obj.producer !== undefined) {
    if (typeof obj.producer !== 'string') return null;
    matrix.producer = obj.producer;
  }
  if (obj.gateStatus !== undefined) {
    if (!MATRIX_GATE_STATUSES.includes(obj.gateStatus)) return null;
    matrix.gateStatus = obj.gateStatus;
  }
  return matrix;
}

// The join itself (ADR-0045 §2): resolve each FULL/PARTIAL requirement into one of three states
// by looking its mapped tests up against an audit-test emission's EXECUTION-CONFIRMED subset —
// `tally.runs[]`. A test with no run record (never deep-audited, or deep-audited only as
// likely-hollow/baseline-lock, which carry no per-test record — see gate-audit-test/v0.3) is
// NEVER silently upgraded; it stays `unverified`. Worst-wins across a requirement's own tests,
// the same conservative posture the gate decision itself uses: a requirement is only ever
// `mutation-proven` when EVERY mapped test was execution-confirmed solid — one hollow test among
// several mapped ones still makes the requirement `hollow`, because the risk it names is only as
// covered as its weakest guard, not its strongest.
export function resolveBusinessRisk(matrix, tally) {
  const runsByTest = new Map();
  for (const r of tally?.runs ?? []) runsByTest.set(r.test, r.outcome);

  const rows = matrix.requirements.map((req) => {
    if (req.status === 'NONE') {
      // No test to check — this is TEA's own presence gap (already flagged by its PASS/CONCERNS/
      // FAIL), not this join's to fabricate evidence for. Reported separately, never folded into
      // the three-state count.
      return { id: req.id, priority: req.priority, state: 'not-covered', tests: [] };
    }
    const tests = req.tests.map((t) => ({ test: t, outcome: runsByTest.get(t) ?? null }));
    const anyHollow = tests.some((t) => t.outcome === 'survived');
    const allSolid = tests.every((t) => t.outcome === 'killed');
    const state = anyHollow ? 'hollow' : allSolid ? 'mutation-proven' : 'unverified';
    return { id: req.id, priority: req.priority, state, tests };
  });

  const summary = {
    mutationProven: rows.filter((r) => r.state === 'mutation-proven').length,
    unverified: rows.filter((r) => r.state === 'unverified').length,
    hollow: rows.filter((r) => r.state === 'hollow').length,
    notCovered: rows.filter((r) => r.state === 'not-covered').length,
  };
  return { rows, summary, hasRunTrace: runsByTest.size > 0 };
}

export function businessRiskEntry(matrix, rollup) {
  return statement(BUSINESS_RISK_PREDICATE, {
    stage: 'business-risk',
    producer: { id: 'gate://gate@0.x' },
    matrixProducer: matrix.producer ?? null,
    matrixGateStatus: matrix.gateStatus ?? null,
    rollup,
  });
}

// Rejected, not absent — same distinct-state treatment `auditTestRejectedEntry` gives a
// malformed audit-test emission (#2, ADR-0042): the file was received and discarded, not never
// sent, and that disclosure is worth persisting rather than only a stderr warning.
export function businessRiskRejectedEntry(reason) {
  return statement(BUSINESS_RISK_PREDICATE, {
    stage: 'business-risk',
    producer: { id: 'gate://gate@0.x' },
    rejected: true,
    reason,
  });
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

// ---- canonicalization (#158, ADR-0040) --------------------------------------
//
// A small, hand-rolled, zero-dep canonical form — NOT RFC 8785/JCS — pinned so that hashing and
// signing are stable across incidental formatting differences (key order, re-serialization).
// Every field this covers is a shape Gate fully controls (hex digests, enum strings, ISO-8601
// timestamps, small integer counts), so JCS's hard problems (exact ECMAScript number formatting,
// full Unicode escaping) never come up; a recursive key-sort is sufficient and keeps the
// zero-dep moat (ADR-0028). Not claimed to be JCS-interoperable.
function canonicalSort(value) {
  if (Array.isArray(value)) return value.map(canonicalSort);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, k) => {
        acc[k] = canonicalSort(value[k]);
        return acc;
      }, {});
  }
  return value;
}
export function canonicalize(value) {
  return JSON.stringify(canonicalSort(value));
}

// One subject per parsed EVIDENCE entry (non-gate) — digest-bind-entries (#158, ADR-0040). Binds
// the DISPLAYED, normalized entry (not just the raw input bytes `inputSubjects` already covers)
// into the signed Statement, so editing a rendered verdict (e.g. PASSED -> FAILED) after signing
// is caught even though the original input file's digest is untouched. A subject is
// integrity-binding, not endorsement — the gate PREDICATE still asserts only Gate's own decision;
// these subjects just say "my decision was rendered over exactly these entry bytes" (see
// CONTEXT.md, "Subject vs. predicate"). The gate entry itself is excluded: its `predicate` is
// already in the signed payload verbatim, so digesting it again would be redundant.
export function entrySubjects(entries = []) {
  return entries
    .filter((e) => e.predicate?.stage !== 'gate')
    .map((e) => ({ name: `entry:${e.predicate?.stage ?? 'unknown'}`, digest: { sha256: sha256Hex(canonicalize(e)) } }));
}

// ---- sign the gate Statement with a self-signed DSSE envelope (#141, A, ADR-0037 §1; widened #158, ADR-0040) ----
//
// Opt-in, additive, zero-dep (node:crypto's ed25519 support, no new package). Gate signs the
// Statement IT produced — the bundle's content-addressed `subject[]` (pr-head + one sha256 per
// ingested input, #139, PLUS one sha256 per parsed evidence entry, #158) plus `producedOn`/
// `schemaVersion` plus its own `gate.local/gate/v0` predicate. It never signs an ingested
// Playwright/Cypress/audit-test entry AS A PREDICATE (that would falsely imply their producer
// vouched for it) — entries ride in only as content-addressed subjects, integrity not endorsement
// (ADR-0040). Self-signed ed25519 proves INTEGRITY (not altered after signing) and CONTINUITY
// (same key across runs), never third-party IDENTITY — this is not Sigstore.
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
// decision) asserted over named, content-addressed subjects (the exact bytes it ingested AND
// rendered). Widened by #158/ADR-0040 to also bind each parsed evidence entry (`entrySubjects`)
// and to fold `producedOn`/`schemaVersion` into the signed Statement as a header — never into
// `predicate`, so honesty guard #3 (no numeric field in the gate predicate) stays untouched.
// Reconstructed fresh from a bundle + its gate entry so signing and verification always see
// the SAME shape — nothing is cached or trusted from an earlier run.
export function gateStatementPayload(bundle, gateEntry) {
  return {
    _type: STATEMENT_TYPE,
    predicateType: GATE_PREDICATE,
    subject: [...(bundle.subject ?? []), ...entrySubjects(bundle.entries)],
    predicate: gateEntry.predicate,
    producedOn: bundle.producedOn,
    schemaVersion: bundle.schemaVersion,
  };
}

// `keyid` = sha256 of the public key (ADR-0037 §1) — a stable fingerprint independent of PEM
// formatting, derived from the canonical SPKI/DER encoding so the same key always yields the
// same id regardless of how it was loaded.
export function keyidFromPublicKey(publicKey) {
  return sha256Hex(publicKey.export({ type: 'spki', format: 'der' }));
}

// Sign an arbitrary JSON-serializable payload as a DSSE envelope. `privateKey` is a node:crypto
// ed25519 KeyObject (or a PEM/DER input `crypto.sign` accepts) — never read from disk here.
// The payload is always canonicalized (#158, ADR-0040) before signing, so the bytes actually
// signed never depend on incidental key order in the object the caller built.
export function dsseSign(payload, privateKey) {
  const payloadBytes = Buffer.from(canonicalize(payload), 'utf8');
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
// A valid result reports `attested` — the decision and the FULL subject names the signature
// actually covers (pr-head + #139 input digests + #158 entry digests) — because the envelope
// wraps the whole widened gate Statement (ADR-0040). `producedOn`/`schemaVersion` are covered too
// (as the Statement's signed header) but aren't subjects, so they don't appear in `attested.subjects`
// even though editing either invalidates the signature just the same.
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
  // Canonicalize BOTH sides before comparing (#158, ADR-0040): `signedPayload` came back through
  // JSON.parse/base64 and `expected` was just built as a fresh object literal, so neither side's
  // incidental key order can be trusted to match the other's — canonicalizing both is what makes
  // the comparison formatting-stable in either direction.
  if (canonicalize(signedPayload) !== canonicalize(expected))
    return { valid: false, reason: 'signed payload no longer matches the bundle (tampered after signing)' };
  return {
    valid: true,
    keyid: keyidFromPublicKey(publicKey),
    attested: { decision: gateEntry.predicate?.decision, subjects: expected.subject.map((s) => s.name) },
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
  const base = m.deepAudited === undefined || m.audited === undefined
    ? 'the deep-audited subset'
    : `the deep-audited subset (${m.deepAudited} of ${m.audited} triaged tests mutation-audited; ${m.unexamined ?? 0} unexamined — not evidence of health)`;
  // Reported `scope` (#171, ADR-0038) is the producer's own free-text label (e.g. a certified
  // run naming how much of the whole suite `--changed` covered) — appended, never substituted,
  // so the mechanically-derived fraction above always prints regardless of what a producer says.
  // Absence is disclosed explicitly rather than silently omitted (hostile-review finding #6,
  // 2026-07-25): a skimming reader must see that nothing relates the triaged population above
  // to the suite's actual size, not just see the clause go missing.
  const reported = auditEntry?.predicate?.verdict?.scope;
  const scopeNote = reported
    ? `reported scope: "${reported}"`
    : 'reported scope: none declared — the triaged population above is not related to your suite\'s total size';
  return `${base} — ${scopeNote}`;
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

// Clamp a requested executed-floor into [EXECUTED_FLOOR_MIN, 100], defaulting when unset/invalid
// — same treatment as `resolveExaminedFloor` (never trusted past the floor's own minimum, so
// `--executed-floor=0` can't reopen the 1-of-1000 exploit, #157).
export function resolveExecutedFloor(requested) {
  if (requested === undefined || requested === null || requested === '') return EXECUTED_FLOOR_DEFAULT;
  const n = Number(requested);
  if (!Number.isFinite(n)) return EXECUTED_FLOOR_DEFAULT;
  return Math.min(100, Math.max(EXECUTED_FLOOR_MIN, n));
}

// Executed / skipped / discovered counts read straight from an execution entry's own metrics —
// a mechanical restatement, not a new derivation. `discovered` is executed+skipped, so a report
// that never mentions `skipped` (an older shape, or a framework with no such field) reads as
// fully discovered — this never manufactures a denominator the report didn't itself supply.
function executionCounts(entry) {
  const m = Object.fromEntries((entry?.predicate?.verdict?.metrics ?? []).map((x) => [x.name, x.value]));
  if (entry?.predicate?.stage === 'cypress') {
    const executed = Number(m.totalPassed ?? 0) + Number(m.totalFailed ?? 0);
    const skipped = Number(m.totalPending ?? 0) + Number(m.totalSkipped ?? 0);
    const discovered = m.totalTests !== undefined ? Number(m.totalTests) : executed + skipped;
    return { executed, skipped, discovered };
  }
  const executed = Number(m.expected ?? 0) + Number(m.unexpected ?? 0) + Number(m.flaky ?? 0);
  const skipped = Number(m.skipped ?? 0);
  return { executed, skipped, discovered: executed + skipped };
}

// Report freshness (hostile-review finding #3, 2026-07-25, ADR-0042) — OPT-IN via `--max-age`: unlike the
// examined/executed floors, there is no universally-safe default staleness threshold (a slow but
// legitimate CI run and a genuinely stale leftover `results.json` are indistinguishable without a
// user-supplied number), so this is null (no check) unless requested. Compares an execution
// entry's own recorded `producer.startedOn` against the BUNDLE's own `producedOn` — both fields
// already captured on the bundle, so this reuses data already in hand rather than reaching for
// wall-clock time inside this otherwise-deterministic function (`producedOn` was fixed at
// assembly time, in the CLI wrapper, not read again here). An entry with no recorded `startedOn`
// can't be checked and is silently unaffected — no evidence either way, not flagged stale.
// This only catches a report that is old RELATIVE TO WHEN THIS BUNDLE WAS ASSEMBLED — it does not
// bind a report to the specific `--commit` named on the bundle; that remains a known, separate gap
// whose closure is producer-recorded SHA provenance in v2, NOT a git-timestamp check (ADR-0043;
// see gate/SKILL.md's "Report freshness" note for why timestamps can't close it).
function staleMinutes(entry, bundle, maxAgeMinutes) {
  const startedOn = entry?.predicate?.producer?.startedOn;
  if (!startedOn) return null;
  const startedMs = Date.parse(startedOn);
  const producedMs = Date.parse(bundle?.producedOn);
  if (!Number.isFinite(startedMs) || !Number.isFinite(producedMs)) return null;
  const ageMinutes = (producedMs - startedMs) / 60000;
  return ageMinutes > maxAgeMinutes ? ageMinutes : null;
}

// Clamp/parse a requested --max-age into a positive number of minutes, or null (no check) when
// unset or invalid — invalid input disables the check rather than crashing or guessing a default.
export function resolveMaxAgeMinutes(requested) {
  if (requested === undefined || requested === null || requested === '') return null;
  const n = Number(requested);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function gate(bundle, { examinedFloor, executedFloor, maxAgeMinutes } = {}) {
  const floor = resolveExaminedFloor(examinedFloor);
  const execFloor = resolveExecutedFloor(executedFloor);
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
      let proposed = result === 'FAILED' || result === 'EMPTY' ? 'hold' : result === 'WARNED' ? 'canary' : 'ship';

      // Execution-completeness (#157): a suite can be PASSED/WARNED while having executed only a
      // sliver of what the framework discovered — surface the executed-vs-skipped split for EVERY
      // execution suite (not just buried in the entry's own metrics), and when a would-be `ship`
      // is dominated by skips, cap it at `canary` instead of laundering a 1-of-1000 run into green.
      const counts = executionCounts(e);
      const executedPct = counts.discovered > 0 ? Math.round((counts.executed / counts.discovered) * 100) : 0;
      const scope = counts.discovered > 0
        ? ` (${counts.executed} of ${counts.discovered} discovered tests executed — ${executedPct}%; ${counts.skipped} skipped)`
        : '';
      // Integer-domain comparison, same treatment as the examined-floor, to avoid float rounding
      // ever letting a borderline fraction slip past the floor it was just short of.
      const executedFloorMet = counts.discovered > 0 && counts.executed * 100 >= execFloor * counts.discovered;
      if (proposed === 'ship' && !executedFloorMet) proposed = 'canary';

      // Freshness (#3, opt-in via --max-age; hostile-review finding #3, 2026-07-25, ADR-0042) — checked
      // independently of the executed-floor above. Only actually changes the outcome when the
      // suite would otherwise have proposed `ship`; if the executed-floor already capped it at
      // `canary`, staleness is redundant to disclose here (the cap already happened).
      const stale = maxAgeMinutes != null ? staleMinutes(e, bundle, maxAgeMinutes) : null;
      if (proposed === 'ship' && stale !== null) proposed = 'canary';

      // No new field needed to mark this: `result === 'PASSED'` with `proposed === 'canary'` is
      // otherwise unreachable on the execution axis (pre-#157, PASSED always proposed `ship`), so
      // it's a sufficient, schema-stable signal for the report to key off — same treatment
      // `belowExaminedFloor` already gets from the audit-test input's existing fields.
      inputs.push({ stage, result, proposed });

      rationale.push(
        result === 'FAILED'
          ? `${stage} FAILED${scope} → hold (execution failed — dominates)`
          : result === 'EMPTY'
            ? `${stage} produced no test results (empty/zero-test report) → hold (an unrun or empty report is not a pass — #111)`
            : result === 'WARNED'
              ? `${stage} WARNED (flaky)${scope} → canary (a trust defect, not buried under a note)`
              : !executedFloorMet
                ? `${stage} PASSED but only executed ${counts.executed} of ${counts.discovered} discovered tests (${executedPct}% — ${counts.skipped} skipped) → canary (execution incomplete — below the ${execFloor}% executed-floor, #157)`
                : stale !== null
                  ? `${stage} PASSED${scope} but its report started ${Math.round(stale)}min before this bundle was produced — over the ${maxAgeMinutes}min --max-age → canary (stale evidence: looks like a report left over from an earlier run, #3)`
                  : `${stage} PASSED${scope} → ship-baseline`,
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
          ? `audit-test PASSED + confirmed but only ${examinedPct}% examined (${m.deepAudited} of ${m.audited} triaged tests) → canary (a diagnostic run — no problems found among the suspects it examined, which is not a certification of the whole suite; below the ${floor}% examined-floor — coverage-aware ship gate, #127)`
          : auditResult === 'FAILED'
            ? 'audit-test FAILED (confirmed false-confidence) → canary (a hollow test — fix it; not a red build)'
            : auditResult === 'WARNED'
              ? 'audit-test WARNED (likely-hollow / baseline-lock) → canary (credibility concern — a human must confirm)'
              : label === 'unexamined'
                ? 'audit-test PASSED but examined nothing (deep-audited 0) → canary (no proof of credibility — theater guard)'
                : 'audit-test PASSED but reasoning-only (env not runnable) → canary (short of execution proof)',
    );
  } else if (audit && audit.predicate?.verdict?.rejected) {
    // Rejected, not absent (#2, hostile-review finding #2, 2026-07-25, ADR-0042): the emission was received
    // and failed a shape/consistency check — a distinct, disclosed state from `absent` (nothing
    // ever sent) or `opaque` (unparsed prose). Same `canary` ceiling as both — the decision is
    // unchanged (honesty guard #1); only the rationale/report now say WHY.
    const reason = audit.predicate.verdict.reason ?? 'malformed or internally inconsistent';
    inputs.push({ stage: 'audit-test', rejected: true, proposed: 'canary' });
    rationale.push(`audit-test-json was rejected (${reason}) → floor at canary — the emission was received and discarded, not never sent`);
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

// Run-trace visibility (hostile-review finding #5, 2026-07-25): `runsVerified` was computed at
// ingest (`auditTestParsedEntry`) but never surfaced in the rendered report — two `ship` verdicts
// of materially different evidential weight (a per-test run trace cross-checked vs a bare tally)
// printed identically apart from an input digest. Reads the metric straight off the audit-test
// EVIDENCE entry's own metrics; the gate predicate itself stays untouched (honesty guard #3).
function runTraceNote(bundle) {
  const auditEv = bundle.entries.find((e) => e.predicate?.stage === 'audit-test');
  const n = auditMetricsOf(auditEv).runsVerified;
  return n === undefined
    ? ' (no run trace carried — tally unverified against per-test records)'
    : ` (${n} run record${n === 1 ? '' : 's'} cross-checked)`;
}

// Business-risk coverage (#199, ADR-0045) — a SEPARATE section appended at the very end of the
// report, after the ship/canary/hold narrative. Reads `bundle.entries` directly, never through
// `gateEntry.predicate.inputs`, because the entry is deliberately kept out of the gate's decision
// inputs (ADR-0045 §3: informational only). Renders nothing when `--trace-json` was never
// supplied — this is an opt-in extra, not a permanent fixture of every report the way the
// audit-test axis is.
function renderBusinessRisk(bundle) {
  const entry = bundle.entries.find((e) => e.predicate?.stage === 'business-risk');
  if (!entry) return [];
  const L = ['', '## Business-risk coverage — informational, does not affect the ship/canary/hold decision', ''];
  if (entry.predicate.rejected) {
    L.push(`trace-json was rejected (${entry.predicate.reason}) — business-risk coverage not evaluated; the file was received and discarded, not never sent.`);
    return L;
  }
  const { rollup, matrixProducer, matrixGateStatus } = entry.predicate;
  const { rows, summary, hasRunTrace } = rollup;
  const stateIcon = { 'mutation-proven': '🟢', hollow: '🔴', unverified: '⚪', 'not-covered': '—' };
  L.push(
    `trace matrix: ${rows.length} requirement(s)` +
      (matrixProducer ? ` · producer: ${matrixProducer}` : '') +
      (matrixGateStatus ? ` · matrix gate: ${matrixGateStatus}` : ''),
  );
  if (rows.length) {
    L.push('');
    L.push('| Requirement | Priority | State |');
    L.push('|---|---|---|');
    for (const r of rows) {
      const detail =
        r.state === 'not-covered'
          ? 'not covered — no mapped test (the traceability matrix already flags this)'
          : r.state === 'hollow'
            ? `covered by a test we proved hollow — ${r.tests.filter((t) => t.outcome === 'survived').map((t) => t.test).join(', ')}`
            : r.state === 'mutation-proven'
              ? 'covered and mutation-proven'
              : 'covered but unverified';
      L.push(`| ${r.id} | ${r.priority} | ${stateIcon[r.state]} ${detail} |`);
    }
  }
  L.push('');
  L.push(`${summary.mutationProven} mutation-proven · ${summary.unverified} unverified · ${summary.hollow} hollow · ${summary.notCovered} not-covered`);
  L.push('');
  if (!hasRunTrace) {
    L.push('> No audit-test run trace (`runs[]`) was available — every covered requirement above reads as unverified presence only, not proof. Pass `/audit-test --emit-json` output via `--audit-test-json` to resolve requirements past `unverified`.');
  }
  L.push('> A JOIN over an external traceability matrix + an audit-test verdict, never a risk register this repo maintains (ADR-0045) — a requirement never appears here unless the matrix itself named it. Per-test resolution covers only tests audit-test recorded a run for; a likely-hollow, baseline-lock, or never-audited test reads `unverified`, not cleared (comparisons/tea.md §3).');
  return L;
}

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
        ? `${i.result} · ${i.label}${i.stage === 'audit-test' ? runTraceNote(bundle) : ''}`
        : i.result
          ? `result=${i.result}`
          : i.rejected
            ? 'rejected (malformed/inconsistent — discarded, not the same as never sent, #2)'
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
  // Execution-completeness (#157): a PASSED suite capped at canary because it executed only a
  // sliver of what was discovered (skipped/pending dominate) — pre-#157, PASSED always proposed
  // `ship`, so this combination is otherwise unreachable and needs no dedicated field to detect,
  // same treatment `belowExaminedFloor` above already gets. Independent of the audit-test
  // credibility caveats above, so it prints alongside them rather than instead of them.
  const incompleteStages = gateEntry.predicate.inputs
    .filter((i) => EXECUTION_STAGES.has(i.stage) && i.result === 'PASSED' && i.proposed === 'canary')
    .map((i) => i.stage);
  if (incompleteStages.length) {
    L.push(`> execution incomplete: ${incompleteStages.join(' + ')} executed only a small fraction of the tests it discovered — skipped/pending dominate the report, so a green result here is not evidence the rest of the suite ran (see rationale above; #157).`);
  }
  if (d === 'ship') {
    const execStages = gateEntry.predicate.inputs.filter((i) => EXECUTION_STAGES.has(i.stage)).map((i) => i.stage);
    const suites = execStages.join(' + ') || 'the E2E suite';
    const auditEv = bundle.entries.find((e) => e.predicate?.stage === 'audit-test');
    L.push(`> \`ship\` earned: ${suites} passed and \`audit-test\` found no hollow tests among ${auditScope(auditEv)}.`);
  } else if (belowExaminedFloor) {
    const auditEv = bundle.entries.find((e) => e.predicate?.stage === 'audit-test');
    L.push(`> \`ship\` needs a *certification*-scope \`audit-test\` verdict — this run was **diagnostic**: no problems found among the suspects it examined (${auditScope(auditEv)}), which is not evidence about the rest of the suite. Run audit-test's certification mode (\`--certify\`) for a representative-breadth verdict, or re-gate with a consciously lower (but never below ${EXAMINED_FLOOR_MIN}%) \`--examined-floor\` to accept this narrower certified scope.`);
  } else if (auditOpaqueOrAbsent) {
    L.push('> `ship` needs a *parsed* confirmed-clean `audit-test` verdict to unlock — an opaque or absent `audit-test` caps credibility at `canary`. Run `/audit-test --emit-json=<path>` and pass it via `--audit-test-json` to raise the ceiling.');
  }
  L.push('> Advisory / report-first: a recommendation, not a build failure (blocking is a future opt-in, ADR-0026).');
  L.push(...renderBusinessRisk(bundle));
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
      console.log(`✓ signature valid (ed25519, self-signed) — the gate decision \`${result.attested.decision}\`, its ${result.attested.subjects.length} content-addressed subject(s) (inputs + evidence entries), and producedOn/schemaVersion are all unaltered since signing (keyid ${result.keyid}).`);
      console.log('  scope: the signature covers the whole normalized bundle — the gate Statement, the content-addressed inputs and evidence entries, and producedOn/schemaVersion (#158, ADR-0040).');
      console.log('  self-signed: proves integrity (unaltered) and continuity (same key) — not third-party identity, not Sigstore.');
    } else {
      console.log(`✗ verification failed: ${result.reason}`);
    }
    process.exit(result.valid ? 0 : 1);
  }

  const hasExec = opts.playwright || opts.cypress;
  if (flags.has('--help') || !hasExec) {
    console.log('usage: gate.mjs (--playwright=<results.json> | --cypress=<cypress-results.json>)  # ≥1 required, both allowed');
    console.log('                   [--audit-test-json=<tally.json>] [--audit-test=<report.md>] [--commit=<sha>] [--out=<bundle.json>]');
    console.log('                   [--trace-json=<trace-matrix.json>]  # OPTIONAL business-risk join (#199) — informational, never affects the decision');
    console.log(`                   [--examined-floor=<pct>]  # default ${EXAMINED_FLOOR_DEFAULT}, clamped to a ${EXAMINED_FLOOR_MIN} minimum`);
    console.log(`                   [--executed-floor=<pct>]  # default ${EXECUTED_FLOOR_DEFAULT}, clamped to a ${EXECUTED_FLOOR_MIN} minimum (#157)`);
    console.log('                   [--max-age=<minutes>]  # opt-in freshness check — no default (#3)');
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
  //
  // A read/parse failure (#4) degrades to an EMPTY entry (`playwrightEntry({})` /
  // `cypressEntry({})` both derive `EMPTY` from an empty stats object — the same, already-
  // understood "unrun report is not a pass" path #111 built) rather than crashing — worst-wins
  // then caps the whole decision at `hold`, the conservative default for evidence Gate couldn't
  // read. A warning names which flag and why; bytes are content-addressed only when the file was
  // actually readable (nothing to hash when the path itself didn't resolve). Playwright and
  // Cypress ingestion are structurally identical apart from which flag/entryFn/subject-name they
  // use, so both route through this one helper rather than repeating the read/warn/degrade shape.
  const ingestExecutionInput = (flagName, path, entryFn, subjectName) => {
    const { raw, parsed, readError } = readJsonInputForCli(path);
    if (readError) console.error(`⚠ ${flagName}=${path}: ${readError} — treating as no execution evidence (EMPTY → hold) rather than crashing.`);
    entries.push(entryFn(parsed ?? {}, { uri: path }));
    if (raw !== null) inputs.push({ name: subjectName, bytes: raw });
  };
  const entries = [];
  const inputs = [];
  if (opts.playwright) ingestExecutionInput('--playwright', opts.playwright, playwrightEntry, 'playwright-json');
  if (opts.cypress) ingestExecutionInput('--cypress', opts.cypress, cypressEntry, 'cypress-json');

  // Credibility evidence: prefer a PARSED audit-test emission (can unlock `ship`);
  // fall back to the OPAQUE Markdown report (floors at canary). A malformed emission
  // degrades to a REJECTED entry (#2 — distinct from absent) if-md-else-nothing — never
  // crash, never silently upgrade. Only bytes that actually made it into an entry are
  // content-addressed — a truly never-sent emission contributes no subject.
  const md = opts['audit-test'] ? readTextFileOrWarn(opts['audit-test'], '--audit-test') : undefined;
  const { raw: auditJsonRaw, parsed: tally } = readAndParseOptionalJson('--audit-test-json', opts['audit-test-json'], parseAuditEmission);
  if (tally) {
    entries.push(auditTestParsedEntry(tally, { markdown: md }));
    inputs.push({ name: 'audit-test-json', bytes: auditJsonRaw });
    if (md) inputs.push({ name: 'audit-test-report', bytes: md });
  } else if (auditJsonRaw) {
    // Rejected, not absent (#2): the JSON was received but failed the shape/consistency check in
    // `parseAuditEmission` — persist that as its own entry rather than only a stderr warning, and
    // content-address the rejected bytes (only a never-sent emission contributes no subject). A
    // markdown report riding alongside still rides in, as a byproduct on this SAME entry — the
    // gate only ever reads the first `audit-test`-stage entry it finds, and falling back to a
    // competing opaque entry would silently bury the rejection the same way the old code did.
    console.error('⚠ --audit-test-json is not a valid gate-audit-test emission — rejecting it (recorded as a distinct `rejected` entry, not silently dropped).');
    const rejected = auditTestRejectedEntry('shape/consistency check failed — see the gate-audit-test emission schema');
    if (md) rejected.predicate.byproducts.push({ name: 'audit-test-report', mediaType: 'text/markdown', text: md });
    entries.push(rejected);
    inputs.push({ name: 'audit-test-json', bytes: auditJsonRaw });
    if (md) inputs.push({ name: 'audit-test-report', bytes: md });
  } else if (md) {
    entries.push(auditTestEntry(md));
    inputs.push({ name: 'audit-test-report', bytes: md });
  }

  // Business-risk coverage (#199, ADR-0045) — OPTIONAL, and deliberately kept OUT of `entries`
  // here: it must never reach `gate()`'s decision loop (it is not an evidence/credibility axis,
  // it's a join reported alongside the decision). Ingest + validate now (same read/warn/degrade
  // shape as --audit-test-json, including content-addressing the rejected bytes), but the actual
  // entry is built and pushed onto `bundle.entries` AFTER the gate decision is computed, below.
  const { raw: traceJsonRaw, parsed: traceMatrix } = readAndParseOptionalJson('--trace-json', opts['trace-json'], parseTraceMatrix);
  if (traceJsonRaw) inputs.push({ name: 'trace-json', bytes: traceJsonRaw });
  if (traceJsonRaw && !traceMatrix) {
    console.error('⚠ --trace-json is not a valid gate-trace-matrix emission — rejecting it (recorded as a distinct `rejected` entry, not silently dropped).');
  }

  // Coverage-aware ship gate (#127, ADR-0035): disclose when a requested floor gets clamped,
  // the same "never silently trust it" treatment as a malformed --audit-test-json.
  const examinedFloor = resolveExaminedFloor(opts['examined-floor']);
  if (opts['examined-floor'] !== undefined && Number(opts['examined-floor']) !== examinedFloor)
    console.error(`⚠ --examined-floor=${opts['examined-floor']} is invalid or below the ${EXAMINED_FLOOR_MIN}% minimum — using ${examinedFloor}%.`);

  // Execution-completeness floor (#157) — same "never silently trust it" clamp treatment as
  // --examined-floor above.
  const executedFloor = resolveExecutedFloor(opts['executed-floor']);
  if (opts['executed-floor'] !== undefined && Number(opts['executed-floor']) !== executedFloor)
    console.error(`⚠ --executed-floor=${opts['executed-floor']} is invalid or below the ${EXECUTED_FLOOR_MIN}% minimum — using ${executedFloor}%.`);

  // Report freshness (#3, ADR-0042) — opt-in, no default (see `staleMinutes`'s comment for why). An
  // invalid value disables the check rather than guessing, same disclosure treatment as an
  // invalid floor.
  const maxAgeMinutes = resolveMaxAgeMinutes(opts['max-age']);
  if (opts['max-age'] !== undefined && maxAgeMinutes === null)
    console.error(`⚠ --max-age=${opts['max-age']} is invalid (must be a positive number of minutes) — freshness check disabled for this run.`);

  const bundle = assembleBundle({ commit: opts.commit, entries, inputs });
  const { gateEntry } = gate(bundle, { examinedFloor, executedFloor, maxAgeMinutes });
  bundle.entries.push(gateEntry);

  // Business-risk entry, added AFTER the decision (#199, ADR-0045) — never an input to `gate()`
  // above, only a record alongside it. `traceMatrix` reuses `tally` (the already-validated
  // audit-test emission, or null if absent/rejected/opaque) as its credibility side; when `tally`
  // is null or carries no `runs[]`, every mapped test resolves `unverified` rather than fabricating
  // a stronger claim than the evidence supports.
  if (traceMatrix) {
    bundle.entries.push(businessRiskEntry(traceMatrix, resolveBusinessRisk(traceMatrix, tally)));
  } else if (traceJsonRaw) {
    bundle.entries.push(businessRiskRejectedEntry('shape/consistency check failed — see the gate-trace-matrix schema'));
  }

  const errors = validateBundle(bundle);
  if (errors.length) {
    console.error('✗ bundle failed validation:\n' + errors.map((e) => '  - ' + e).join('\n'));
    process.exit(1); // a malformed bundle is a real defect, not an advisory decision
  }

  // Opt-in DSSE signing (#141, A, ADR-0037 §1) — strictly additive: with no --sign-key the
  // bundle is byte-for-byte the same unsigned shape as before this capability landed. Only the
  // CLI wrapper reads the key file; signing itself (`signGateBundle`) is pure.
  if (opts['sign-key']) {
    // A signature attests the bundle's subject[] verbatim — `pr-head` included. Signing over an
    // unresolved commit (`assembleBundle`'s `commit ?? 'unknown'` fallback) would produce a
    // verifiable-but-meaningless attestation, so refuse and degrade to unsigned rather than sign
    // a claim about the literal string "unknown" — same "never silently trust it" treatment as
    // the floor clamps and the malformed-emission fallback above.
    if (!opts.commit) {
      console.error('⚠ --sign-key requires --commit (a signed bundle must not attest an unresolved pr-head) — leaving the bundle unsigned.');
    } else {
      const privateKey = createPrivateKey(readFileSync(abs(opts['sign-key']), 'utf8'));
      bundle.dsseEnvelope = signGateBundle(bundle, gateEntry, privateKey);
      // keyid already lives on the envelope signGateBundle just produced — read it back rather than
      // re-deriving it from the public key a second time.
      console.log(`✓ signed (keyid ${bundle.dsseEnvelope.signatures[0].keyid})`);
    }
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
//
// Hardened (hostile-review finding #4, 2026-07-25): an unreadable path or malformed JSON used to
// throw uncaught here, crashing with a raw stack trace despite the file's own "advisory — NEVER
// fails the build" claim (a truncated `results.json` from a killed test runner is exactly the
// kind of input this tool exists to survive). Now returns `readError` instead of throwing; the
// caller degrades to treating the suite as EMPTY (no test results — #111's existing, already-
// understood `hold` path) rather than crashing. `raw` stays `null` only when the file couldn't be
// read at all (nothing to content-address); a file that WAS read but failed to parse still keeps
// its raw bytes, so the decision remains bound to the exact bytes it saw even when they're junk.
export function readJsonInputForCli(path) {
  let raw;
  try {
    raw = readFileSync(abs(path), 'utf8');
  } catch (err) {
    return { raw: null, parsed: null, readError: `could not read ${path} (${err.code ?? err.message})` };
  }
  try {
    return { raw, parsed: JSON.parse(raw) };
  } catch {
    return { raw, parsed: null, readError: `${path} is not valid JSON (malformed or truncated)` };
  }
}

// Same "never throw, disclose and degrade" treatment for a plain-text input file (#4): used for
// `--audit-test` (opaque Markdown) and `--audit-test-json` (the parsed emission) — a missing path
// used to throw ENOENT uncaught. Returns undefined and prints a warning instead of crashing;
// the caller already treats an undefined value as "this input wasn't given."
function readTextFileOrWarn(path, flagName) {
  try {
    return readFileSync(abs(path), 'utf8');
  } catch (err) {
    console.error(`⚠ ${flagName}=${path}: could not read (${err.code ?? err.message}) — ignoring it.`);
    return undefined;
  }
}

// Shared "read an optional flag's file (or warn+undefined), then parse-or-null" shape —
// `--audit-test-json` and `--trace-json` both start this way before their downstream handling
// diverges (audit-test decides its entry immediately; trace-json defers its entry until after
// `gate()` runs). Factored out once both call sites existed, same threshold `ingestExecutionInput`
// above was factored out at.
function readAndParseOptionalJson(flagName, path, parseFn) {
  const raw = path ? readTextFileOrWarn(path, flagName) : undefined;
  return { raw, parsed: raw ? parseFn(raw) : null };
}

// ---- certification sample-draw reproducibility (#171, ADR-0041) -----------
// Runs the EXACT documented shell one-liner from audit-test/reference/batch-mode.md — not a
// JS re-implementation of the sha256 hash-and-sort, which would risk exactly the drift this
// project exists to catch — against a checked-in triaged-ids fixture, and asserts the ordered
// output equals a checked-in golden ordering. This is the cross-machine reproducibility claim
// (any sha256 tool yields the identical digest) held to the real artifact an agent runs, not a
// re-derivation of it. Gate has nothing to do with certification's decision logic here — this
// lives in gate.mjs only because it's the repo's one CI-gated, zero-dep self-test entry point.
// "Zero external deps" (top of file) means no npm package — this is the one place the self-test
// shells out, to a POSIX coreutil (`shasum`/`sha256sum`) always present on macOS/Linux, precisely
// because testing the real shell artifact is the point (see the comment above); everything else
// in this file stays pure node:crypto/node:fs.
function extractCertifySampleCommand() {
  const doc = readFileSync(resolve(HERE, '../audit-test/reference/batch-mode.md'), 'utf8');
  const m = doc.match(/```bash\n([\s\S]*?)\n\s*```/);
  return m && m[1].includes('SEED="sentinel-certify-v0"') ? m[1] : null;
}

function runCertifySampleSelfTest(check) {
  const script = extractCertifySampleCommand();
  check('reference/batch-mode.md still contains the documented sha256 draw command (extractable)', script !== null);
  if (!script) return;

  const hasShasum = spawnSync('sh', ['-c', 'command -v shasum']).status === 0;
  const hasSha256sum = spawnSync('sh', ['-c', 'command -v sha256sum']).status === 0;
  if (!hasShasum && !hasSha256sum) {
    check('certify sample draw: a sha256 tool (shasum or sha256sum) is on PATH to run the reproducibility check', false);
    return;
  }
  // The doc pins `shasum -a 256`, but itself documents any sha256 tool as interchangeable
  // (macOS `shasum`, Linux `sha256sum`, openssl, python3, perl — batch-mode.md); substitute
  // only when `shasum` itself isn't on PATH, so a Linux CI runner without it still proves the
  // reproducibility claim rather than skipping it.
  const portableScript = hasShasum ? script : script.replace('shasum -a 256', 'sha256sum');

  const tmpDir = mkdtempSync(join(tmpdir(), 'audit-test-certify-'));
  try {
    const idsFixture = readFileSync(resolve(HERE, 'fixtures/audit-test.certify-triaged-ids.txt'), 'utf8');
    writeFileSync(join(tmpDir, 'triaged-ids.txt'), idsFixture);
    const result = spawnSync('bash', ['-c', portableScript], { cwd: tmpDir, encoding: 'utf8' });
    check('certify sample draw: the documented command runs cleanly against the fixture', result.status === 0);

    const expected = readFileSync(resolve(HERE, 'fixtures/audit-test.certify-expected-sample.txt'), 'utf8').trim();
    const actual = (result.stdout ?? '').trim();
    check('certify sample draw: seeded-order output matches the checked-in golden fixture (cross-machine reproducibility)', actual === expected);

    // `head -n N` where N = ceil(50% × audited) is the documented sample (batch-mode.md) — prove
    // the sizing formula against the same golden ordering, not just the full-population order.
    const ids = idsFixture.trim().split('\n').filter(Boolean);
    const N = Math.ceil(0.5 * ids.length);
    const sampleLines = actual.split('\n').filter(Boolean).slice(0, N);
    const expectedSampleLines = expected.split('\n').filter(Boolean).slice(0, N);
    check(`certify sample draw: head -n ${N} (ceil(50% × ${ids.length} audited)) matches the golden sample`,
      sampleLines.length === N && JSON.stringify(sampleLines) === JSON.stringify(expectedSampleLines));
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ---- CLI robustness — proving the real subprocess, not a reimplementation (#2, #4) ------------
//
// The truth-table checks above exercise `gate()`/`renderReport()` as pure functions; they never
// go through `main()`'s own file-reading code, which is exactly where finding #4's crashes lived
// (a bare `readFileSync`/`JSON.parse` with no try/catch) and where finding #2's rejected-vs-absent
// bug lived (the CLI wrapper's own branching, not `parseAuditEmission` itself, which already
// correctly returned null). Spawns the actual CLI as a child process — same pattern as
// `runCertifySampleSelfTest` above shelling out to prove the real shell artifact — so this proves
// the process genuinely exits 0 with no stack trace, not just that the right function was called.
function runCliRobustnessSelfTest(check) {
  const gatePath = resolve(HERE, 'gate.mjs');
  const tmpDir = mkdtempSync(join(tmpdir(), 'gate-cli-robustness-'));
  try {
    const run = (args) => spawnSync(process.execPath, [gatePath, ...args], { cwd: tmpDir, encoding: 'utf8' });

    // #4a — malformed/truncated playwright JSON must degrade to EMPTY → hold, never crash.
    const badPwPath = join(tmpDir, 'bad-playwright.json');
    writeFileSync(badPwPath, '{ "stats": { "expected": 1, '); // truncated — invalid JSON
    const badPwOut = join(tmpDir, 'bad-pw-bundle.json');
    const badPwResult = run([`--playwright=${badPwPath}`, '--commit=deadbeef', `--out=${badPwOut}`]);
    check('#4: a truncated playwright JSON exits 0 (never crashes the build)', badPwResult.status === 0);
    check('#4: no raw exception stack trace leaks to stderr', !/SyntaxError|at Object\.|at Module\._compile/.test(badPwResult.stderr ?? ''));
    check('#4: a warning names the flag and the fallback', /--playwright=.*treating as no execution evidence/i.test(badPwResult.stderr ?? ''));
    const badPwBundle = JSON.parse(readFileSync(badPwOut, 'utf8'));
    const badPwGateEntry = badPwBundle.entries.find((e) => e.predicate?.stage === 'gate');
    check('#4: the degraded bundle decides hold (EMPTY execution evidence, #111)', badPwGateEntry.predicate.decision === 'hold');

    // #4b — a missing --audit-test-json path must warn and fall back to absent, never crash.
    const goodPw = resolve(HERE, 'fixtures/playwright.passed.json');
    const missingAuditOut = join(tmpDir, 'missing-audit-bundle.json');
    const missingAuditResult = run([`--playwright=${goodPw}`, '--audit-test-json=' + join(tmpDir, 'does-not-exist.json'), '--commit=deadbeef', `--out=${missingAuditOut}`]);
    check('#4: a missing --audit-test-json path exits 0 (never crashes)', missingAuditResult.status === 0);
    check('#4: a warning names the missing path', /--audit-test-json=.*could not read/i.test(missingAuditResult.stderr ?? ''));
    const missingAuditBundle = JSON.parse(readFileSync(missingAuditOut, 'utf8'));
    const missingAuditInput = missingAuditBundle.entries.find((e) => e.predicate?.stage === 'gate').predicate.inputs.find((i) => i.stage === 'audit-test');
    check('#4: falls back to absent (opaque:false, not rejected) — the path was never read, not rejected', missingAuditInput.rejected === undefined && missingAuditInput.opaque === false);

    // #2 — a well-formed-JSON-but-inconsistent emission must persist as `rejected`, not `absent`.
    const rejectedJsonPath = join(tmpDir, 'rejected-audit.json');
    writeFileSync(rejectedJsonPath, JSON.stringify({ schema: 'gate-audit-test/v0.3', audited: 0, deepAudited: 0, confirmedSolid: 1, confirmedHollow: 0, likelyHollow: 0, baselineLock: 0, unexamined: 0 }));
    const rejectedOut = join(tmpDir, 'rejected-bundle.json');
    const rejectedResult = run([`--playwright=${goodPw}`, `--audit-test-json=${rejectedJsonPath}`, '--commit=deadbeef', `--out=${rejectedOut}`]);
    check('#2: a rejected audit-test-json exits 0 (advisory — never fails the build)', rejectedResult.status === 0);
    check('#2: a warning names the rejection', /is not a valid gate-audit-test emission — rejecting it/i.test(rejectedResult.stderr ?? ''));
    check('#2: the rendered report shows `rejected`, not `absent`', /audit-test.*rejected/i.test(rejectedResult.stdout ?? ''));
    const rejectedBundleOnDisk = JSON.parse(readFileSync(rejectedOut, 'utf8'));
    const rejectedEvidenceEntry = rejectedBundleOnDisk.entries.find((e) => e.predicate?.stage === 'audit-test');
    check('#2: the persisted bundle carries a distinct rejected audit-test entry (not silently dropped)', rejectedEvidenceEntry?.predicate?.verdict?.rejected === true);
    check('#2: the rejected bytes are still content-addressed into subject[] (received, not never-sent)',
      rejectedBundleOnDisk.subject.some((s) => s.name === 'audit-test-json'));
    check('#2: the bundle still validates against the current schema', validateBundle(rejectedBundleOnDisk).length === 0);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

// Business-risk coverage (#199, ADR-0045) — subprocess-level proof, same shape as
// `runCliRobustnessSelfTest` above: real CLI invocations, never crashes, degrades honestly.
function runBusinessRiskSelfTest(check) {
  const gatePath = resolve(HERE, 'gate.mjs');
  const tmpDir = mkdtempSync(join(tmpdir(), 'gate-business-risk-'));
  try {
    const run = (args) => spawnSync(process.execPath, [gatePath, ...args], { cwd: tmpDir, encoding: 'utf8' });
    const goodPw = resolve(HERE, 'fixtures/playwright.passed.json');
    const goodAudit = resolve(HERE, 'fixtures/audit-test.confirmed-with-runs.json');

    // Baseline — no --trace-json is given at all: byte-for-byte unaffected (no entry, no section).
    const noTraceOut = join(tmpDir, 'no-trace-bundle.json');
    const noTraceResult = run([`--playwright=${goodPw}`, `--audit-test-json=${goodAudit}`, '--commit=deadbeef', `--out=${noTraceOut}`]);
    const noTraceBundle = JSON.parse(readFileSync(noTraceOut, 'utf8'));
    check('#199: no --trace-json → exits 0, no business-risk entry in the bundle',
      noTraceResult.status === 0 && !noTraceBundle.entries.some((e) => e.predicate?.stage === 'business-risk'));
    check('#199: no --trace-json → no Business-risk section in the report', !/Business-risk coverage/.test(noTraceResult.stdout ?? ''));

    // A valid matrix reusing audit-test.confirmed-with-runs.json's OWN test names — one mapped
    // test that fixture recorded as SURVIVED (the presence-gap catch), one it recorded KILLED,
    // and one requirement with no test at all.
    const matrix = {
      schema: 'gate-trace-matrix/v0',
      producer: 'TEA trace v1.19.1',
      gateStatus: 'PASS',
      requirements: [
        { id: 'REQ-BOOKING-OVERLAP', priority: 'P0', status: 'FULL', tests: ['booking.spec.ts::rejects overlapping bookings'] },
        { id: 'REQ-BOOKING-ERROR-LOG', priority: 'P1', status: 'FULL', tests: ['booking.spec.ts::logs a booking error'] },
        { id: 'REQ-NO-TEST', priority: 'P2', status: 'NONE', tests: [] },
      ],
    };
    const matrixPath = join(tmpDir, 'trace-matrix.json');
    writeFileSync(matrixPath, JSON.stringify(matrix));
    const withTraceOut = join(tmpDir, 'with-trace-bundle.json');
    const withTraceResult = run([`--playwright=${goodPw}`, `--audit-test-json=${goodAudit}`, `--trace-json=${matrixPath}`, '--commit=deadbeef', `--out=${withTraceOut}`]);
    check('#199: valid --trace-json exits 0', withTraceResult.status === 0);
    const withTraceBundle = JSON.parse(readFileSync(withTraceOut, 'utf8'));
    const decisionWith = withTraceBundle.entries.find((e) => e.predicate?.stage === 'gate').predicate.decision;
    const decisionWithout = noTraceBundle.entries.find((e) => e.predicate?.stage === 'gate').predicate.decision;
    check('#199: a valid --trace-json NEVER changes the ship/canary/hold decision (ADR-0045 §3 — informational only)', decisionWith === decisionWithout);
    check('#199: the business-risk entry never appears among the gate predicate\'s OWN inputs',
      !withTraceBundle.entries.find((e) => e.predicate?.stage === 'gate').predicate.inputs.some((i) => i.stage === 'business-risk'));
    const businessRiskEv = withTraceBundle.entries.find((e) => e.predicate?.stage === 'business-risk');
    check('#199: the bundle carries a distinct business-risk entry', businessRiskEv !== undefined);
    check('#199: THE presence-gap catch survives end-to-end — the hollow-logged-error requirement reads hollow, not covered',
      businessRiskEv.predicate.rollup.rows.find((r) => r.id === 'REQ-BOOKING-ERROR-LOG').state === 'hollow');
    check('#199: the mutation-proven requirement reads mutation-proven',
      businessRiskEv.predicate.rollup.rows.find((r) => r.id === 'REQ-BOOKING-OVERLAP').state === 'mutation-proven');
    check('#199: the NONE-status requirement reads not-covered', businessRiskEv.predicate.rollup.rows.find((r) => r.id === 'REQ-NO-TEST').state === 'not-covered');
    check('#199: the rendered report carries the Business-risk coverage section', /## Business-risk coverage/.test(withTraceResult.stdout ?? ''));
    check('#199: the report names the hollow row by its mapped test', /logs a booking error/.test(withTraceResult.stdout ?? ''));
    check('#199: content-addressed — trace-json bytes land in subject[]', withTraceBundle.subject.some((s) => s.name === 'trace-json'));
    check('#199: the bundle still validates against the current schema', validateBundle(withTraceBundle).length === 0);

    // --trace-json + --sign-key together (ADR-0040 §158's entry-digest-binding widened the DSSE
    // payload to cover every parsed evidence entry, not just the gate predicate) — the business-risk
    // entry must ride into that same binding, and tampering with it after signing must be caught,
    // exactly like tampering with any other evidence entry already is.
    const demoKey = resolve(HERE, 'fixtures/gate-signing-key.demo.pem');
    const demoPub = createPublicKey(readFileSync(resolve(HERE, 'fixtures/gate-signing-key.demo.pub.pem'), 'utf8'));
    const signedTraceOut = join(tmpDir, 'signed-trace-bundle.json');
    const signedTraceResult = run([`--playwright=${goodPw}`, `--audit-test-json=${goodAudit}`, `--trace-json=${matrixPath}`, '--commit=deadbeef', `--sign-key=${demoKey}`, `--out=${signedTraceOut}`]);
    check('#199: --trace-json + --sign-key exits 0 and signs', signedTraceResult.status === 0 && /✓ signed/.test(signedTraceResult.stdout ?? ''));
    const signedTraceBundle = JSON.parse(readFileSync(signedTraceOut, 'utf8'));
    check('#199: the signed bundle verifies against the demo public key', verifyGateBundle(signedTraceBundle, demoPub).valid === true);
    const tamperedTraceBundle = JSON.parse(JSON.stringify(signedTraceBundle));
    tamperedTraceBundle.entries.find((e) => e.predicate?.stage === 'business-risk').predicate.rollup.summary.hollow = 0;
    check('#199: tampering with the business-risk entry AFTER signing is caught (it rides into the #158 entry-digest binding)',
      verifyGateBundle(tamperedTraceBundle, demoPub).valid === false);

    // Missing path — warn, never crash, degrades to absent (no entry at all), never rejected.
    const missingTraceOut = join(tmpDir, 'missing-trace-bundle.json');
    const missingTraceResult = run([`--playwright=${goodPw}`, '--trace-json=' + join(tmpDir, 'does-not-exist.json'), '--commit=deadbeef', `--out=${missingTraceOut}`]);
    check('#199: a missing --trace-json path exits 0 (never crashes)', missingTraceResult.status === 0);
    check('#199: a warning names the missing path', /--trace-json=.*could not read/i.test(missingTraceResult.stderr ?? ''));
    check('#199: a missing path falls back to absent — no business-risk entry at all',
      !JSON.parse(readFileSync(missingTraceOut, 'utf8')).entries.some((e) => e.predicate?.stage === 'business-risk'));

    // Malformed/inconsistent matrix — rejected, not absent, same distinct-state treatment #2 gave audit-test.
    const rejectedMatrixPath = join(tmpDir, 'rejected-trace.json');
    writeFileSync(rejectedMatrixPath, JSON.stringify({ schema: 'gate-trace-matrix/v0', requirements: [{ id: 'X', priority: 'P0', status: 'FULL', tests: [] }] }));
    const rejectedTraceOut = join(tmpDir, 'rejected-trace-bundle.json');
    const rejectedTraceResult = run([`--playwright=${goodPw}`, `--trace-json=${rejectedMatrixPath}`, '--commit=deadbeef', `--out=${rejectedTraceOut}`]);
    check('#199: a rejected --trace-json exits 0 (advisory — never fails the build)', rejectedTraceResult.status === 0);
    check('#199: a warning names the rejection', /is not a valid gate-trace-matrix emission — rejecting it/i.test(rejectedTraceResult.stderr ?? ''));
    check('#199: the rendered report shows the rejection, not silence', /trace-json was rejected/.test(rejectedTraceResult.stdout ?? ''));
    const rejectedTraceBundle = JSON.parse(readFileSync(rejectedTraceOut, 'utf8'));
    const rejectedBrEntry = rejectedTraceBundle.entries.find((e) => e.predicate?.stage === 'business-risk');
    check('#199: the persisted bundle carries a distinct rejected business-risk entry (not silently dropped)', rejectedBrEntry?.predicate?.rejected === true);
    check('#199: the rejected bytes are still content-addressed (received, not never-sent)', rejectedTraceBundle.subject.some((s) => s.name === 'trace-json'));
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
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

  // ---- REJECTED audit-test-json — a distinct state from absent/opaque (#2, hostile-review
  // finding #2, 2026-07-25). Same `canary` ceiling as absent (decision unchanged, honesty guard
  // #1 intact) but must be DISCLOSED as its own thing, not silently rendered as "absent."
  const rejectedBundle = (pw) =>
    assembleBundle({
      commit: 'deadbeef',
      entries: [...(pw ? [mkPw(pw)] : []), auditTestRejectedEntry('arithmetically impossible tally')],
    });
  const rejectedGate = gate(rejectedBundle('PASSED'));
  check('PASSED + rejected audit-test-json → canary (same ceiling as absent)', rejectedGate.decision === 'canary');
  const rejectedInput = rejectedGate.gateEntry.predicate.inputs.find((i) => i.stage === 'audit-test');
  check('rejected entry is marked `rejected: true` on the gate predicate — NOT `opaque` and NOT absent',
    rejectedInput?.rejected === true && rejectedInput?.opaque === undefined && rejectedInput?.result === undefined);
  check('rejected rationale names the rejection, not "absent"',
    rejectedGate.gateEntry.predicate.rationale.some((r) => /rejected/.test(r) && !/no-credibility-evidence/.test(r)));
  const rejectedEntries = rejectedBundle('PASSED').entries;
  rejectedEntries.push(rejectedGate.gateEntry);
  const rejectedReport = renderReport({ ...rejectedBundle('PASSED'), entries: rejectedEntries }, rejectedGate.gateEntry);
  const rejectedInputsLine = rejectedReport.split('\n').find((l) => l.startsWith('- `audit-test`'));
  check('rendered report shows `rejected`, not `absent`, in the Inputs list', /rejected/.test(rejectedInputsLine) && !/absent/.test(rejectedInputsLine));
  check('a rejected gate entry still validates (no numeric field, valid decision)', validateGateEntry(rejectedGate.gateEntry).length === 0);

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

  // ---- certification mode (#171, ADR-0038 1b / ADR-0041) — Gate needs NO new logic: a
  // certification run is just a bigger deepAudited on the SAME suite. Fixture-backed, per the
  // issue's own AC #18 ("both in the golden self-test, proven not asserted").
  const certifyTally = parseAuditEmission(readFileSync(resolve(HERE, 'fixtures/audit-test.certify-floor-clearing.json'), 'utf8'));
  const diagnosticTally = parseAuditEmission(readFileSync(resolve(HERE, 'fixtures/audit-test.diagnostic-below-floor.json'), 'utf8'));
  check('fixture: audit-test.certify-floor-clearing.json parses cleanly', certifyTally !== null);
  check('fixture: audit-test.diagnostic-below-floor.json parses cleanly', diagnosticTally !== null);
  check('same-suite pair: both fixtures audit the identical population (audited count matches)', certifyTally?.audited === diagnosticTally?.audited);
  check('#171: a certification tally on a healthy suite clears the floor → ship', decideF('PASSED', certifyTally) === 'ship');
  check('#171: a diagnostic tally on the SAME suite (suspects-only) stays below the floor → canary — ship-vs-canary proven, not asserted',
    decideF('PASSED', diagnosticTally) === 'canary');

  // Honesty row (ADR-0041, "the surprising call"): a flagged suspect that's ALSO drawn into the
  // certification sample keeps its 🟡 — routing is on the triage smell, not the run mode — so
  // certification can never launder a real suspicion signal into a clean count, even when the
  // sample ∪ suspects union otherwise clears the floor.
  const certifyLaundersSuspect = { audited: 12, deepAudited: 6, confirmedSolid: 5, confirmedHollow: 0, likelyHollow: 1, baselineLock: 0, unexamined: 6 };
  check('#171 honesty row: a floor-clearing certify tally (deepAudited/audited = 50%) carrying one sampled-suspect 🟡 still derives WARNED',
    deriveAuditResult(certifyLaundersSuspect) === 'WARNED');
  check('#171 honesty row: WARNED overrides a cleared floor → canary, never ship (a suspect cannot be laundered into a clean count)',
    decideF('PASSED', certifyLaundersSuspect) === 'canary');

  // Secondary seam — the documented sha256 draw command reproduces the checked-in golden sample.
  runCertifySampleSelfTest(check);

  // ---- business-risk coverage join (#199, ADR-0045) — pure-function truth table -------------
  const mkMatrix = (requirements, extra = {}) => ({ schema: 'gate-trace-matrix/v0', requirements, ...extra });
  const validMatrix = mkMatrix(
    [
      { id: 'REQ-1', priority: 'P0', status: 'FULL', tests: ['booking.spec.ts::rejects overlapping bookings'] },
      { id: 'REQ-2', priority: 'P0', status: 'FULL', tests: ['booking.spec.ts::confirms a valid booking'] },
      { id: 'REQ-3', priority: 'P1', status: 'PARTIAL', tests: ['booking.spec.ts::shows the cancellation fee'] },
      { id: 'REQ-4', priority: 'P2', status: 'NONE', tests: [] },
    ],
    { producer: 'TEA trace v1.19.1', gateStatus: 'PASS' },
  );
  check('parseTraceMatrix: a well-formed matrix parses', parseTraceMatrix(JSON.stringify(validMatrix))?.requirements.length === 4);
  check('parseTraceMatrix: wrong schema string is rejected (exact match, not a prefix, #111\'s precedent)',
    parseTraceMatrix(JSON.stringify({ ...validMatrix, schema: 'gate-trace-matrix/v999' })) === null);
  check('parseTraceMatrix: malformed JSON is rejected, not thrown', parseTraceMatrix('{ not json') === null);
  check('parseTraceMatrix: a FULL row with no tests is an arithmetically impossible row → rejected',
    parseTraceMatrix(JSON.stringify(mkMatrix([{ id: 'X', priority: 'P0', status: 'FULL', tests: [] }]))) === null);
  check('parseTraceMatrix: a NONE row WITH a test is an arithmetically impossible row → rejected',
    parseTraceMatrix(JSON.stringify(mkMatrix([{ id: 'X', priority: 'P0', status: 'NONE', tests: ['a.spec.ts::t'] }]))) === null);
  check('parseTraceMatrix: a duplicate requirement id is rejected', parseTraceMatrix(JSON.stringify(mkMatrix([
    { id: 'X', priority: 'P0', status: 'FULL', tests: ['a.spec.ts::t'] },
    { id: 'X', priority: 'P1', status: 'FULL', tests: ['b.spec.ts::t'] },
  ]))) === null);
  check('parseTraceMatrix: an invalid priority is rejected',
    parseTraceMatrix(JSON.stringify(mkMatrix([{ id: 'X', priority: 'P9', status: 'FULL', tests: ['a.spec.ts::t'] }]))) === null);
  check('parseTraceMatrix: an empty requirements array is valid — never synthesizes a row to fill the table',
    parseTraceMatrix(JSON.stringify(mkMatrix([])))?.requirements.length === 0);

  const parsedValidMatrix = parseTraceMatrix(JSON.stringify(validMatrix));
  const rollupClean = resolveBusinessRisk(parsedValidMatrix, {
    runs: [
      { test: 'booking.spec.ts::rejects overlapping bookings', outcome: 'killed' },
      { test: 'booking.spec.ts::confirms a valid booking', outcome: 'killed' },
    ],
  });
  check('resolveBusinessRisk: a requirement whose every mapped test was killed → mutation-proven',
    rollupClean.rows.find((r) => r.id === 'REQ-1').state === 'mutation-proven');
  check('resolveBusinessRisk: a requirement with no run-trace evidence at all → unverified (never fabricated proof)',
    rollupClean.rows.find((r) => r.id === 'REQ-3').state === 'unverified');
  check('resolveBusinessRisk: a NONE-status requirement → not-covered, excluded from the 3-state summary',
    rollupClean.rows.find((r) => r.id === 'REQ-4').state === 'not-covered');
  check('resolveBusinessRisk: summary tallies match the rows',
    rollupClean.summary.mutationProven === 2 && rollupClean.summary.unverified === 1 && rollupClean.summary.hollow === 0 && rollupClean.summary.notCovered === 1);

  // THE presence-gap catch (comparisons/tea.md §3): a requirement whose only test SURVIVED a
  // mutation must read hollow, never covered — this is the entire reason #199 exists.
  const rollupHollow = resolveBusinessRisk(parsedValidMatrix, {
    runs: [
      { test: 'booking.spec.ts::rejects overlapping bookings', outcome: 'survived' },
      { test: 'booking.spec.ts::confirms a valid booking', outcome: 'killed' },
    ],
  });
  check('resolveBusinessRisk: THE presence-gap catch — a requirement whose only test survived a mutation reads hollow, not covered (comparisons/tea.md §3)',
    rollupHollow.rows.find((r) => r.id === 'REQ-1').state === 'hollow');

  const twoTestMatrix = parseTraceMatrix(JSON.stringify(mkMatrix([
    { id: 'REQ-5', priority: 'P0', status: 'FULL', tests: ['a.spec.ts::one', 'a.spec.ts::two'] },
  ])));
  const rollupMixed = resolveBusinessRisk(twoTestMatrix, {
    runs: [
      { test: 'a.spec.ts::one', outcome: 'killed' },
      { test: 'a.spec.ts::two', outcome: 'survived' },
    ],
  });
  check('resolveBusinessRisk: worst-wins across a requirement\'s own mapped tests — one hollow test among several still makes the requirement hollow',
    rollupMixed.rows[0].state === 'hollow');

  const rollupNoTally = resolveBusinessRisk(parsedValidMatrix, null);
  check('resolveBusinessRisk: null tally (audit-test absent/rejected) → hasRunTrace false, every covered requirement unverified',
    rollupNoTally.hasRunTrace === false && rollupNoTally.rows.filter((r) => r.state !== 'not-covered').every((r) => r.state === 'unverified'));

  // CLI robustness — proves the real subprocess never crashes and persists rejected-vs-absent
  // correctly (#2, #4), not just that the underlying pure functions behave.
  runCliRobustnessSelfTest(check);

  // Business-risk CLI robustness (#199) — same subprocess-level proof: --trace-json never
  // crashes, degrades honestly (absent vs rejected), and — the load-bearing guarantee — never
  // changes the ship/canary/hold decision it rides alongside.
  runBusinessRiskSelfTest(check);

  const belowFloorBundle = assembleBundle({ commit: 'x', entries: [mkPw('PASSED'), auditTestParsedEntry(T.confirmedBelowFloor)] });
  const belowFloorGate = gate(belowFloorBundle);
  belowFloorBundle.entries.push(belowFloorGate.gateEntry);
  const belowFloorReport = renderReport(belowFloorBundle, belowFloorGate.gateEntry);
  check('below-floor report names the examined-floor and #127 in its rationale', /examined-floor/.test(belowFloorReport) && /#127/.test(belowFloorReport));
  check('below-floor report carries no manufactured number outside prose', !/\bconfidence\b\s*[:=]\s*\d/i.test(belowFloorReport));

  // ---- execution-completeness floor (#157): a PASSED suite that executed only a sliver of what
  // it discovered must not launder into `ship` — the disclosed exploit (`expected:1, skipped:999`)
  // and its Cypress analog (`totalPending`/`totalSkipped`), plus disclosure + the override/clamp.
  check('resolveExecutedFloor: default when unset', resolveExecutedFloor(undefined) === EXECUTED_FLOOR_DEFAULT);
  check('resolveExecutedFloor: clamps below the 25% minimum', resolveExecutedFloor(10) === EXECUTED_FLOOR_MIN);
  check('resolveExecutedFloor: clamps above 100', resolveExecutedFloor(150) === 100);
  check('resolveExecutedFloor: passes a valid override through', resolveExecutedFloor(30) === 30);
  check('resolveExecutedFloor: invalid input falls back to default', resolveExecutedFloor('not-a-number') === EXECUTED_FLOOR_DEFAULT);

  const nearAllSkippedPw = playwrightEntry({ stats: { expected: 1, unexpected: 0, flaky: 0, skipped: 999 } });
  const nearAllSkippedBundle = assembleBundle({ commit: 'x', entries: [nearAllSkippedPw, auditTestParsedEntry(T.confirmedClean)] });
  const nearAllSkippedGate = gate(nearAllSkippedBundle);
  nearAllSkippedBundle.entries.push(nearAllSkippedGate.gateEntry);
  check("#157 THE FIX: playwright expected:1,skipped:999 + confirmed-clean audit → canary, not ship (the issue's own exploit)",
    nearAllSkippedGate.decision === 'canary');
  check('#157: the capped-at-canary gate entry still validates against the unchanged schema (no new field needed, honesty guard #3 intact)',
    validateGateEntry(nearAllSkippedGate.gateEntry).length === 0);
  const nearAllSkippedReport = renderReport(nearAllSkippedBundle, nearAllSkippedGate.gateEntry);
  check('#157: rationale surfaces executed-vs-skipped counts (not just buried in metrics)',
    /1 of 1000 discovered tests/.test(nearAllSkippedReport) && /999 skipped/.test(nearAllSkippedReport));
  check('#157: report names execution incomplete + the issue number', /execution incomplete/.test(nearAllSkippedReport) && /#157/.test(nearAllSkippedReport));

  // Disclosure applies to EVERY execution suite, not only one that gets capped — a clean 0%-skipped
  // PASSED run still states its executed/discovered scope, and a WARNED (flaky) run does too.
  const cleanPwGate = gate(assembleBundle({ commit: 'x', entries: [mkPw('PASSED'), auditTestParsedEntry(T.confirmedClean)] }));
  check('#157: a fully-executed PASSED suite still states its executed/discovered scope (disclosure, not just the exploit case)',
    cleanPwGate.gateEntry.predicate.rationale.some((r) => /12 of 12 discovered tests executed/.test(r)));
  const warnedWithSkipsGate = gate(assembleBundle({ commit: 'x', entries: [playwrightEntry({ stats: { expected: 10, unexpected: 0, flaky: 1, skipped: 5 } })] }));
  check('#157: a WARNED suite also states executed/discovered scope (surfaced for every execution suite, per the AC)',
    warnedWithSkipsGate.gateEntry.predicate.rationale.some((r) => /discovered tests executed/.test(r)));

  // --executed-floor override + clamp — same "never silently trust it" treatment as --examined-floor.
  const mostlySkippedPw = playwrightEntry({ stats: { expected: 4, unexpected: 0, flaky: 0, skipped: 6 } }); // 4-of-10 = 40%
  const mostlySkippedBundle = assembleBundle({ commit: 'x', entries: [mostlySkippedPw, auditTestParsedEntry(T.confirmedClean)] });
  check('executed-floor: a 40%-executed run is capped at canary under the default 50% floor',
    gate(mostlySkippedBundle).decision === 'canary');
  check('executed-floor override: lowering to 25% lets the 40%-executed run ship (a conscious, disclosed choice)',
    gate(mostlySkippedBundle, { executedFloor: 25 }).decision === 'ship');

  const veryLowExecPw = playwrightEntry({ stats: { expected: 1, unexpected: 0, flaky: 0, skipped: 99 } }); // 1-of-100 = 1%
  const veryLowExecBundle = assembleBundle({ commit: 'x', entries: [veryLowExecPw, auditTestParsedEntry(T.confirmedClean)] });
  check('executed-floor: requesting a 10% floor is clamped to the 25% minimum — a 1%-executed run still cannot ship',
    gate(veryLowExecBundle, { executedFloor: 10 }).decision === 'canary');

  const exactHalfPw = playwrightEntry({ stats: { expected: 5, unexpected: 0, flaky: 0, skipped: 5 } }); // exactly 50%
  const exactHalfBundle = assembleBundle({ commit: 'x', entries: [exactHalfPw, auditTestParsedEntry(T.confirmedClean)] });
  check('executed-floor: a run at exactly the floor (50%) ships — inclusive boundary',
    gate(exactHalfBundle).decision === 'ship');

  // Cypress analog — `totalPending`/`totalSkipped` dominate the same way `skipped` does for Playwright.
  const nearAllSkippedCy = cypressEntry({ totalTests: 1000, totalPassed: 1, totalFailed: 0, totalPending: 999, totalSkipped: 0, runs: [] });
  check('#157 exploit (Cypress totalPending): totalPassed:1,totalPending:999 + confirmed-clean audit → canary, not ship',
    gate(assembleBundle({ commit: 'x', entries: [nearAllSkippedCy, auditTestParsedEntry(T.confirmedClean)] })).decision === 'canary');
  const nearAllSkippedCy2 = cypressEntry({ totalTests: 1000, totalPassed: 1, totalFailed: 0, totalPending: 0, totalSkipped: 999, runs: [] });
  check('#157 exploit (Cypress totalSkipped): totalPassed:1,totalSkipped:999 + confirmed-clean audit → canary, not ship',
    gate(assembleBundle({ commit: 'x', entries: [nearAllSkippedCy2, auditTestParsedEntry(T.confirmedClean)] })).decision === 'canary');

  // Regression guard: the existing fixture-backed ship path (0 skipped) is unaffected by #157.
  check('executed-floor: a fully-executed suite (0 skipped) still ships — no regression on the existing ship path',
    gate(assembleBundle({ commit: 'x', entries: [mkPw('PASSED'), auditTestParsedEntry(T.confirmedClean)] })).decision === 'ship');

  // ---- report freshness — opt-in via --max-age (#3, hostile-review finding #3, 2026-07-25, ADR-0042).
  // Compares an execution entry's own `producer.startedOn` against the BUNDLE's `producedOn` —
  // both already-captured fields, so this stays a pure function of the bundle (no wall-clock
  // read inside `gate()` itself).
  const freshPw = playwrightEntry({ stats: { expected: 12, unexpected: 0, flaky: 0, skipped: 0, startTime: '2026-07-20T12:00:00.000Z' } });
  const staleBundleAt = (producedOn) => {
    const b = assembleBundle({ commit: 'x', entries: [freshPw, auditTestParsedEntry(T.confirmedClean)] });
    b.producedOn = producedOn;
    return b;
  };
  check('--max-age unset (default): a report started long before the bundle was produced still ships — no check unless requested',
    gate(staleBundleAt('2026-07-21T12:00:00.000Z')).decision === 'ship');
  check('--max-age=60: a report started 24h before the bundle was produced is capped at canary (stale)',
    gate(staleBundleAt('2026-07-21T12:00:00.000Z'), { maxAgeMinutes: 60 }).decision === 'canary');
  check('--max-age=60: a report started 30min before the bundle was produced still ships (within the window)',
    gate(staleBundleAt('2026-07-20T12:30:00.000Z'), { maxAgeMinutes: 60 }).decision === 'ship');
  check('--max-age: an entry with no recorded startedOn is unaffected either way (nothing to check, not flagged stale)',
    gate(assembleBundle({ commit: 'x', entries: [mkPw('PASSED'), auditTestParsedEntry(T.confirmedClean)] }), { maxAgeMinutes: 1 }).decision === 'ship');
  // A malformed timestamp string (either side) can't be compared — same "nothing to check" treatment as a
  // missing startedOn, not a crash and not a false-positive staleness flag.
  const malformedStartPw = playwrightEntry({ stats: { expected: 12, unexpected: 0, flaky: 0, skipped: 0, startTime: 'not-a-timestamp' } });
  check('--max-age: a malformed startedOn string is unaffected (unparseable, not flagged stale)',
    gate(assembleBundle({ commit: 'x', entries: [malformedStartPw, auditTestParsedEntry(T.confirmedClean)] }), { maxAgeMinutes: 1 }).decision === 'ship');
  const malformedProducedBundle = staleBundleAt('also-not-a-timestamp');
  check('--max-age: a malformed bundle.producedOn is unaffected (unparseable, not flagged stale)',
    gate(malformedProducedBundle, { maxAgeMinutes: 1 }).decision === 'ship');
  check('resolveMaxAgeMinutes: unset → null (no check)', resolveMaxAgeMinutes(undefined) === null);
  check('resolveMaxAgeMinutes: invalid input → null (disables rather than guesses)', resolveMaxAgeMinutes('not-a-number') === null);
  check('resolveMaxAgeMinutes: a valid override passes through', resolveMaxAgeMinutes('60') === 60);
  const staleRationale = gate(staleBundleAt('2026-07-21T12:00:00.000Z'), { maxAgeMinutes: 60 }).gateEntry.predicate.rationale;
  check('stale rationale names the staleness and the #3 issue', staleRationale.some((r) => /stale/i.test(r) && /--max-age/.test(r)));

  // #111 — empty/impossible evidence can never ship (the two disclosed exploits, defeated)
  const emptyPw = playwrightEntry({}); // `{}` → EMPTY
  check('empty Playwright report alone → hold (not a pass)', gate(assembleBundle({ commit: 'x', entries: [emptyPw] })).decision === 'hold');
  check('exploit: empty {} Playwright + parsed confirmed-clean → hold (empty exec dominates, never ship)',
    gate(assembleBundle({ commit: 'x', entries: [emptyPw, auditTestParsedEntry(T.confirmedClean)] })).decision === 'hold');
  check('exploit: impossible {confirmedSolid:1,deepAudited:0} emission is rejected (never derives confirmed)',
    parseAuditEmission(JSON.stringify({ schema: AUDIT_EMISSION_SCHEMA, audited: 0, deepAudited: 0, confirmedSolid: 1, confirmedHollow: 0, likelyHollow: 0, baselineLock: 0, unexamined: 0 })) === null);

  // ---- `scope` passthrough (#171, ADR-0038) — disclosure-only, never read for the decision ----
  const scopedEmission = JSON.stringify({ schema: AUDIT_EMISSION_SCHEMA, scope: 'certify(floor=50%) · --changed (12 of ~180 suite test files)', ...T.confirmedClean });
  const scopedTally = parseAuditEmission(scopedEmission);
  check('scope: a string scope on the emission is passed through to the parsed tally', scopedTally?.scope === 'certify(floor=50%) · --changed (12 of ~180 suite test files)');
  check('scope: a non-string scope rejects the whole emission (never trust it blind)',
    parseAuditEmission(JSON.stringify({ schema: AUDIT_EMISSION_SCHEMA, scope: 123, ...T.confirmedClean })) === null);
  check('scope: absent scope leaves the tally unaffected (purely additive)', parseAuditEmission(JSON.stringify({ schema: AUDIT_EMISSION_SCHEMA, ...T.confirmedClean })).scope === undefined);
  const scopedGate = gate(assembleBundle({ commit: 'x', entries: [mkPw('PASSED'), auditTestParsedEntry(scopedTally)] }));
  const scopedReport = renderReport(
    { ...assembleBundle({ commit: 'x', entries: [mkPw('PASSED'), auditTestParsedEntry(scopedTally)] }), entries: [mkPw('PASSED'), auditTestParsedEntry(scopedTally), scopedGate.gateEntry] },
    scopedGate.gateEntry,
  );
  check('scope: gate decision is unaffected by scope (disclosure only, honesty guard #1 intact)', scopedGate.decision === 'ship');
  check('scope: the reported scope string reaches GATE\'s own rendered report (the disclosure gap this closes)',
    scopedReport.includes('reported scope: "certify(floor=50%) · --changed (12 of ~180 suite test files)"'));

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

  // Canonicalization (#158, ADR-0040): recursive key-sort is stable across insertion order and
  // idempotent (canonicalizing an already-sorted structure changes nothing), and a genuinely
  // different structure canonicalizes differently.
  check('canonicalize: key order does not affect the result', canonicalize({ a: 1, b: 2 }) === canonicalize({ b: 2, a: 1 }));
  check('canonicalize: idempotent', canonicalize({ a: 1, b: 2 }) === canonicalize(JSON.parse(canonicalize({ a: 1, b: 2 }))));
  check('canonicalize: a real content change canonicalizes differently', canonicalize({ a: 1 }) !== canonicalize({ a: 2 }));

  // entrySubjects (#158, ADR-0040): one subject per parsed EVIDENCE entry (never the gate entry
  // itself), named `entry:<stage>`, digest-bound over the canonicalized entry.
  const pwEntry = mkPw('PASSED');
  const auditEntryForSubjects = auditTestParsedEntry(T.confirmedClean);
  const { gateEntry: subjGateEntry } = gate(assembleBundle({ commit: 'x', entries: [pwEntry, auditEntryForSubjects] }));
  const subjects = entrySubjects([pwEntry, auditEntryForSubjects, subjGateEntry]);
  check('entrySubjects: one subject per non-gate entry, named entry:<stage>', subjects.length === 2
    && subjects[0].name === 'entry:playwright' && subjects[1].name === 'entry:audit-test');
  check('entrySubjects: the gate entry itself is excluded', !subjects.some((s) => s.name === 'entry:gate'));
  const mutatedPw = JSON.parse(JSON.stringify(pwEntry));
  mutatedPw.predicate.verdict.result = 'FAILED';
  check('entrySubjects: editing an entry changes its digest (same name, different bytes)',
    entrySubjects([mutatedPw])[0].digest.sha256 !== entrySubjects([pwEntry])[0].digest.sha256);

  // Bundle-level signing pairs A with B1/B2 (ADR-0037 sequencing, widened #158/ADR-0040): the
  // signed payload is the bundle's `subject` (pr-head + the #139 input digests + the #158 entry
  // digests) PLUS `producedOn`/`schemaVersion` PLUS the gate predicate — the signature now covers
  // the whole normalized bundle a reader sees, not just the decision.
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

  // A valid result reports the WIDENED scope it attests (#158, ADR-0040) — the decision + every
  // subject name it covers, now including entry digests alongside the pr-head/input digests — so
  // a caller (and the --verify CLI message) can state the scope precisely.
  const attested = verifyGateBundle(signBundle, pkA).attested;
  check('verifyGateBundle: a valid result reports the attested decision + subject names, including entries',
    attested.decision === 'ship' && attested.subjects.includes('pr-head') && attested.subjects.includes('playwright-json')
      && attested.subjects.includes('entry:playwright') && attested.subjects.includes('entry:audit-test'));

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

  // #158/ADR-0040's own exploit, reproduced as self-test rows: the displayed EVIDENCE ENTRY, and
  // the surrounding producedOn/schemaVersion, are now all in the signed scope, closing exactly the
  // gap the issue verified (flip a Playwright PASSED entry to FAILED post-signing → old code's
  // --verify still exited 0; this must now fail).
  const entryTampered = JSON.parse(JSON.stringify(signBundle));
  const tamperedPwEntry = entryTampered.entries.find((e) => e.predicate?.stage === 'playwright');
  tamperedPwEntry.predicate.verdict.result = 'FAILED';
  tamperedPwEntry.predicate.verdict.metrics.find((m) => m.name === 'unexpected').value = 999;
  check('verifyGateBundle: an EVIDENCE ENTRY edited after signing (PASSED → FAILED) → invalid (the #158 exploit, closed)',
    verifyGateBundle(entryTampered, pkA).valid === false);

  const producedOnTampered = JSON.parse(JSON.stringify(signBundle));
  producedOnTampered.producedOn = '2000-01-01T00:00:00.000Z';
  check('verifyGateBundle: producedOn edited after signing → invalid (#158)',
    verifyGateBundle(producedOnTampered, pkA).valid === false);

  const schemaVersionTampered = JSON.parse(JSON.stringify(signBundle));
  schemaVersionTampered.schemaVersion = 'gate-evidence-bundle/v0.5'; // the downgrade attack
  check('verifyGateBundle: schemaVersion edited after signing → invalid (downgrade-resistant, #158)',
    verifyGateBundle(schemaVersionTampered, pkA).valid === false);

  check('verifyGateBundle: the untouched signed bundle still verifies (no false positives from the widened scope)',
    verifyGateBundle(signBundle, pkA).valid === true);

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

  // ---- non-empty run-record content (#171 review) — a bare `typeof === 'string'` check let a
  // blank `test`/`mutation`/`command` through, diluting `runsVerified` with content-free rows.
  check('parseAuditEmission: a run record with an empty `test` string → rejected',
    parseAuditEmission(JSON.stringify({ schema: 'gate-audit-test/v0.3', ...T.confirmedClean, runs: [...killedRuns(3), { test: '', mutation: 'm', command: 'c', outcome: 'killed', exitCode: 1 }] })) === null);
  check('parseAuditEmission: a run record with an empty `mutation` string → rejected',
    parseAuditEmission(JSON.stringify({ schema: 'gate-audit-test/v0.3', ...T.confirmedClean, runs: [...killedRuns(3), { test: 't3', mutation: '', command: 'c', outcome: 'killed', exitCode: 1 }] })) === null);
  check('parseAuditEmission: a run record with an empty `command` string → rejected',
    parseAuditEmission(JSON.stringify({ schema: 'gate-audit-test/v0.3', ...T.confirmedClean, runs: [...killedRuns(3), { test: 't3', mutation: 'm', command: '', outcome: 'killed', exitCode: 1 }] })) === null);

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

  // ---- run-trace VISIBILITY in the rendered report (#5, hostile-review finding #5, 2026-07-25).
  // Two ship verdicts of materially different evidential weight (a cross-checked run trace vs a
  // bare tally) used to print identically apart from an input digest — prove they now don't.
  const withRunsBundle = assembleBundle({ commit: 'x', entries: [mkPw('PASSED'), withRunsEntry] });
  const withRunsDecision = gate(withRunsBundle);
  withRunsBundle.entries.push(withRunsDecision.gateEntry);
  const withRunsReport = renderReport(withRunsBundle, withRunsDecision.gateEntry);
  check('report with a run trace states the record count was cross-checked', /4 run records cross-checked/i.test(withRunsReport));

  const noRunsBundle = assembleBundle({ commit: 'x', entries: [mkPw('PASSED'), noRunsEntry] });
  const noRunsDecision = gate(noRunsBundle);
  noRunsBundle.entries.push(noRunsDecision.gateEntry);
  const noRunsReport = renderReport(noRunsBundle, noRunsDecision.gateEntry);
  check('report with NO run trace discloses the absence, not silence', /no run trace carried/i.test(noRunsReport));
  check('the two ship reports read differently (not typographically identical apart from the digest)', withRunsReport !== noRunsReport);

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
