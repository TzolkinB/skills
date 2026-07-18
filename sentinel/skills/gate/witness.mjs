#!/usr/bin/env node
// Witness — the deterministic core of the Gate skill (Sentinel stage 7).
//
// Ingests the evidence a PR already produced (a Playwright JSON report + an
// audit-test verdict — either a PARSED emission or an opaque Markdown report),
// binds it into one readable evidence bundle (in-toto Statements over one subject —
// the PR head commit), and derives a categorical, advisory release decision —
// `ship | canary | hold` — by worst-wins (ordinal min under hold < canary < ship).
// It appends its reasoning back into the bundle as a `witness.local/gate/v0` entry
// that shows its work, carries NO number anywhere, and NEVER fails the build
// (advisory / report-first).
//
// `ship` is reachable ONLY when Playwright PASSED and a PARSED audit-test verdict is
// execution-proven clean (`PASSED`+`proven`) — the B→A graduation (TzolkinB/skills#49).
// An opaque or absent audit-test still caps credibility at `canary`, and a parsed run
// that examined nothing derives `unexamined` → also canary (theater guard).
//
// This is DETERMINISTIC CODE, not model judgment: the same bundle always yields
// the same decision (a release gate must be reproducible). The SKILL.md
// orchestrates by running it. Contract v0 = TzolkinB/skills#102; gate spec v0 =
// #103; parsed audit-test = #49 (ADR-0029). Zero external deps by design.
//
// Usage:
//   node witness.mjs --playwright=<results.json> \
//                    [--audit-test-json=<tally.json>] [--audit-test=<report.md>] \
//                    [--commit=<sha>] [--out=<bundle.json>]
//   node witness.mjs --self-test        # golden truth-table gate (deterministic)

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

// ---- constants (witness:// namespace everywhere — plugin-neutral, contract Q9) ----
const SCHEMA_VERSION = 'witness-evidence-bundle/v0';
const STATEMENT_TYPE = 'https://in-toto.io/Statement/v1';
const EVIDENCE_PREDICATE = 'https://witness.local/evidence/qa-stage/v0';
const GATE_PREDICATE = 'https://witness.local/gate/v0';
const RANK = { hold: 0, canary: 1, ship: 2 }; // worst-wins ordinal: hold < canary < ship

// ---- ingest: Playwright (mechanical fact-restatement, contract v0) ----------

// stats.unexpected > 0 → FAILED; else stats.flaky > 0 → WARNED; else PASSED.
// `flaky` NEVER appears in `unexpected` — it must be read explicitly.
export function deriveResult(stats = {}) {
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
    producer: { id: 'witness://playwright@1.x', startedOn: stats.startTime },
    verdict: { result: deriveResult(stats), metrics }, // raw counts only; NO confidence (Q6)
    byproducts: [{ name: 'playwright-json', uri, mediaType: 'application/json' }],
    annotations: {},
  });
}

// ---- ingest: audit-test (opaque — no prose scraping; Markdown rides inline) --

export function auditTestEntry(markdown) {
  return statement(EVIDENCE_PREDICATE, {
    stage: 'audit-test',
    producer: { id: 'witness://audit-test@0.x' },
    verdict: {}, // opaque: no result/label/metrics parsed from prose (contract Q7)
    byproducts: [{ name: 'audit-test-report', mediaType: 'text/markdown', text: markdown }],
    annotations: {},
  });
}

// ---- ingest: audit-test (PARSED — the B→A graduation, TzolkinB/skills#49) -----
//
// `/audit-test --emit-json` writes its batch provenance tally as structured data
// (the per-class COUNTS — the model's judgment crystallised into numbers). Witness
// ingests those counts and DERIVES the category (result + label) mechanically —
// exactly as `deriveResult` restates Playwright's `stats`. The gate downstream
// reads only the derived CATEGORY, never these counts (honesty guard #1). Deriving
// the label HERE (not trusting a skill-supplied label) is what makes the theater
// guard structural: a run that deep-audited nothing derives `unexamined` → the gate
// floors it at canary, so a parsed-but-vacuous audit still cannot reach `ship`.
const AUDIT_COUNTS = ['audited', 'deepAudited', 'provenSolid', 'provenHollow', 'likelyHollow', 'baselineLock', 'unexamined'];

