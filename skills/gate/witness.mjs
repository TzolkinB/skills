#!/usr/bin/env node
// Witness — the deterministic core of the Gate skill (Sentinel stage 7).
//
// Ingests the evidence a PR already produced (E2E execution evidence — a Playwright
// JSON report and/or a Cypress Module API result — plus an audit-test verdict, either a
// PARSED emission or an opaque Markdown report), binds it into one readable evidence
// bundle (in-toto Statements over one subject — the PR head commit), and derives a
// categorical, advisory release decision — `ship | canary | hold` — by worst-wins
// (ordinal min under hold < canary < ship).
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
//   node witness.mjs (--playwright=<results.json> | --cypress=<cypress-results.json>) \
//                    [--audit-test-json=<tally.json>] [--audit-test=<report.md>] \
//                    [--commit=<sha>] [--out=<bundle.json>]   # ≥1 execution report; both allowed
//   node witness.mjs --self-test        # golden truth-table gate (deterministic)

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

// ---- constants (witness:// namespace everywhere — plugin-neutral, contract Q9) ----
const SCHEMA_VERSION = 'witness-evidence-bundle/v0.1'; // v0.1 = v0 (LOCKED, #102) + ADDITIVE `EMPTY` execution result (#111, ADR-0031)
const STATEMENT_TYPE = 'https://in-toto.io/Statement/v1';
const EVIDENCE_PREDICATE = 'https://witness.local/evidence/qa-stage/v0';
const GATE_PREDICATE = 'https://witness.local/gate/v0';
const RANK = { hold: 0, canary: 1, ship: 2 }; // worst-wins ordinal: hold < canary < ship
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
    producer: { id: 'witness://playwright@1.x', startedOn: stats.startTime },
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
    producer: { id: 'witness://cypress@1.x', startedOn: result.startedTestsAt },
    verdict: { result: deriveCypressResult(result), metrics },
    byproducts: [{ name: 'cypress-json', uri, mediaType: 'application/json' }],
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
const AUDIT_EMISSION_SCHEMA = 'witness-audit-test/v0'; // exact match — the published schema pins `schema` to this const
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
  // Exact schema version, not a prefix (#111): `startsWith('witness-audit-test/')` let a bogus
  // `witness-audit-test/v999` through; the published schema pins `schema` to a const.
  if (obj.schema !== AUDIT_EMISSION_SCHEMA) return null;
  const tally = {};
  for (const k of AUDIT_COUNTS) {
    const v = Number(obj[k] ?? 0);
    if (!Number.isFinite(v) || v < 0 || !Number.isInteger(v)) return null;
    tally[k] = v;
  }
  // Cross-field consistency (#111): reject an arithmetically impossible tally rather than silently
  // deriving `proven` from it. A model produced these counts, so `{provenSolid:1, deepAudited:0}`
  // must not slip through. These are the counts' own definitions, not a trust/authenticity check:
  //   • every triaged test is either deep-audited or not →  audited === deepAudited + unexamined
  //   • each outcome class is a subset of the deep audits →  Σ(outcomes) ≤ deepAudited
  const outcomes = tally.provenSolid + tally.provenHollow + tally.likelyHollow + tally.baselineLock;
  if (tally.deepAudited + tally.unexamined !== tally.audited) return null;
  if (outcomes > tally.deepAudited) return null;
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

// Human-readable scope of an audit-test verdict, drawn from the evidence entry's own metrics
// (#112): `ship` proves only the DEEP-AUDITED subset, so the rationale/report must say how much
// of the suite that was and how much rode along `unexamined` (not evidence of health). Returns a
// plain string — the digits live in prose, never as a numeric field in the gate predicate.
function auditScope(auditEntry) {
  const m = Object.fromEntries((auditEntry?.predicate?.verdict?.metrics ?? []).map((x) => [x.name, x.value]));
  if (m.deepAudited === undefined || m.audited === undefined) return 'the deep-audited subset';
  return `the deep-audited subset (${m.deepAudited} of ${m.audited} triaged tests mutation-audited; ${m.unexamined ?? 0} unexamined — not evidence of health)`;
}

