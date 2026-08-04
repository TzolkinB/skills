#!/usr/bin/env node
// tea-to-trace-matrix — the last mile between a TEA `trace` run and Gate's `--trace-json`
// (TzolkinB/skills#220, ADR-0050).
//
// #199 shipped Gate's business-risk join: `--trace-json` reads a requirement->test matrix in
// Gate's OWN minimal shape (`gate-trace-matrix/v0`) and joins it against an `audit-test`
// emission's `runs[]` to resolve each requirement to mutation-proven / unverified / hollow /
// not-covered. What it did NOT ship is the conversion: pointing that join at a real TEA run
// meant hand-authoring the JSON, and a skill that asks for hand-authored input is a skill nobody
// runs. This script is that conversion, and nothing else.
//
// WHAT IT READS — and why it is JSON, not Markdown (ADR-0050). Verified against the
// `bmad-testarch-trace` workflow SOURCE at v1.21.4 (2026-08-04), re-checking #199's own v1.19.1
// reading. TEA writes four artifacts; only one carries per-requirement rows AND per-test identity:
//
//   * `e2e-trace-summary.json` (step-05 §3b) — aggregates only: coverage.inventory,
//     priority_breakdown, by_level, tests{files,cases,...}. No requirement rows.
//   * `gate-decision.json` (step-05 §3b) — gate signal only: gate_status + p0/p1/overall status.
//   * `traceability-matrix.md` (step-03/05) — has the rows, but its `Detailed Mapping` section
//     (trace-template.md) identifies each mapped test as ``id`` - `file`:`line`, with **no test
//     title anywhere**. Gate's join key is `<file>::<title>`, so a key built from that section
//     would have to be fabricated, or guessed by reading whatever happens to sit at a line number
//     that drifts on the next edit. A wrong key joins to nothing and renders "unverified" — a
//     silent, confident lie about coverage. So this script never parses that body. It reads the
//     .md only for the frontmatter POINTER below.
//   * **the Phase-1 coverage matrix JSON** (step-04 §5/§6) — `{ phase: 'PHASE_1_COMPLETE',
//     requirements: [ { id, priority, coverage, tests: [ { id, title, file, line, level,
//     skipped/fixme/pending } ] } ], ... }`, written to `/tmp/tea-trace-coverage-matrix-<ts>.json`
//     with its resolved path recorded in the .md's frontmatter as `tempCoverageMatrixPath`.
//     Real JSON, per-requirement, per-test titles. TEA's own step-05 reads it back the same way.
//     **This is the input.** It is a TEMP file, so convert in the same session as the `trace` run
//     (or copy it) — see the refusal message when the pointer is stale.
//
// WHAT IT WILL NOT DO. It never invents a row, a priority, or a test identity; it never widens
// TEA's own presence call; it never touches Gate's decision (the matrix it writes is informational
// input to an informational section — ADR-0045 §3). Anything it cannot convert FAITHFULLY it
// refuses, naming the row, and writes nothing: an empty result beats a wrong one, the same posture
// `gate.mjs` takes when it rejects a whole matrix over one impossible row. And it stays a SEPARATE
// script on purpose — teaching `gate.mjs` to read TEA's internal format would couple the gate to a
// tool's private shape, which is exactly what `gate-trace-matrix/v0` was defined to avoid
// (orchestrate-don't-couple, ADR-0045).
//
// Zero external deps, deterministic: the same TEA matrix always converts to the same bytes.
//
// Usage:
//   node tea-to-trace-matrix.mjs (--coverage-matrix=<phase1.json> | --trace-md=<traceability-matrix.md>) \
//                                [--gate-json=<gate-decision.json | e2e-trace-summary.json>] \
//                                [--audit-test-json=<tally.json>]  # join-key cross-check (diagnostic only) \
//                                [--test-key=path|basename] [--out=<trace-matrix.json>]
//   node tea-to-trace-matrix.mjs --self-test

import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, resolve, join, isAbsolute, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

// The imports that matter: the conversion's output is validated by the EXACT function that will
// ingest it (`gate.mjs`'s own `parseTraceMatrix`), and it checks values against the EXACT
// vocabularies Gate checks them against — not by a second copy of either that could drift away.
// A converter that refuses a `gateStatus` Gate would have accepted is a silent, one-sided break.
import { parseTraceMatrix, TRACE_MATRIX_SCHEMA, PRIORITIES, MATRIX_GATE_STATUSES } from './gate.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

const ADAPTER_ID = 'tea-to-trace-matrix/v0';
const TEA_PHASE_SENTINEL = 'PHASE_1_COMPLETE'; // step-05 §1 checks this exact value before trusting the file
const TEST_KEY_MODES = ['path', 'basename'];

// TEA's coverage vocabulary is FIVE-valued, not three (step-03 §1: "Mark coverage status: FULL /
// PARTIAL / NONE / UNIT-ONLY / INTEGRATION-ONLY"; step-05 §3b treats all four non-NONE values as
// coverage-eligible). `gate-trace-matrix/v0` is three-valued, so the two level-scoped values have
// to land somewhere, and only one landing is honest:
//
//   UNIT-ONLY / INTEGRATION-ONLY -> PARTIAL. A test EXISTS (so NONE would understate and would
//   also violate the schema's tests-non-empty-iff-covered invariant), but TEA is saying the
//   requirement is covered at one level only (so FULL would overstate TEA's own call, which this
//   conversion is never allowed to widen).
//
// The verbatim TEA value rides along on each row as `teaCoverage` so the flattening is visible in
// the artifact rather than lost — Gate ignores unknown row properties.
const COVERAGE_MAP = {
  FULL: 'FULL',
  PARTIAL: 'PARTIAL',
  'UNIT-ONLY': 'PARTIAL',
  'INTEGRATION-ONLY': 'PARTIAL',
  NONE: 'NONE',
};

// ---- the conversion (pure) ------------------------------------------------