// Any proven-hollow test is a proven credibility FAILURE; a likely-hollow or a
// baseline-lock is a WARNING (short of proof / a caution); otherwise PASSED.
export function deriveAuditResult(t = {}) {
  if (Number(t.provenHollow ?? 0) > 0) return 'FAILED';
  if (Number(t.likelyHollow ?? 0) > 0 || Number(t.baselineLock ?? 0) > 0) return 'WARNED';
  return 'PASSED';
}

// Proof-grade of the roll-up: `proven` if any deep audit was EXECUTION-proven (a
// killed or a hollow mutation), `likely` if deep audits ran but only by reasoning
// (env not runnable), `unexamined` if nothing left triage. Only `PASSED`+`proven`
// unlocks `ship` — so an audit that examined nothing is never ship-eligible.
export function deriveAuditLabel(t = {}) {
  if (Number(t.provenSolid ?? 0) > 0 || Number(t.provenHollow ?? 0) > 0) return 'proven';
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
  if (typeof obj.schema !== 'string' || !obj.schema.startsWith('witness-audit-test/')) return null;
  const tally = {};
  for (const k of AUDIT_COUNTS) {
    const v = Number(obj[k] ?? 0);
    if (!Number.isFinite(v) || v < 0 || !Number.isInteger(v)) return null;
    tally[k] = v;
  }
  return tally;
}

export function auditTestParsedEntry(tally, { markdown } = {}) {
  const metrics = AUDIT_COUNTS.map((n) => ({ name: n, value: Number(tally[n] ?? 0) }));
  const byproducts = markdown ? [{ name: 'audit-test-report', mediaType: 'text/markdown', text: markdown }] : [];
  return statement(EVIDENCE_PREDICATE, {
    stage: 'audit-test',
    producer: { id: 'witness://audit-test@0.x' },
    verdict: { result: deriveAuditResult(tally), label: deriveAuditLabel(tally), metrics },
    byproducts,
    annotations: {},
  });
}

function statement(predicateType, predicate) {
  return { _type: STATEMENT_TYPE, predicateType, subject: [], predicate };
}

// ---- assemble --------------------------------------------------------------

export function assembleBundle({ commit, entries, producedOn }) {
  return {
    schemaVersion: SCHEMA_VERSION,
    subject: [{ name: 'pr-head', digest: { gitCommit: commit ?? 'unknown' } }],
    producedOn: producedOn ?? new Date().toISOString(),
    entries,
  };
}

// ---- gate: worst-wins ordinal min (gate spec v0) ---------------------------

