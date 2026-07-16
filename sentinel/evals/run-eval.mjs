#!/usr/bin/env node
// Phase 1 fixture-outcome runner for the Sentinel skill-eval harness (issue #74).
//
// Modes:
//   --dry-run     grade each case's recorded pass-sample offline; expect PASS.
//                 Proves the grading pipeline end-to-end without an API key.
//   --self-test   grade the pass-sample (expect PASS) and the negative sample
//                 (expect FAIL) and assert the grader DISCRIMINATES. This is the
//                 harness's own regression guard.
//   --live        real runs: for each case × trials, spin an isolated git
//                 worktree, invoke the skill headless, capture the transcript,
//                 grade it, and report reliability (passes/trials). Needs an
//                 agent CLI; nothing here calls a model unless you pass --live.
//
// Flags: --judge=heuristic|llm (default: llm when ANTHROPIC_API_KEY is set, else
//        heuristic — pass --judge=heuristic to force the free offline grader),
//        --trials=N, --agent="claude -p {prompt}".
//
// Usage:
//   node sentinel/evals/run-eval.mjs --dry-run   cases/audit-test.json
//   node sentinel/evals/run-eval.mjs --self-test cases/audit-test.json
//   node sentinel/evals/run-eval.mjs --live      cases/audit-test.json --trials=3

import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { gradeSampleFile, gradeTranscript } from './lib/grade.mjs';

const EVALS_ROOT = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(EVALS_ROOT, '../..');

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--') && !a.includes('=')));
const opts = Object.fromEntries(
  argv.filter((a) => a.startsWith('--') && a.includes('=')).map((a) => a.slice(2).split(/=(.*)/s)),
);
const positional = argv.filter((a) => !a.startsWith('--'));
const caseFile = positional[0];
// Default to the real LLM judge when a key is available, else the free offline
// heuristic. Explicit --judge=… always wins. The run header prints which ran.
const judge = opts.judge ?? (process.env.ANTHROPIC_API_KEY ? 'llm' : 'heuristic');

if (!caseFile) {
  console.error('usage: run-eval.mjs [--dry-run|--self-test|--live] <case.json> [--judge=…] [--trials=N]');
  process.exit(2);
}

const suite = JSON.parse(readFileSync(resolveFromEvals(caseFile), 'utf8'));
const mode = flags.has('--live') ? 'live' : flags.has('--self-test') ? 'self-test' : 'dry-run';
const trials = Number(opts.trials ?? suite.trials ?? 3);

console.log(`\n═══ ${suite.skill} · ${mode} · judge=${judge} ═══\n`);

let ok = true;
try {
  for (const c of suite.cases) {
    if (mode === 'dry-run') ok = (await runDryRun(c)) && ok;
    else if (mode === 'self-test') ok = (await runSelfTest(c)) && ok;
    else ok = (await runLive(c)) && ok;
  }
} catch (err) {
  console.error(`\n✗ ${err.message}\n`);
  process.exit(1);
}
console.log(ok ? '\n✅ suite passed\n' : '\n❌ suite failed\n');
process.exit(ok ? 0 : 1);

// ---- modes ----------------------------------------------------------------

async function runDryRun(c) {
  const sample = resolveFromEvals(c.dry_run_sample);
  const g = await gradeSampleFile(sample, c, { judge });
  printCase(c, `dry-run ← ${c.dry_run_sample}`, g);
  return g.pass;
}

async function runSelfTest(c) {
  const pos = await gradeSampleFile(resolveFromEvals(c.dry_run_sample), c, { judge });
  const neg = await gradeSampleFile(resolveFromEvals(c.dry_run_negative_sample), c, { judge });
  const discriminates = pos.pass === true && neg.pass === false;
  printCase(c, `self-test · pass-sample`, pos);
  printCase(c, `self-test · negative-sample (must FAIL)`, neg);
  console.log(
    `  ⇒ discrimination: pass-sample=${pos.pass} negative-sample=${neg.pass} → ` +
      (discriminates ? 'OK (grader discriminates)' : 'BROKEN (grader does not discriminate)'),
  );
  return discriminates;
}

async function runLive(c) {
  let passes = 0;
  for (let i = 1; i <= trials; i++) {
    const transcript = runInIsolatedWorktree(c);
    const g = await gradeTranscript(transcript, c, { judge });
    if (g.pass) passes++;
    printCase(c, `live · trial ${i}/${trials}`, g);
  }
  const reliability = `${passes}/${trials}`;
  console.log(`  ⇒ reliability: ${reliability}` + (passes === trials ? '' : '  ⚠️ nondeterministic/regressed'));
  return passes === trials; // report is the number; the boolean is advisory (ADR-0013: label, don't gate)
}

// ---- live plumbing (wired, gated behind --live) ---------------------------

function runInIsolatedWorktree(c) {
  // Isolation (ADR-0022 §Decision.5): a fresh worktree so the agent can't read a
  // prior transcript and pass without doing the work.
  const wt = mkdtempSync(resolve(tmpdir(), 'sentinel-eval-'));
  try {
    git(['worktree', 'add', '--detach', wt, 'HEAD']);
    const template = opts.agent ?? process.env.SENTINEL_EVAL_AGENT ?? 'claude -p {prompt}';
    const cmd = template.replace('{prompt}', c.invoke);
    const r = spawnSync('bash', ['-lc', cmd], { cwd: wt, encoding: 'utf8', timeout: 300_000 });
    if (r.status !== 0) console.error(`  (agent exited ${r.status}) ${r.stderr ?? ''}`);
    return (r.stdout ?? '') + '\n' + (r.stderr ?? '');
  } finally {
    try {
      git(['worktree', 'remove', '--force', wt]);
    } catch {
      rmSync(wt, { recursive: true, force: true });
    }
  }
}

function git(args) {
  const r = spawnSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout;
}

// ---- reporting ------------------------------------------------------------

function printCase(c, label, g) {
  console.log(`▶ ${c.id}  [${label}]`);
  for (const t of g.tokens) console.log(`    ${mark(t.ok)} token ${t.expected}   →  ${t.evidence}`);
  for (const s of g.surfaced) console.log(`    ${mark(s.ok)} surface: ${s.claim}\n         ↳ ${s.evidence}`);
  for (const v of g.violations) console.log(`    ${mark(v.ok)} must-not: ${v.claim}  (${v.evidence})`);
  console.log(`    RESULT: ${g.pass ? 'PASS' : 'FAIL'}\n`);
}
function mark(ok) {
  return ok ? '✓' : '✗';
}

function resolveFromEvals(p) {
  return isAbsolute(p) ? p : resolve(EVALS_ROOT, p);
}