// Build the `<file>::<title>` join key `gate-audit-test/v0.3`'s `runs[].test` uses.
// `title || name` mirrors TEA's own fallback (step-05 §3b: `test.title || test.name`).
// Returns null when either half is missing — a half-key is not a key, and guessing the other half
// is exactly the fabrication this script exists to avoid.
export function teaTestKey(test, mode = 'path') {
  if (!test || typeof test !== 'object') return null;
  const file = typeof test.file === 'string' ? test.file.trim() : '';
  const rawTitle = typeof test.title === 'string' ? test.title : typeof test.name === 'string' ? test.name : '';
  const title = rawTitle.trim();
  if (!file || !title) return null;
  return `${mode === 'basename' ? basename(file) : file}::${title}`;
}

// TEA marks a test skipped/fixme/pending three different ways (step-05 §3b reads an explicit
// `status` string first, then the boolean flags) — read all of them, because a mapped test that
// never runs can never be mutation-proven, and that is worth disclosing at conversion time rather
// than leaving the reader to wonder why a covered requirement resolved `unverified`.
function inertReason(test) {
  const explicit = String(test?.status ?? '').trim().toLowerCase();
  if (['skipped', 'pending', 'fixme'].includes(explicit)) return explicit;
  if (test?.fixme === true) return 'fixme';
  if (test?.pending === true) return 'pending';
  if (test?.skipped === true) return 'skipped';
  return null;
}

// Convert TEA's Phase-1 coverage matrix into `gate-trace-matrix/v0`.
// Returns { matrix, notes, errors }. A non-empty `errors` means the caller writes NOTHING —
// every error names the row (and the offending value) so the user can fix it at the source.
export function convertTeaCoverageMatrix(tea, { testKey = 'path', gateStatus = null } = {}) {
  const errors = [];
  const notes = [];

  if (!tea || typeof tea !== 'object' || Array.isArray(tea)) {
    return { matrix: null, notes, errors: ['input is not a JSON object'] };
  }
  // Drift guard #1 — TEA's own completeness sentinel (step-05 §1 refuses to proceed without it).
  // Without this, a half-written or differently-shaped file would convert to an empty matrix that
  // reads like "this project has no requirements".
  if (tea.phase !== TEA_PHASE_SENTINEL) {
    errors.push(
      `not a TEA Phase-1 coverage matrix: expected \`phase: "${TEA_PHASE_SENTINEL}"\`, found ${JSON.stringify(tea.phase)}. ` +
        'Point --coverage-matrix at the file named by `tempCoverageMatrixPath` (NOT e2e-trace-summary.json or gate-decision.json — neither carries requirement rows).',
    );
    return { matrix: null, notes, errors };
  }
  // Drift guard #2 — a MISSING `requirements` key is a shape change, not an empty matrix. (A
  // genuinely empty `requirements: []` is legal and converts to an empty matrix, which Gate also
  // accepts: a matrix that legitimately covers nothing is a real answer.)
  if (!Array.isArray(tea.requirements)) {
    errors.push('`requirements` is missing or not an array — TEA\'s Phase-1 shape has changed; refusing rather than emitting an empty matrix');
    return { matrix: null, notes, errors };
  }
  if (!TEST_KEY_MODES.includes(testKey)) {
    return { matrix: null, notes, errors: [`unknown --test-key=${testKey} (expected one of: ${TEST_KEY_MODES.join(', ')})`] };
  }

  const requirements = [];
  const seenIds = new Set();
  const dirsByBasename = new Map(); // basename -> Set<full path>, for the basename-collision guard
  let inertCount = 0;

  for (const [index, req] of tea.requirements.entries()) {
    const where = `requirements[${index}]`;
    if (!req || typeof req !== 'object') {
      errors.push(`${where}: not an object`);
      continue;
    }
    const id = typeof req.id === 'string' ? req.id.trim() : '';
    const label = id || where;
    if (!id) {
      errors.push(`${where}: missing \`id\` — a requirement with no identifier cannot be traced (never synthesized)`);
      continue;
    }
    if (seenIds.has(id)) {
      errors.push(`${label}: duplicate requirement id — Gate rejects a matrix with duplicate ids, so this is fixed at the source, not deduped here`);
      continue;
    }
    seenIds.add(id);

    const priority = String(req.priority ?? '').trim().toUpperCase();
    if (!PRIORITIES.includes(priority)) {
      errors.push(`${label}: unusable \`priority\` ${JSON.stringify(req.priority)} (expected P0-P3) — defaulting one would invent a risk ranking`);
      continue;
    }

    const rawCoverage = String(req.coverage ?? '').trim().toUpperCase();
    const status = COVERAGE_MAP[rawCoverage];
    if (!status) {
      // Drift guard #3 — an UNRECOGNIZED coverage value is TEA's vocabulary moving underneath us.
      // Bucketing it into PARTIAL "to be safe" would silently invent a presence claim TEA never made.
      errors.push(
        `${label}: unrecognized coverage ${JSON.stringify(req.coverage)} — known TEA values are ${Object.keys(COVERAGE_MAP).join(' / ')}. ` +
          'TEA may have added a status; the mapping must be decided deliberately, not guessed.',
      );
      continue;
    }

    const teaTests = req.tests === undefined || req.tests === null ? [] : req.tests;
    if (!Array.isArray(teaTests)) {
      errors.push(`${label}: \`tests\` is not an array`);
      continue;
    }

    const tests = [];
    let unkeyable = false;
    for (const [ti, test] of teaTests.entries()) {
      const key = teaTestKey(test, testKey);
      if (!key) {
        errors.push(
          `${label}: mapped test #${ti + 1}${test?.id ? ` (\`${test.id}\`)` : ''} has no usable \`file\` + \`title\` — ` +
            "Gate's join key is `<file>::<title>` and half a key joins to nothing, which would read as unverified coverage rather than as the data gap it is",
        );
        unkeyable = true;
        continue;
      }
      if (typeof test.file === 'string' && test.file.trim()) {
        const base = basename(test.file.trim());
        if (!dirsByBasename.has(base)) dirsByBasename.set(base, new Set());
        dirsByBasename.get(base).add(test.file.trim());
      }
      if (inertReason(test)) inertCount += 1;
      if (!tests.includes(key)) tests.push(key); // TEA can map the same test twice; dedupe, preserving order
    }
    if (unkeyable) continue;

    // The schema's both-ways invariant (`tests.length === 0` iff `status === 'NONE'`). Either
    // violation is a contradiction inside TEA's own row, and guessing which half is wrong is
    // exactly the blind trust `gate.mjs` refuses — so refuse it one step earlier, where the
    // message can name the source row.
    if (status === 'NONE' && tests.length > 0) {
      errors.push(`${label}: coverage NONE but ${tests.length} test(s) mapped — contradictory row, not this script's to reconcile`);
      continue;
    }
    if (status !== 'NONE' && tests.length === 0) {
      errors.push(`${label}: coverage ${rawCoverage} but no test mapped — a covered requirement with no test is arithmetically impossible; Gate would reject the whole matrix`);
      continue;
    }

    const row = { id, priority, status, tests };
    // Provenance for the five->three flattening above: keep TEA's verbatim call on the row.
    // Gate ignores it (its parser reads id/priority/status/tests only); a human reading the
    // artifact can see that a PARTIAL came from UNIT-ONLY rather than from TEA saying PARTIAL.
    row.teaCoverage = rawCoverage;
    requirements.push(row);
  }

  if (testKey === 'basename') {
    // A basename key is only safe while basenames are unique across the mapped files. Two
    // `booking.spec.ts` in different directories collapse into one key that could join to the
    // WRONG test's run record — a false mutation-proven, the worst failure this repo can ship.
    //
    // KNOWN LIMIT, and it is not closeable here: this sees only the files TEA mapped. If the
    // ambiguity lives on the `audit-test` side — its emission already spells files as basenames,
    // so the directory that would distinguish them is gone before this script ever sees it — no
    // check on either side can detect it, and the cross-check below would count a wrong match as a
    // match. That is the real cost of basename keys, and why `path` is the default.
    for (const [base, paths] of dirsByBasename) {
      if (paths.size > 1) {
        errors.push(
          `--test-key=basename is unsafe here: ${paths.size} distinct files share the basename \`${base}\` (${[...paths].join(', ')}). ` +
            'Collapsing them would let one requirement join to another file\'s run record. Re-run with --test-key=path and make audit-test\'s identifiers use paths too.',
        );
      }
    }
  }

  if (errors.length) return { matrix: null, notes, errors };

  if (inertCount > 0) {
    notes.push(
      `${inertCount} mapped test(s) are marked skipped/fixme/pending in TEA's own inventory — they are kept in the matrix ` +
        '(dropping them would silently rewrite TEA\'s presence call) but they never execute, so they can never be mutation-proven; ' +
        'expect those requirements to resolve `unverified`.',
    );
  }

  const matrix = { schema: TRACE_MATRIX_SCHEMA, producer: producerString(tea, testKey) };
  if (gateStatus) matrix.gateStatus = gateStatus;
  matrix.requirements = requirements;
  return { matrix, notes, errors };
}