export function gate(bundle) {
  const entries = bundle.entries ?? [];
  const stageOf = (e) => e.predicate?.stage;
  const known = new Set(['playwright', 'audit-test', 'gate']);
  const pw = entries.find((e) => stageOf(e) === 'playwright');
  const audit = entries.find((e) => stageOf(e) === 'audit-test');

  const inputs = [];
  const rationale = [];

  // Playwright axis
  if (!pw) {
    inputs.push({ stage: 'playwright', proposed: 'hold' });
    rationale.push('no playwright entry → hold (no execution evidence)');
  } else {
    const result = pw.predicate?.verdict?.result ?? 'FAILED';
    const proposed = result === 'FAILED' ? 'hold' : result === 'WARNED' ? 'canary' : 'ship';
    inputs.push({ stage: 'playwright', result, proposed });
    rationale.push(
      result === 'FAILED'
        ? 'playwright FAILED → hold (execution failed — dominates)'
        : result === 'WARNED'
          ? 'playwright WARNED (flaky) → canary (a trust defect, not buried under a note)'
          : 'playwright PASSED → ship-baseline',
    );
  }

  // Credibility axis. A PARSED audit-test verdict (result+label, both categories the
  // ingest derived) can propose `ship` — but ONLY when it is execution-proven clean
  // (`PASSED`+`proven`); anything less proposes `canary`. An OPAQUE or ABSENT audit
  // both floor at `canary`, so there is no "run less, grade better" incentive and a
  // bare green Playwright run can never launder into `ship` (theater guard).
  const auditResult = audit?.predicate?.verdict?.result;
  if (audit && auditResult) {
    const label = audit.predicate.verdict.label;
    const proposed = auditResult === 'PASSED' && label === 'proven' ? 'ship' : 'canary';
    inputs.push({ stage: 'audit-test', result: auditResult, label, proposed });
    rationale.push(
      proposed === 'ship'
        ? 'audit-test PASSED + proven → ship-eligible (execution-proven clean: deep audits ran, no hollow tests)'
        : auditResult === 'FAILED'
          ? 'audit-test FAILED (proven false-confidence) → canary (a hollow test — fix it; not a red build)'
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
    producer: { id: 'witness://gate@0.x' },
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
  L.push(`## Witness — Gate decision: ${icon} ${d.toUpperCase()}  ·  advisory (did not fail the build)`);
  L.push('');
  L.push(`subject: pr-head \`${bundle.subject?.[0]?.digest?.gitCommit ?? 'unknown'}\`  ·  ${bundle.entries.length} entries`);
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
  // `ship` is reachable now (the B→A graduation), but only via a parsed proven-clean
  // audit-test. An opaque/absent audit-test still caps credibility at `canary`.
  const audit = gateEntry.predicate.inputs.find((i) => i.stage === 'audit-test');
  const auditOpaqueOrAbsent = audit && !('label' in audit);
  if (d === 'ship') {
    L.push('> `ship` earned: Playwright passed and `audit-test` is execution-proven clean (deep audits ran, no hollow tests).');
  } else if (auditOpaqueOrAbsent) {
    L.push('> `ship` needs a *parsed* proven-clean `audit-test` verdict to unlock — an opaque or absent `audit-test` caps credibility at `canary`. Run `/audit-test --emit-json=<path>` and pass it via `--audit-test-json` to raise the ceiling.');
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

  if (flags.has('--help') || !opts.playwright) {
    console.log('usage: witness.mjs --playwright=<results.json> [--audit-test-json=<tally.json>] [--audit-test=<report.md>] [--commit=<sha>] [--out=<bundle.json>]');
    console.log('       witness.mjs --self-test');
    process.exit(opts.playwright ? 0 : 2);
  }

  const report = JSON.parse(readFileSync(abs(opts.playwright), 'utf8'));
  const entries = [playwrightEntry(report, { uri: opts.playwright })];

  // Credibility evidence: prefer a PARSED audit-test emission (can unlock `ship`);
  // fall back to the OPAQUE Markdown report (floors at canary). A malformed emission
  // degrades to opaque-if-md-else-absent — never crash, never silently upgrade.
  const md = opts['audit-test'] ? readFileSync(abs(opts['audit-test']), 'utf8') : undefined;
  const tally = opts['audit-test-json'] ? parseAuditEmission(readFileSync(abs(opts['audit-test-json']), 'utf8')) : null;
  if (opts['audit-test-json'] && !tally)
    console.error(`⚠ --audit-test-json is not a valid witness-audit-test emission — ignoring it (falling back to ${md ? 'the opaque report' : 'no credibility evidence'}).`);
  if (tally) entries.push(auditTestParsedEntry(tally, { markdown: md }));
  else if (md) entries.push(auditTestEntry(md));

  const bundle = assembleBundle({ commit: opts.commit, entries });
  const { gateEntry } = gate(bundle);
  bundle.entries.push(gateEntry);

  const errors = validateBundle(bundle);
  if (errors.length) {
    console.error('✗ bundle failed validation:\n' + errors.map((e) => '  - ' + e).join('\n'));
    process.exit(1); // a malformed bundle is a real defect, not an advisory decision
  }

  const out = opts.out ?? 'witness-bundle.json';
  writeFileSync(abs(out), JSON.stringify(bundle, null, 2) + '\n');
  console.log(renderReport(bundle, gateEntry));
  console.log(`\nBundle written to ${out}`);
  process.exit(0); // advisory — the decision NEVER fails the build (Q1)
}

function abs(p) {
  return isAbsolute(p) ? p : resolve(process.cwd(), p);
}

// ---- golden truth-table self-test (deterministic, offline, zero-dep) -------

function runSelfTest() {
  const R = [];
  const check = (name, cond) => R.push({ name, ok: !!cond });

  // deriveResult
  check('deriveResult: unexpected>0 → FAILED', deriveResult({ unexpected: 2, flaky: 0 }) === 'FAILED');
  check('deriveResult: flaky>0 → WARNED (read explicitly)', deriveResult({ unexpected: 0, flaky: 1 }) === 'WARNED');
  check('deriveResult: clean → PASSED', deriveResult({ unexpected: 0, flaky: 0 }) === 'PASSED');
  check('deriveResult: flaky not masked by expected count', deriveResult({ expected: 10, unexpected: 0, flaky: 3 }) === 'WARNED');

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
  const T = {
    provenClean:     { audited: 12, deepAudited: 4, provenSolid: 4, provenHollow: 0, likelyHollow: 0, baselineLock: 0, unexamined: 8 },
    provenHollow:    { audited: 12, deepAudited: 4, provenSolid: 3, provenHollow: 1, likelyHollow: 0, baselineLock: 0, unexamined: 8 },
    likely:          { audited: 12, deepAudited: 2, provenSolid: 1, provenHollow: 0, likelyHollow: 1, baselineLock: 0, unexamined: 10 },
    baselineLock:    { audited: 12, deepAudited: 2, provenSolid: 1, provenHollow: 0, likelyHollow: 0, baselineLock: 1, unexamined: 10 },
    examinedNothing: { audited: 12, deepAudited: 0, provenSolid: 0, provenHollow: 0, likelyHollow: 0, baselineLock: 0, unexamined: 12 },
    inconclusive:    { audited: 0, deepAudited: 0, provenSolid: 0, provenHollow: 0, likelyHollow: 0, baselineLock: 0, unexamined: 0 },
  };
  check('deriveAuditResult: provenHollow>0 → FAILED', deriveAuditResult(T.provenHollow) === 'FAILED');
  check('deriveAuditResult: likelyHollow>0 → WARNED', deriveAuditResult(T.likely) === 'WARNED');
  check('deriveAuditResult: baselineLock>0 → WARNED', deriveAuditResult(T.baselineLock) === 'WARNED');
  check('deriveAuditResult: clean → PASSED', deriveAuditResult(T.provenClean) === 'PASSED');
  check('deriveAuditLabel: proven-solid → proven', deriveAuditLabel(T.provenClean) === 'proven');
  check('deriveAuditLabel: proven-hollow is still execution-proven', deriveAuditLabel(T.provenHollow) === 'proven');
  check('deriveAuditLabel: examined nothing → unexamined', deriveAuditLabel(T.examinedNothing) === 'unexamined');

  const decideP = (pw, tally) =>
    gate(assembleBundle({ commit: 'deadbeef', entries: [...(pw ? [mkPw(pw)] : []), auditTestParsedEntry(tally)] })).decision;

  check('PASSED + parsed proven-clean → ship (THE UNLOCK)', decideP('PASSED', T.provenClean) === 'ship');
  check('WARNED + parsed proven-clean → canary (worst-wins)', decideP('WARNED', T.provenClean) === 'canary');
  check('FAILED + parsed proven-clean → hold (worst-wins)', decideP('FAILED', T.provenClean) === 'hold');
  check('PASSED + parsed proven-HOLLOW → canary (fix the test, not a red build)', decideP('PASSED', T.provenHollow) === 'canary');
  check('PASSED + parsed WARNED(likely) → canary', decideP('PASSED', T.likely) === 'canary');
  check('PASSED + parsed WARNED(baseline-lock) → canary', decideP('PASSED', T.baselineLock) === 'canary');
  check('PASSED + parsed examined-nothing → canary (THEATER GUARD)', decideP('PASSED', T.examinedNothing) === 'canary');
  check('PASSED + parsed inconclusive → canary', decideP('PASSED', T.inconclusive) === 'canary');

  // ship-reachability invariant — ship IFF playwright PASSED AND parsed PASSED+proven
  const shipElsewhere = [
    decideP('WARNED', T.provenClean), decideP('FAILED', T.provenClean),
    decideP('PASSED', T.provenHollow), decideP('PASSED', T.likely), decideP('PASSED', T.baselineLock),
    decideP('PASSED', T.examinedNothing), decideP('PASSED', T.inconclusive),
    decide('PASSED', true), decide('PASSED', false), // opaque + absent never ship
  ];
  check('ship reachable ONLY via playwright PASSED + parsed proven-clean', decideP('PASSED', T.provenClean) === 'ship' && !shipElsewhere.includes('ship'));

  // emission robustness — a model produced it, so never trust it blind
  check('parseAuditEmission: rejects non-JSON', parseAuditEmission('not json {') === null);
  check('parseAuditEmission: rejects missing/foreign schema', parseAuditEmission(JSON.stringify({ provenSolid: 1 })) === null);
  check('parseAuditEmission: rejects a negative count', parseAuditEmission(JSON.stringify({ schema: 'witness-audit-test/v0', provenSolid: -1 })) === null);
  check('parseAuditEmission: rejects a fractional count', parseAuditEmission(JSON.stringify({ schema: 'witness-audit-test/v0', provenSolid: 1.5 })) === null);
  check('parseAuditEmission: accepts a well-formed emission', parseAuditEmission(JSON.stringify({ schema: 'witness-audit-test/v0', ...T.provenClean })) !== null);

  // honesty guard #3 — clean validates; a smuggled number is rejected. Holds for the
  // PARSED path too: the audit label/result are string categories, so the raw counts
  // stay in the evidence entry and never leak a number into the gate predicate.
  const clean = gate(bundleOf('PASSED', true)).gateEntry;
  check('clean gate entry validates', validateGateEntry(clean).length === 0);
  const dirty = JSON.parse(JSON.stringify(clean));
  dirty.predicate.confidence = 0.85; // smuggle a number
  check('numeric field in gate predicate is rejected', validateGateEntry(dirty).length > 0);
  check('gate entry shows its work (every input has `proposed`)', clean.predicate.inputs.every((i) => 'proposed' in i));
  const parsedGate = gate(assembleBundle({ commit: 'x', entries: [mkPw('PASSED'), auditTestParsedEntry(T.provenClean)] })).gateEntry;
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

  // end-to-end SHIP path from fixture files — PASSED Playwright + parsed proven-clean audit-test
  const passedRep = JSON.parse(readFileSync(resolve(HERE, 'fixtures/playwright.passed.json'), 'utf8'));
  const provenTally = parseAuditEmission(readFileSync(resolve(HERE, 'fixtures/audit-test.proven.json'), 'utf8'));
  check('fixture: audit-test.proven.json is a valid emission', provenTally !== null);
  const shipB = assembleBundle({ commit: 'fixture', entries: [playwrightEntry(passedRep), auditTestParsedEntry(provenTally)] });
  const gShip = gate(shipB);
  shipB.entries.push(gShip.gateEntry);
  check('fixture e2e: PASSED + parsed proven-clean → ship', gShip.decision === 'ship');
  check('fixture e2e: ship bundle validates', validateBundle(shipB).length === 0);
  const shipReport = renderReport(shipB, gShip.gateEntry);
  check('ship report says ship earned', /`ship` earned/i.test(shipReport));
  check('ship report carries no manufactured number', !/\bconfidence\b\s*[:=]\s*\d/i.test(shipReport));

  const passed = R.every((r) => r.ok);
  console.log('witness.mjs gate self-test:');
  for (const r of R) console.log(`  ${r.ok ? '✓' : '✗'} ${r.name}`);
  console.log(passed ? '→ OK (gate is deterministic + honest)\n' : '→ BROKEN\n');
  return passed;
}

// Run main only as a CLI, never when imported by a test.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}