export function gate(bundle) {
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
        ? `audit-test PASSED + proven → ship-eligible — no hollow tests among ${auditScope(audit)}`
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
  L.push(`## Gate decision: ${icon} ${d.toUpperCase()}  ·  advisory (did not fail the build)`);
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
    const execStages = gateEntry.predicate.inputs.filter((i) => EXECUTION_STAGES.has(i.stage)).map((i) => i.stage);
    const suites = execStages.join(' + ') || 'the E2E suite';
    const auditEv = bundle.entries.find((e) => e.predicate?.stage === 'audit-test');
    L.push(`> \`ship\` earned: ${suites} passed and \`audit-test\` found no hollow tests among ${auditScope(auditEv)}.`);
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

  const hasExec = opts.playwright || opts.cypress;
  if (flags.has('--help') || !hasExec) {
    console.log('usage: witness.mjs (--playwright=<results.json> | --cypress=<cypress-results.json>)  # ≥1 required, both allowed');
    console.log('                   [--audit-test-json=<tally.json>] [--audit-test=<report.md>] [--commit=<sha>] [--out=<bundle.json>]');
    console.log('       witness.mjs --self-test');
    process.exit(hasExec ? 0 : 2);
  }

  // Execution evidence: Playwright JSON report and/or Cypress Module API result. At least
  // one is required; both may be present (worst-wins across them in the gate).
  const entries = [];
  if (opts.playwright) {
    const report = JSON.parse(readFileSync(abs(opts.playwright), 'utf8'));
    entries.push(playwrightEntry(report, { uri: opts.playwright }));
  }
  if (opts.cypress) {
    const cyResult = JSON.parse(readFileSync(abs(opts.cypress), 'utf8'));
    entries.push(cypressEntry(cyResult, { uri: opts.cypress }));
  }

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

  // #111 — empty/impossible evidence can never ship (the two disclosed exploits, defeated)
  const emptyPw = playwrightEntry({}); // `{}` → EMPTY
  check('empty Playwright report alone → hold (not a pass)', gate(assembleBundle({ commit: 'x', entries: [emptyPw] })).decision === 'hold');
  check('exploit: empty {} Playwright + parsed proven-clean → hold (empty exec dominates, never ship)',
    gate(assembleBundle({ commit: 'x', entries: [emptyPw, auditTestParsedEntry(T.provenClean)] })).decision === 'hold');
  check('exploit: impossible {provenSolid:1,deepAudited:0} emission is rejected (never derives proven)',
    parseAuditEmission(JSON.stringify({ schema: AUDIT_EMISSION_SCHEMA, audited: 0, deepAudited: 0, provenSolid: 1, provenHollow: 0, likelyHollow: 0, baselineLock: 0, unexamined: 0 })) === null);

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
  check('cypress PASSED + parsed proven-clean → ship', decideCy('passed', T.provenClean) === 'ship');
  check('cypress WARNED(flaky) + parsed proven-clean → canary', decideCy('flaky', T.provenClean) === 'canary');
  check('cypress FAILED + parsed proven-clean → hold', decideCy('failed', T.provenClean) === 'hold');
  check('cypress PASSED + opaque audit → canary', gate(bundleWith([mkCy('passed'), auditTestEntry('# opaque')])).decision === 'canary');
  check('cypress-only, no audit → canary (credibility floor still applies)', gate(bundleWith([mkCy('passed')])).decision === 'canary');

  // Both frameworks present — worst-wins across execution suites (a green PW can't hide a red CY)
  check('playwright PASSED + cypress FAILED → hold (worst-wins across suites)', gate(bundleWith([mkPw('PASSED'), mkCy('failed'), auditTestParsedEntry(T.provenClean)])).decision === 'hold');
  check('playwright PASSED + cypress WARNED → canary', gate(bundleWith([mkPw('PASSED'), mkCy('flaky'), auditTestParsedEntry(T.provenClean)])).decision === 'canary');
  check('playwright PASSED + cypress PASSED + parsed proven → ship (both suites green)', gate(bundleWith([mkPw('PASSED'), mkCy('passed'), auditTestParsedEntry(T.provenClean)])).decision === 'ship');
  check('ship unreachable while ANY execution suite is not green', gate(bundleWith([mkPw('PASSED'), mkCy('failed'), auditTestParsedEntry(T.provenClean)])).decision !== 'ship');

  // end-to-end from Cypress fixture files → bundle → gate → full-bundle validation
  const cyPassed = JSON.parse(readFileSync(resolve(HERE, 'fixtures/cypress.passed.json'), 'utf8'));
  const cyFlaky = JSON.parse(readFileSync(resolve(HERE, 'fixtures/cypress.flaky.json'), 'utf8'));
  const cyFailed = JSON.parse(readFileSync(resolve(HERE, 'fixtures/cypress.failed.json'), 'utf8'));
  check('fixture: cypress.passed.json → PASSED', deriveCypressResult(cyPassed) === 'PASSED');
  check('fixture: cypress.flaky.json → WARNED (a real failed attempt, derived)', deriveCypressResult(cyFlaky) === 'WARNED' && countCypressFlaky(cyFlaky) === 1);
  check('fixture: cypress.failed.json → FAILED', deriveCypressResult(cyFailed) === 'FAILED');
  const cyShip = bundleWith([cypressEntry(cyPassed), auditTestParsedEntry(T.provenClean)]);
  const gCyShip = gate(cyShip);
  cyShip.entries.push(gCyShip.gateEntry);
  check('fixture e2e: cypress PASSED + parsed proven-clean → ship', gCyShip.decision === 'ship');
  check('fixture e2e: cypress ship bundle validates', validateBundle(cyShip).length === 0);
  check('fixture e2e: cypress ship report names the suite', /cypress/i.test(renderReport(cyShip, gCyShip.gateEntry)));

  // emission robustness — a model produced it, so never trust it blind
  check('parseAuditEmission: rejects non-JSON', parseAuditEmission('not json {') === null);
  check('parseAuditEmission: rejects missing/foreign schema', parseAuditEmission(JSON.stringify({ provenSolid: 1 })) === null);
  check('parseAuditEmission: rejects a negative count', parseAuditEmission(JSON.stringify({ schema: 'witness-audit-test/v0', provenSolid: -1 })) === null);
  check('parseAuditEmission: rejects a fractional count', parseAuditEmission(JSON.stringify({ schema: 'witness-audit-test/v0', provenSolid: 1.5 })) === null);
  check('parseAuditEmission: accepts a well-formed emission', parseAuditEmission(JSON.stringify({ schema: 'witness-audit-test/v0', ...T.provenClean })) !== null);
  // #111 — exact schema version (not a prefix) + cross-field consistency
  check('parseAuditEmission: rejects a bogus version (v999 — exact match, not prefix)', parseAuditEmission(JSON.stringify({ schema: 'witness-audit-test/v999', ...T.provenClean })) === null);
  check('parseAuditEmission: rejects impossible provenSolid>deepAudited', parseAuditEmission(JSON.stringify({ schema: 'witness-audit-test/v0', audited: 0, deepAudited: 0, provenSolid: 1, provenHollow: 0, likelyHollow: 0, baselineLock: 0, unexamined: 0 })) === null);
  check('parseAuditEmission: rejects audited≠deepAudited+unexamined', parseAuditEmission(JSON.stringify({ schema: 'witness-audit-test/v0', audited: 12, deepAudited: 4, provenSolid: 4, provenHollow: 0, likelyHollow: 0, baselineLock: 0, unexamined: 0 })) === null);

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
  check('ship report states examined/unexamined scope (#112)', /deep-audited subset/i.test(shipReport) && /unexamined/i.test(shipReport));
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