// The `producer` line Gate prints verbatim in its Business-risk coverage section. It carries the
// two things a reader needs to weigh the left column: which tool produced it, and how the
// requirement list was ARRIVED AT — a `synthetic_source` oracle means TEA inferred the
// requirements from source rather than reading authored ones (ADR-0045's second consequence), and
// that materially changes how much the coverage claim is worth. The key mode rides along because
// it determines whether the join can match at all.
function producerString(tea, testKey) {
  const mode = String(tea.oracle?.resolution_mode ?? '').trim() || 'unknown';
  const confidence = String(tea.oracle?.confidence ?? tea.summary_confidence ?? '').trim() || 'unknown';
  return `TEA trace (bmad-testarch-trace) · oracle ${mode}/${confidence} · keys=${testKey} · via ${ADAPTER_ID}`;
}

// Follow the pointer TEA's step-04 §6 writes into traceability-matrix.md's frontmatter. A
// deliberately tiny frontmatter reader (no YAML dependency): the one key it needs is a scalar on
// its own line. Returns null when the pointer isn't there, which the caller turns into a refusal
// with a remedy — never into a Markdown-parsing fallback (see the header).
export function readTempMatrixPointer(mdText) {
  if (typeof mdText !== 'string') return null;
  const fm = mdText.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return null;
  const line = fm[1].split(/\r?\n/).find((l) => /^\s*tempCoverageMatrixPath\s*:/.test(l));
  if (!line) return null;
  const value = line.slice(line.indexOf(':') + 1).trim().replace(/^['"]|['"]$/g, '').trim();
  return value || null;
}

// `gateStatus` is an OPTIONAL passthrough of the producing tool's own categorical gate — Gate
// displays it for cross-reference and NEVER reads it (trace-matrix.v0 schema). Accepts either TEA
// JSON that carries it: gate-decision.json or e2e-trace-summary.json (identical `gate_status`
// field, step-05 §3b). A gate-INELIGIBLE run omits the field entirely; that is `NOT_EVALUATED`,
// which is information, not absence.
export function parseTeaGateStatus(raw) {
  let obj;
  try {
    obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return { status: null, error: 'not valid JSON' };
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { status: null, error: 'not a JSON object' };
  if (obj.gate_status !== undefined) {
    const status = String(obj.gate_status).trim().toUpperCase();
    if (!MATRIX_GATE_STATUSES.includes(status)) return { status: null, error: `unknown gate_status ${JSON.stringify(obj.gate_status)}` };
    return { status, error: null };
  }
  const looksLikeTea = ['schema_version', 'collection_status', 'gate_basis', 'coverage'].some((k) => obj[k] !== undefined);
  if (looksLikeTea) return { status: 'NOT_EVALUATED', error: null };
  return { status: null, error: 'no `gate_status`, and the file does not look like a TEA gate-decision.json / e2e-trace-summary.json' };
}

// Diagnostic ONLY (#220's "validate what came out"). The single failure this cannot be allowed to
// ship silently: TEA spells a test's file as a repo path (`tests/e2e/booking.spec.ts`) while
// `audit-test` spelled the same test as a basename — every key then misses, every covered
// requirement renders `unverified`, and the report LOOKS like an honest coverage answer. So
// measure the overlap and say it out loud. It never rewrites a key: forcing keys to match would
// manufacture exactly the join this repo exists to make trustworthy.
//
// A DIAGNOSTIC MUST NEVER BE FATAL. The tally arrives as whatever JSON the user pointed at — it is
// NOT validated by `parseAuditEmission` here (Gate does that later, and rejecting it is Gate's call
// to make, not this script's). So read it defensively: a `runs` that isn't an array, or a record
// with no string `test`, degrades to "no records to compare against" — never a stack trace that
// kills a conversion which had already passed every real guard.
export function crossCheckJoinKeys(matrix, tally) {
  const runs = Array.isArray(tally?.runs) ? tally.runs : [];
  const runKeys = new Set(runs.map((r) => (typeof r?.test === 'string' ? r.test : null)).filter(Boolean));
  const runBasenames = new Set([...runKeys].map(basenameKey));
  const mapped = [...new Set(matrix.requirements.flatMap((r) => r.tests))];
  const matched = mapped.filter((k) => runKeys.has(k));
  const unmatched = mapped.filter((k) => !runKeys.has(k));
  // Of the misses, how many would land if only the file half were spelled the other way?
  const basenameRescuable = unmatched.filter((k) => runBasenames.has(basenameKey(k)));
  return { mapped, matched, unmatched, basenameRescuable, runRecords: runKeys.size };
}

function basenameKey(key) {
  const i = key.lastIndexOf('::');
  return i === -1 ? key : `${basename(key.slice(0, i))}::${key.slice(i + 2)}`;
}

// ---- CLI ------------------------------------------------------------------

function main(argv) {
  // Same argv shape as gate.mjs's `main()`, including the `s` flag: a value containing a newline
  // is still a value, not a bare flag.
  const opts = {};
  const flags = new Set();
  for (const a of argv) {
    const m = a.match(/^--([^=]+)=([\s\S]*)$/s);
    if (m) opts[m[1]] = m[2];
    else flags.add(a);
  }

  if (flags.has('--self-test')) {
    process.exit(runSelfTest() ? 0 : 1);
  }

  if (flags.has('--help') || (!opts['coverage-matrix'] && !opts['trace-md'])) {
    console.log('usage: tea-to-trace-matrix.mjs (--coverage-matrix=<phase1.json> | --trace-md=<traceability-matrix.md>)');
    console.log('         --coverage-matrix  TEA `trace` step-04\'s Phase-1 coverage matrix JSON (the ONLY TEA artifact with per-requirement rows');
    console.log('                            AND per-test titles) — /tmp/tea-trace-coverage-matrix-<timestamp>.json');
    console.log('         --trace-md         traceability-matrix.md — read ONLY for its `tempCoverageMatrixPath` frontmatter pointer to that file;');
    console.log('                            its Markdown body carries no test titles, so it is never parsed for rows (ADR-0050)');
    console.log('       [--gate-json=<gate-decision.json | e2e-trace-summary.json>]  # passthrough of TEA\'s own PASS/CONCERNS/FAIL/WAIVED — displayed, never read by Gate');
    console.log(`       [--test-key=path|basename]   # default path — how <file> is spelled in the \`<file>::<title>\` join key`);
    console.log('       [--audit-test-json=<tally.json>]   # cross-check how many keys actually join (diagnostic; never rewrites a key)');
    console.log('       [--out=<trace-matrix.json>]  # default: stdout (notes/warnings go to stderr, so the JSON stays pipeable)');
    console.log('       tea-to-trace-matrix.mjs --self-test');
    process.exit(flags.has('--help') ? 0 : 2);
  }

  // Resolve the Phase-1 matrix path — directly, or via the .md's frontmatter pointer.
  let matrixPath = opts['coverage-matrix'];
  if (!matrixPath) {
    const mdPath = abs(opts['trace-md']);
    let mdText;
    try {
      mdText = readFileSync(mdPath, 'utf8');
    } catch (e) {
      fail(`--trace-md=${opts['trace-md']}: could not read (${e.code ?? e.message}).`);
    }
    const pointer = readTempMatrixPointer(mdText);
    if (!pointer) {
      fail(
        `--trace-md=${opts['trace-md']}: no \`tempCoverageMatrixPath\` in its frontmatter, so the Phase-1 coverage matrix cannot be located.\n` +
          "  This file's Markdown body is NOT a fallback: its Detailed Mapping section identifies tests as `id` - file:line with no test\n" +
          "  title, and Gate's join key is `<file>::<title>` — any key built from it would be fabricated (ADR-0050).\n" +
          '  Fix: re-run TEA `*trace` (step-04 records the pointer), or pass --coverage-matrix=<the Phase-1 JSON> directly.',
      );
    }
    // TEA records an absolute path; a relative one is resolved against the .md itself so a
    // checked-in pair travels together.
    matrixPath = isAbsolute(pointer) ? pointer : resolve(dirname(mdPath), pointer);
  }

  let tea;
  try {
    tea = JSON.parse(readFileSync(abs(matrixPath), 'utf8'));
  } catch (e) {
    fail(
      `could not read the Phase-1 coverage matrix at ${matrixPath} (${e.code ?? e.message}).\n` +
        '  TEA writes it to /tmp, so it is temporary: convert in the same session as the `trace` run, or copy the file somewhere durable first.',
    );
  }

  let gateStatus = null;
  if (opts['gate-json']) {
    let raw;
    try {
      raw = readFileSync(abs(opts['gate-json']), 'utf8');
    } catch (e) {
      fail(`--gate-json=${opts['gate-json']}: could not read (${e.code ?? e.message}).`);
    }
    const parsed = parseTeaGateStatus(raw);
    if (parsed.error) fail(`--gate-json=${opts['gate-json']}: ${parsed.error}.`);
    gateStatus = parsed.status;
  }

  const testKey = opts['test-key'] ?? 'path';
  const { matrix, notes, errors } = convertTeaCoverageMatrix(tea, { testKey, gateStatus });
  if (errors.length) {
    fail(
      'refusing to convert — the result would not be a faithful matrix:\n' +
        errors.map((e) => '  - ' + e).join('\n') +
        '\n  Nothing was written. Fix these at the source (the TEA run) and re-convert; an empty result beats a wrong one.',
    );
  }

  // Belt and braces: the bytes about to be written must survive Gate's OWN ingest guards, or this
  // script has produced something `--trace-json` will reject at the worst possible moment.
  const serialized = JSON.stringify(matrix, null, 2) + '\n';
  if (parseTraceMatrix(serialized) === null) {
    console.error(`✗ internal invariant: the converted matrix does not pass gate.mjs's own parseTraceMatrix. Nothing written — this is a bug in ${ADAPTER_ID}.`);
    process.exit(3);
  }

  for (const n of notes) console.error(`ℹ ${n}`);

  if (opts['audit-test-json']) {
    let tally = null;
    try {
      tally = JSON.parse(readFileSync(abs(opts['audit-test-json']), 'utf8'));
    } catch (e) {
      console.error(`⚠ --audit-test-json=${opts['audit-test-json']}: could not read (${e.code ?? e.message}) — skipping the join-key cross-check.`);
    }
    if (tally) reportCrossCheck(crossCheckJoinKeys(matrix, tally), testKey);
  } else {
    console.error(
      'ℹ Pass --audit-test-json=<the same tally you will give Gate> to check how many of these keys actually join before you run Gate — ' +
        'a matrix whose keys never match renders as honest-looking `unverified` coverage.',
    );
  }

  if (opts.out) {
    writeFileSync(abs(opts.out), serialized);
    console.error(`✓ ${matrix.requirements.length} requirement(s) written to ${opts.out} — pass it to Gate as --trace-json=${opts.out}`);
  } else {
    process.stdout.write(serialized);
  }
  process.exit(0);
}

function reportCrossCheck({ mapped, matched, unmatched, basenameRescuable, runRecords }, testKey) {
  if (runRecords === 0) {
    console.error(
      'ℹ join-key cross-check: that audit-test emission carries no `runs[]` trace, so nothing can be matched against it — ' +
        'every covered requirement will resolve `unverified` in Gate. Re-run /audit-test with a run trace to resolve past presence.',
    );
    return;
  }
  console.error(`ℹ join-key cross-check: ${matched.length} of ${mapped.length} mapped test key(s) match a \`runs[]\` record (${runRecords} record(s) available).`);
  if (matched.length === 0 && basenameRescuable.length > 0) {
    console.error(
      `⚠ NONE of the keys match, but ${basenameRescuable.length} would if the file half were a basename instead of a path. ` +
        `TEA spells files as repo paths; this audit-test emission spells them as basenames. Re-run with --test-key=basename ` +
        '(only if those basenames are unambiguous in your repo — the conversion refuses when two files share one), or re-emit ' +
        'audit-test identifiers as paths. Left as-is, every covered requirement renders `unverified` and the report will look honest.',
    );
  } else if (unmatched.length > 0) {
    const rescuable = basenameRescuable.length > 0 ? ` (${basenameRescuable.length} of them would match on basename alone)` : '';
    console.error(
      `ℹ ${unmatched.length} key(s) have no run record${rescuable} — those requirements resolve \`unverified\`, which is truthful when ` +
        `audit-test simply never mutated them. Spot-check one against your suite if you expected otherwise: ${unmatched.slice(0, 3).map((k) => `\`${k}\``).join(', ')}${unmatched.length > 3 ? ', …' : ''}`,
    );
  }
  if (testKey === 'basename') {
    console.error(
      'ℹ keys=basename: the matrix identifies tests by filename only. The conversion checked that the files TEA mapped have unique ' +
        'basenames — it CANNOT check the audit-test side, whose own identifiers already dropped the directory, so a same-named spec ' +
        'in two directories there would join to the wrong record undetected. Prefer --test-key=path once both sides agree on paths.',
    );
  }
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(2);
}

function abs(p) {
  return isAbsolute(p) ? p : resolve(process.cwd(), p);
}

// ---- self-test (deterministic, offline, zero-dep) --------------------------

function runSelfTest() {
  const R = [];
  const check = (name, cond) => R.push({ name, ok: !!cond });

  const fixture = () => JSON.parse(readFileSync(resolve(HERE, 'fixtures/tea/coverage-matrix.phase1.json'), 'utf8'));

  // The golden expectation, written before the converter existed: every row of the TEA fixture,
  // in TEA's own order, with basename keys.
  const EXPECTED_BASENAME_ROWS = [
    { id: 'REQ-BOOKING-OVERLAP', priority: 'P0', status: 'FULL', tests: ['booking.spec.ts::rejects overlapping bookings'], teaCoverage: 'FULL' },
    { id: 'REQ-BOOKING-CONFIRM', priority: 'P0', status: 'FULL', tests: ['booking.spec.ts::confirms a valid booking'], teaCoverage: 'FULL' },
    { id: 'REQ-BOOKING-FEE', priority: 'P1', status: 'PARTIAL', tests: ['booking.spec.ts::shows the cancellation fee'], teaCoverage: 'UNIT-ONLY' },
    { id: 'REQ-BOOKING-ERROR-LOG', priority: 'P1', status: 'FULL', tests: ['booking.spec.ts::logs a booking error'], teaCoverage: 'FULL' },
    { id: 'REQ-BOOKING-EXPORT', priority: 'P2', status: 'PARTIAL', tests: ['booking.spec.ts::exports a booking receipt'], teaCoverage: 'INTEGRATION-ONLY' },
    {
      id: 'REQ-BOOKING-ROOMLIST',
      priority: 'P1',
      status: 'FULL',
      tests: ['booking.spec.ts::renders the room list', 'booking.spec.ts::disables submit while pending'],
      teaCoverage: 'FULL',
    },
    { id: 'REQ-BOOKING-A11Y', priority: 'P2', status: 'FULL', tests: ['booking.spec.ts::meets contrast requirements'], teaCoverage: 'FULL' },
    { id: 'REQ-BOOKING-SLA', priority: 'P3', status: 'NONE', tests: [], teaCoverage: 'NONE' },
  ];

  const basenameKeyed = convertTeaCoverageMatrix(fixture(), { testKey: 'basename', gateStatus: 'CONCERNS' });
  check('fixture converts with no errors', basenameKeyed.errors.length === 0 && basenameKeyed.matrix !== null);
  check('every row matches the golden expectation (order, ids, priorities, mapped statuses, keys)',
    JSON.stringify(basenameKeyed.matrix?.requirements) === JSON.stringify(EXPECTED_BASENAME_ROWS));
  check('the output declares Gate\'s schema, not TEA\'s', basenameKeyed.matrix?.schema === TRACE_MATRIX_SCHEMA);
  check('gateStatus rides through as an informational passthrough', basenameKeyed.matrix?.gateStatus === 'CONCERNS');
  check('producer names TEA, the oracle basis, the key mode, and this adapter',
    /TEA trace \(bmad-testarch-trace\)/.test(basenameKeyed.matrix?.producer ?? '') &&
      /oracle formal_requirements\/high/.test(basenameKeyed.matrix?.producer ?? '') &&
      /keys=basename/.test(basenameKeyed.matrix?.producer ?? '') &&
      basenameKeyed.matrix.producer.includes(ADAPTER_ID));

  // The whole point of the belt-and-braces check in main(): Gate's own ingest must accept it.
  check("the converted matrix passes gate.mjs's OWN parseTraceMatrix (not a second copy of those rules)",
    parseTraceMatrix(JSON.stringify(basenameKeyed.matrix)) !== null);

  // TEA's 5-value vocabulary -> Gate's 3-value one, and the verbatim value preserved on the row.
  const fee = basenameKeyed.matrix.requirements.find((r) => r.id === 'REQ-BOOKING-FEE');
  const exp = basenameKeyed.matrix.requirements.find((r) => r.id === 'REQ-BOOKING-EXPORT');
  check('UNIT-ONLY maps to PARTIAL, never FULL (never widens TEA\'s own presence call)', fee.status === 'PARTIAL' && fee.teaCoverage === 'UNIT-ONLY');
  check('INTEGRATION-ONLY maps to PARTIAL, and TEA\'s verbatim value survives on the row', exp.status === 'PARTIAL' && exp.teaCoverage === 'INTEGRATION-ONLY');
  check('a test titled with TEA\'s `name` alias is keyed, not dropped', exp.tests[0] === 'booking.spec.ts::exports a booking receipt');
  const roomlist = basenameKeyed.matrix.requirements.find((r) => r.id === 'REQ-BOOKING-ROOMLIST');
  check('a test mapped twice in one row is deduped to one key, order preserved', roomlist.tests.length === 2 && roomlist.tests[0].endsWith('renders the room list'));
  check('a skipped test is KEPT in the matrix (dropping it would rewrite TEA\'s presence call)',
    basenameKeyed.matrix.requirements.find((r) => r.id === 'REQ-BOOKING-A11Y').tests.length === 1);
  check('…and is disclosed as a note, because a test that never runs can never be mutation-proven',
    basenameKeyed.notes.some((n) => /skipped\/fixme\/pending/.test(n) && /unverified/.test(n)));

  // --test-key: the same fixture, both spellings.
  const pathKeyed = convertTeaCoverageMatrix(fixture(), { testKey: 'path' });
  check('--test-key=path (the default) keys tests by the file path TEA recorded',
    pathKeyed.errors.length === 0 && pathKeyed.matrix.requirements[0].tests[0] === 'tests/e2e/booking.spec.ts::rejects overlapping bookings');
  check('--test-key is recorded in producer, so a reader can tell which spelling produced the matrix', /keys=path/.test(pathKeyed.matrix.producer));
  check('an unknown --test-key is refused, not silently defaulted', convertTeaCoverageMatrix(fixture(), { testKey: 'nope' }).errors.length === 1);

  // Basename-collision guard — the one way a basename key can join to the WRONG test.
  const collide = fixture();
  collide.requirements[0].tests.push({ id: 'X-1', title: 'rejects overlapping bookings', file: 'tests/unit/booking.spec.ts', line: 3, level: 'unit' });
  const collided = convertTeaCoverageMatrix(collide, { testKey: 'basename' });
  check('basename mode refuses when two directories share a spec basename (a wrong join is worse than no join)',
    collided.matrix === null && collided.errors.some((e) => /share the basename `booking.spec.ts`/.test(e)));
  check('…and the same input converts fine with path keys, which stay unambiguous',
    convertTeaCoverageMatrix(collide, { testKey: 'path' }).errors.length === 0);

  // Drift guards — each one refuses and writes nothing, rather than degrading to an empty or
  // half-right matrix (#220's "shouldn't silently mis-parse into a wrong (not just empty) matrix").
  const noPhase = fixture();
  delete noPhase.phase;
  check('drift: a file without TEA\'s PHASE_1_COMPLETE sentinel is refused', convertTeaCoverageMatrix(noPhase).matrix === null);
  const summaryShaped = { schema_version: '0.1.0', coverage: { inventory: { covered: 5, total: 8 } } };
  check('drift: e2e-trace-summary.json (aggregates, no rows) is refused with a message naming the right file',
    convertTeaCoverageMatrix(summaryShaped).errors.some((e) => /tempCoverageMatrixPath/.test(e) && /e2e-trace-summary/.test(e)));
  const noReqs = fixture();
  delete noReqs.requirements;
  check('drift: a MISSING `requirements` key is a shape change, refused — never an empty matrix that reads "nothing to cover"',
    convertTeaCoverageMatrix(noReqs).matrix === null);
  const emptyReqs = { ...fixture(), requirements: [] };
  const emptyOut = convertTeaCoverageMatrix(emptyReqs);
  check('…but a genuinely empty `requirements: []` converts to an empty matrix (a real answer Gate accepts)',
    emptyOut.errors.length === 0 && emptyOut.matrix.requirements.length === 0 && parseTraceMatrix(JSON.stringify(emptyOut.matrix)) !== null);
  const newStatus = fixture();
  newStatus.requirements[0].coverage = 'MOSTLY';
  check('drift: an unrecognized coverage value is refused, never bucketed into PARTIAL "to be safe"',
    convertTeaCoverageMatrix(newStatus).errors.some((e) => /unrecognized coverage "MOSTLY"/.test(e)));

  // Row-level faithfulness — every refusal names the row.
  const dupId = fixture();
  dupId.requirements.push({ ...dupId.requirements[0] });
  check('duplicate requirement id is refused (Gate would reject the whole matrix)',
    convertTeaCoverageMatrix(dupId).errors.some((e) => /REQ-BOOKING-OVERLAP: duplicate/.test(e)));
  const noPriority = fixture();
  noPriority.requirements[1].priority = 'critical';
  check('an unusable priority is refused rather than defaulted (defaulting invents a risk ranking)',
    convertTeaCoverageMatrix(noPriority).errors.some((e) => /REQ-BOOKING-CONFIRM: unusable `priority`/.test(e)));
  const noTitle = fixture();
  delete noTitle.requirements[0].tests[0].title;
  check('a mapped test with no title is refused, naming the row and the test id — half a key is not a key',
    convertTeaCoverageMatrix(noTitle).errors.some((e) => /REQ-BOOKING-OVERLAP: mapped test #1 \(`14.1-E2E-001`\)/.test(e)));
  const noneWithTests = fixture();
  noneWithTests.requirements[7].tests = [{ id: 'Z', title: 't', file: 'a.spec.ts' }];
  check('a NONE row carrying tests is refused as contradictory',
    convertTeaCoverageMatrix(noneWithTests).errors.some((e) => /REQ-BOOKING-SLA: coverage NONE but 1 test/.test(e)));
  const fullNoTests = fixture();
  fullNoTests.requirements[0].tests = [];
  check('a FULL row with no tests is refused as arithmetically impossible',
    convertTeaCoverageMatrix(fullNoTests).errors.some((e) => /REQ-BOOKING-OVERLAP: coverage FULL but no test mapped/.test(e)));

  // The frontmatter pointer — the only thing read out of traceability-matrix.md.
  const md = readFileSync(resolve(HERE, 'fixtures/tea/traceability-matrix.md'), 'utf8');
  check('reads `tempCoverageMatrixPath` out of the .md frontmatter', readTempMatrixPointer(md) === 'coverage-matrix.phase1.json');
  check('a .md with no pointer yields null (→ a refusal with a remedy, never a Markdown-parsing fallback)',
    readTempMatrixPointer('---\nlastStep: step-05\n---\n\n# Traceability Matrix\n') === null);
  check('a .md with no frontmatter at all yields null', readTempMatrixPointer('# Traceability Matrix\n') === null);
  check('the .md fixture body genuinely carries no test TITLE — the reason it is never parsed for rows (ADR-0050)',
    /14\.1-E2E-001` - tests\/e2e\/booking\.spec\.ts:42/.test(md) && !md.includes('rejects overlapping bookings'));

  // gateStatus passthrough.
  const gateJson = readFileSync(resolve(HERE, 'fixtures/tea/gate-decision.json'), 'utf8');
  check('gate-decision.json yields its categorical gate', parseTeaGateStatus(gateJson).status === 'CONCERNS');
  check('an e2e-trace-summary.json from a gate-INELIGIBLE run reads NOT_EVALUATED, not absent',
    parseTeaGateStatus({ schema_version: '0.1.0', collection_status: 'INVENTORY_ONLY' }).status === 'NOT_EVALUATED');
  check('an out-of-vocabulary gate_status is rejected, not passed through', parseTeaGateStatus({ gate_status: 'GREEN' }).error !== null);
  check('an unrelated JSON file is rejected', parseTeaGateStatus({ hello: 'world' }).error !== null);
  check('every gateStatus Gate accepts is accepted here too — the vocabularies are one shared constant, not two copies that can drift',
    MATRIX_GATE_STATUSES.every((s) => parseTeaGateStatus({ gate_status: s }).status === s));

  // Join-key cross-check — the diagnostic that catches the path-vs-basename miss.
  const tally = JSON.parse(readFileSync(resolve(HERE, 'fixtures/audit-test.confirmed-with-runs.json'), 'utf8'));
  const xBase = crossCheckJoinKeys(basenameKeyed.matrix, tally);
  check('cross-check: basename keys match 6 of the 8 mapped tests against the audit-test fixture\'s runs[]',
    xBase.matched.length === 6 && xBase.mapped.length === 8);
  const xPath = crossCheckJoinKeys(pathKeyed.matrix, tally);
  check('cross-check: path keys match NOTHING against a basename-spelled emission — the silent-unverified trap',
    xPath.matched.length === 0);
  check('…and it is diagnosed as rescuable by basename rather than left to look like real "unverified" coverage',
    xPath.basenameRescuable.length === 6);
  check('cross-check never rewrites a key (the matrix is unchanged after the check)',
    pathKeyed.matrix.requirements[0].tests[0] === 'tests/e2e/booking.spec.ts::rejects overlapping bookings');
  check('cross-check against an emission with no runs[] reports zero available records, not zero matches',
    crossCheckJoinKeys(basenameKeyed.matrix, { runs: [] }).runRecords === 0);
  // A DIAGNOSTIC MUST NOT BE FATAL: the tally is whatever JSON the user pointed at — this script
  // never validates it (that is Gate's call), so every malformed shape has to degrade, not throw.
  const malformedTallies = [{ runs: {} }, { runs: [null] }, { runs: [{ test: 42 }] }, { runs: 'nope' }, {}, null, 'not-an-object'];
  check('cross-check survives every malformed audit-test shape (a diagnostic must never kill a conversion that already passed every guard)',
    malformedTallies.every((t) => {
      try {
        return crossCheckJoinKeys(basenameKeyed.matrix, t).runRecords === 0;
      } catch {
        return false;
      }
    }));

  // The committed golden file is what the tool actually produces today.
  const golden = JSON.parse(readFileSync(resolve(HERE, 'fixtures/tea/trace-matrix.from-tea.json'), 'utf8'));
  check('the committed golden fixture equals the conversion output byte-for-byte in content',
    JSON.stringify(golden) === JSON.stringify(convertTeaCoverageMatrix(fixture(), { testKey: 'basename', gateStatus: 'CONCERNS' }).matrix));

  runEndToEndSelfTest(check);

  const passed = R.every((r) => r.ok);
  console.log('tea-to-trace-matrix.mjs self-test:');
  for (const r of R) console.log(`  ${r.ok ? '✓' : '✗'} ${r.name}`);
  console.log(passed ? '→ OK (conversion is faithful, or it refuses)\n' : '→ BROKEN\n');
  return passed;
}

// The last mile, end to end, through the REAL CLIs as subprocesses — TEA fixture in, Gate's
// business-risk rollup out. This is the check that would catch the two halves drifting apart:
// a conversion that passes every unit check above but that Gate rejects, or that joins to nothing.
function runEndToEndSelfTest(check) {
  const tmpDir = mkdtempSync(join(tmpdir(), 'tea-to-trace-matrix-'));
  try {
    const self = resolve(HERE, 'tea-to-trace-matrix.mjs');
    const run = (script, args) => spawnSync(process.execPath, [script, ...args], { cwd: tmpDir, encoding: 'utf8' });

    // Convert straight from the .md — i.e. exercise the frontmatter pointer, not just the JSON path.
    const outPath = join(tmpDir, 'trace-matrix.json');
    const conv = run(self, [
      `--trace-md=${resolve(HERE, 'fixtures/tea/traceability-matrix.md')}`,
      `--gate-json=${resolve(HERE, 'fixtures/tea/gate-decision.json')}`,
      `--audit-test-json=${resolve(HERE, 'fixtures/audit-test.confirmed-with-runs.json')}`,
      '--test-key=basename',
      `--out=${outPath}`,
    ]);
    check('e2e: --trace-md follows the frontmatter pointer to the Phase-1 JSON and exits 0', conv.status === 0);
    check('e2e: the cross-check reports the real overlap on stderr', /6 of 8 mapped test key\(s\) match/.test(conv.stderr ?? ''));

    // Gate ingests the converted file with no hand-editing — the gap #220 exists to close.
    const gateOut = join(tmpDir, 'gate-bundle.json');
    const gate = run(resolve(HERE, 'gate.mjs'), [
      `--playwright=${resolve(HERE, 'fixtures/playwright.passed.json')}`,
      `--audit-test-json=${resolve(HERE, 'fixtures/audit-test.confirmed-with-runs.json')}`,
      `--trace-json=${outPath}`,
      '--commit=deadbeef',
      `--out=${gateOut}`,
    ]);
    check('e2e: Gate accepts the converted matrix as --trace-json with no hand-editing (exits 0)', gate.status === 0);
    check('e2e: Gate did NOT reject it (no rejection warning on stderr)', !/not a valid gate-trace-matrix/.test(gate.stderr ?? ''));
    const bundle = JSON.parse(readFileSync(gateOut, 'utf8'));
    const rollup = bundle.entries.find((e) => e.predicate?.stage === 'business-risk')?.predicate?.rollup;
    check('e2e: the join resolves 4 mutation-proven · 2 unverified · 1 hollow · 1 not-covered',
      rollup?.summary?.mutationProven === 4 && rollup?.summary?.unverified === 2 && rollup?.summary?.hollow === 1 && rollup?.summary?.notCovered === 1);
    check('e2e: the hollow row is the requirement whose only test SURVIVED its mutation — the presence gap this whole path exists to catch',
      rollup?.rows?.find((r) => r.state === 'hollow')?.id === 'REQ-BOOKING-ERROR-LOG');
    check("e2e: TEA's own categorical gate rides through to Gate's report as a cross-reference",
      /matrix gate: CONCERNS/.test(gate.stdout ?? ''));

    // …and the same thing through the CLI: a malformed tally must cost the cross-check, not the conversion.
    const junkTally = join(tmpDir, 'junk-tally.json');
    writeFileSync(junkTally, JSON.stringify({ schema: 'gate-audit-test/v0.3', runs: { nope: true } }));
    const junkOut = join(tmpDir, 'still-written.json');
    const junkRun = run(self, [
      `--coverage-matrix=${resolve(HERE, 'fixtures/tea/coverage-matrix.phase1.json')}`,
      `--audit-test-json=${junkTally}`,
      '--test-key=basename',
      `--out=${junkOut}`,
    ]);
    check('e2e: a malformed --audit-test-json still exits 0 and still writes the matrix (no stack trace)',
      junkRun.status === 0 && existsSync(junkOut) && !/TypeError|at Object\.|at Module\._compile/.test(junkRun.stderr ?? ''));

    // A refusal writes nothing and exits non-zero — a conversion tool must not leave a half-file behind.
    const badPath = join(tmpDir, 'should-not-exist.json');
    const badInput = join(tmpDir, 'bad-tea.json');
    writeFileSync(badInput, JSON.stringify({ phase: 'PHASE_1_COMPLETE', requirements: [{ id: 'R1', priority: 'P0', coverage: 'FULL', tests: [] }] }));
    const refused = run(self, [`--coverage-matrix=${badInput}`, `--out=${badPath}`]);
    check('e2e: an unconvertible matrix exits 2 with a row-naming reason', refused.status === 2 && /R1: coverage FULL but no test mapped/.test(refused.stderr ?? ''));
    check('e2e: …and writes no output file at all', !existsSync(badPath));
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

// Run main only as a CLI, never when imported by a test.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}
