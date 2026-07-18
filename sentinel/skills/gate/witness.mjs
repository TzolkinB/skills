#!/usr/bin/env node
// Witness — the deterministic core of the Gate skill (Sentinel stage 7).
//
// Ingests the evidence a PR already produced (a Playwright JSON report + an
// optional audit-test Markdown report), binds it into one readable evidence
// bundle (in-toto Statements over one subject — the PR head commit), and derives
// a categorical, advisory release decision — `ship | canary | hold` — by
// worst-wins (ordinal min under hold < canary < ship). It appends its reasoning
// back into the bundle as a `witness.local/gate/v0` entry that shows its work,
// carries NO number anywhere, and NEVER fails the build (advisory / report-first).
//
// This is DETERMINISTIC CODE, not model judgment: the same bundle always yields
// the same decision (a release gate must be reproducible). The SKILL.md
// orchestrates by running it. Contract v0 = TzolkinB/skills#102; gate spec v0 =
// #103; both LOCKED. Zero external deps by design (like the eval harness).
//
// Usage:
//   node witness.mjs --playwright=<results.json> [--audit-test=<report.md>] \
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

  // Credibility axis — opaque audit-test presence OR absence both floor at canary,
  // so there is no "run less, grade better" incentive (theater guard).
  if (audit) {
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
    const detail = i.ignored ? 'ignored (unrecognized stage)' : i.result ? `result=${i.result}` : i.opaque ? 'present but opaque (unread)' : 'absent';
    L.push(`- \`${i.stage}\` — ${detail} → proposes **${i.proposed ?? '—'}**`);
  }
  L.push('');
  L.push('### Rationale');
  for (const r of gateEntry.predicate.rationale) L.push(`- ${r}`);
  L.push('');
  if (d !== 'ship')
    L.push('> `ship` is unreachable in v0 by design: Witness cannot machine-confirm test trustworthiness while `audit-test` is opaque, so the honest ceiling is `canary`. A parsed audit-test verdict (the B→A graduation) unlocks `ship`.');
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
    console.log('usage: witness.mjs --playwright=<results.json> [--audit-test=<report.md>] [--commit=<sha>] [--out=<bundle.json>]');
    console.log('       witness.mjs --self-test');
    process.exit(opts.playwright ? 0 : 2);
  }

  const report = JSON.parse(readFileSync(abs(opts.playwright), 'utf8'));
  const entries = [playwrightEntry(report, { uri: opts.playwright })];
  if (opts['audit-test']) entries.push(auditTestEntry(readFileSync(abs(opts['audit-test']), 'utf8')));

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

  // The full contract-v0 truth table
  check('FAILED + audit → hold', decide('FAILED', true) === 'hold');
  check('FAILED + no-audit → hold', decide('FAILED', false) === 'hold');
  check('PASSED + audit → canary (human-must-read)', decide('PASSED', true) === 'canary');
  check('PASSED + no-audit → canary (no-credibility-evidence)', decide('PASSED', false) === 'canary');
  check('WARNED + audit → canary', decide('WARNED', true) === 'canary');
  check('WARNED + no-audit → canary', decide('WARNED', false) === 'canary');
  check('no-playwright entry → hold', decide(null, true) === 'hold');
  check('empty bundle → hold', gate(assembleBundle({ commit: 'x', entries: [] })).decision === 'hold');

  // ship is UNREACHABLE in v0 — no combination yields it
  const all = [
    decide('FAILED', true), decide('FAILED', false), decide('PASSED', true), decide('PASSED', false),
    decide('WARNED', true), decide('WARNED', false), decide(null, true),
    gate(assembleBundle({ commit: 'x', entries: [] })).decision,
  ];
  check('ship never emitted in v0', !all.includes('ship'));

  // honesty guard #3 — clean validates; a smuggled number is rejected
  const clean = gate(bundleOf('PASSED', true)).gateEntry;
  check('clean gate entry validates', validateGateEntry(clean).length === 0);
  const dirty = JSON.parse(JSON.stringify(clean));
  dirty.predicate.confidence = 0.85; // smuggle a number
  check('numeric field in gate predicate is rejected', validateGateEntry(dirty).length > 0);
  check('gate entry shows its work (every input has `proposed`)', clean.predicate.inputs.every((i) => 'proposed' in i));

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
