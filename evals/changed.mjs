#!/usr/bin/env node
// Phase 2 change-detection for the Sentinel skill-eval harness (issue #74).
//
// The point of the harness (ADR-0022) is to catch a skill regressing before a
// user does — but running all 13 skills' evals on every PR is wasteful and, once
// live runs cost money, unaffordable. So on a PR we run only what the diff
// touched: map the changed files → the affected skills → that skill's eval + a
// scoped lint.
//
// Stance (ADR-0013 → ADR-0024): the script still DEFAULTS to report-first —
// without `--gate` it prints a per-skill report (and a GitHub job summary in CI)
// and exits 0 even when an eval fails to discriminate, so a human run stays
// informational. `--gate` makes it exit non-zero on a lint error or a broken
// self-test. The epic's precondition for gating — a passing LLM-judge meta-eval
// per case — is now met for every skill with a case (2026-07-16), so CI runs
// with `--gate` on. The self-test grades recorded samples, so a gate failure is
// a deterministic regression in the case or its samples, not a judgment call.
//
// What runs per affected skill: `run-eval.mjs --self-test cases/<skill>.json`
// with the OFFLINE heuristic judge (no API key in CI — the LLM meta-eval is the
// manual trust gate, not a per-PR cost). Self-test is the harness's own
// discrimination guard: a change that breaks pass=PASS / negative=FAIL is a real
// regression in the case or its samples.
//
// Usage:
//   node evals/changed.mjs                 # diff main...HEAD + worktree
//   node evals/changed.mjs --base=origin/main
//   node evals/changed.mjs --gate          # exit non-zero on failure
//   node evals/changed.mjs --self-test     # prove the classifier

import { readFileSync, readdirSync, existsSync, appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const EVALS_ROOT = dirname(fileURLToPath(import.meta.url));
const RUN_EVAL = resolve(EVALS_ROOT, 'run-eval.mjs');
const LINT = resolve(EVALS_ROOT, 'lint.mjs');

const argv = process.argv.slice(2);
const opts = Object.fromEntries(
  argv.filter((a) => a.startsWith('--') && a.includes('=')).map((a) => a.slice(2).split(/=(.*)/s)),
);
const flags = new Set(argv.filter((a) => a.startsWith('--') && !a.includes('=')));
const base = opts.base ?? 'main';

// Resolved via git, not a hardcoded `../..` relative path (#148): a repo
// restructure (e.g. ADR-0032's flatten) silently broke a hand-rolled path and
// no test caught it, because `--self-test` only ever exercised the pure
// classifier below, never this seam. `git rev-parse` runs with cwd=EVALS_ROOT,
// which is always inside the repo regardless of how deep `evals/` sits. A
// clean top-level try/catch here (and around `main()` below) means a real git
// failure now fails LOUD with a readable message, instead of the old
// swallow-to-`''` that let this exact bug hide for however many PRs landed
// since the flatten.
let REPO_ROOT;
try {
  REPO_ROOT = resolveRepoRoot();
} catch (err) {
  console.error(`\n✗ changed.mjs: ${err.message}\n`);
  process.exit(1);
}

if (flags.has('--self-test')) process.exit(runSelfTest() ? 0 : 1);

try {
  main();
} catch (err) {
  console.error(`\n✗ changed.mjs: ${err.message}\n`);
  process.exit(1);
}

// ---- main -----------------------------------------------------------------

function main() {
  const skillsWithCase = discoverCases();
  const files = changedFiles(base);
  const { affected, coverageGaps, harnessCore, changedSkillMd } = classifyChanges(files, skillsWithCase);

  const lint = changedSkillMd.length ? runLint(changedSkillMd) : null;
  const evals = affected.map((skill) => ({ skill, ...runSelfTest_(skill) }));

  const md = renderReport({ base, files, affected, coverageGaps, harnessCore, changedSkillMd, lint, evals, gating: flags.has('--gate') });
  console.log(md);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');

  const failed = (lint && lint.error) || evals.some((e) => !e.discriminates);
  if (flags.has('--gate') && failed) {
    console.error('\n✗ --gate: a changed skill failed lint or its self-test did not discriminate\n');
    process.exit(1);
  }
  process.exit(0); // report-first: label, don't gate (ADR-0013)
}

// ---- classification (pure — self-tested) ----------------------------------

// Map a list of repo-relative changed paths to the skills whose eval must run.
// A change to the harness core (runner, grader, lib) has a whole-suite blast
// radius, so it selects every skill that has a case — the run-all analogue of
// /e2e-impact's global bucket. A changed SKILL.md with no case is a COVERAGE
// GAP: there is no eval to catch a regression in it, and that is worth saying.
export function classifyChanges(files, skillsWithCase) {
  const affected = new Set();
  const coverageGaps = new Set();
  const changedSkillMd = [];
  let harnessCore = false;

  // Core = files whose change can shift EVAL OUTCOMES for every skill: the
  // runner and the graders. Not changed.mjs (it only selects which evals run)
  // and not lint.mjs (it changes lint output, which scoped lint already covers).
  const CORE = /^evals\/run-eval\.mjs$|^evals\/lib\//;

  for (const f of files) {
    let m;
    if ((m = f.match(/^skills\/([^/]+)\/SKILL\.md$/))) {
      changedSkillMd.push(f);
      if (skillsWithCase.has(m[1])) affected.add(m[1]);
      else coverageGaps.add(m[1]);
    } else if ((m = f.match(/^evals\/cases\/([^/]+)\.json$/))) {
      if (skillsWithCase.has(m[1])) affected.add(m[1]);
    } else if ((m = f.match(/^evals\/samples\/([^/.]+)\./))) {
      // <skill>.<variant>.<pass|fail>.md — skip the samples/lint/ subtree.
      if (!f.startsWith('evals/samples/lint/') && skillsWithCase.has(m[1])) affected.add(m[1]);
    } else if (CORE.test(f)) {
      harnessCore = true;
    }
  }

  // lint.mjs is core-adjacent but changing it doesn't change any skill's
  // behavior — it changes the linter. Re-running scoped lint on changed
  // SKILL.md still covers it; no need to fan out every eval.
  if (harnessCore) for (const s of skillsWithCase) affected.add(s);

  return {
    affected: [...affected].sort(),
    coverageGaps: [...coverageGaps].sort(),
    harnessCore,
    changedSkillMd,
  };
}

// ---- git + subprocess plumbing --------------------------------------------

function changedFiles(baseRef) {
  // PR diff (three-dot: changes on HEAD since the merge-base) plus the working
  // tree, so it is useful locally before you commit as well as in CI. Only the
  // committed-diff leg has a LEGITIMATE reason to fail (`baseRef` not fetched
  // locally, e.g. a bare `--base=origin/main` before `git fetch`) — the other
  // three run against a checkout `resolveRepoRoot()` already proved is real, so
  // a failure there is a bug (wrong cwd, corrupt repo), not an expected case,
  // and must not be swallowed the same way (#148: the two were conflated,
  // which is exactly how a broken REPO_ROOT went undetected).
  const committed = gitAllowMissingRef(['diff', '--name-only', `${baseRef}...HEAD`]);
  const worktree = gitStrict(['diff', '--name-only']); // unstaged
  const staged = gitStrict(['diff', '--name-only', '--cached']);
  const untracked = gitStrict(['ls-files', '--others', '--exclude-standard']);
  const all = [committed, worktree, staged, untracked].join('\n').split('\n').map((s) => s.trim()).filter(Boolean);
  return [...new Set(all)].sort();
}

function gitStrict(args) {
  const r = spawnSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed in ${REPO_ROOT}: ${(r.stderr ?? '').trim() || `exit ${r.status}`}`);
  }
  return r.stdout ?? '';
}

// The one call whose failure is EXPECTED and benign — see changedFiles() above.
function gitAllowMissingRef(args) {
  const r = spawnSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' });
  if (r.status !== 0) return '';
  return r.stdout ?? '';
}

// Find the real repo root via git itself rather than a hand-rolled relative
// path — this is the one thing here allowed to run before REPO_ROOT exists,
// so it hardcodes its own cwd (EVALS_ROOT) rather than depending on it (#148).
// Failure here is a hard invariant violation (not a git repo at all): fail
// loud immediately rather than let every downstream call silently no-op.
function resolveRepoRoot() {
  const r = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: EVALS_ROOT, encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(
      `changed.mjs: could not resolve the repo root from ${EVALS_ROOT} (git rev-parse --show-toplevel failed): ${(r.stderr ?? '').trim()}`,
    );
  }
  return r.stdout.trim();
}

function discoverCases() {
  const dir = resolve(EVALS_ROOT, 'cases');
  return new Set(readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')));
}

function runLint(skillMdPaths) {
  const r = spawnSync('node', [LINT, ...skillMdPaths.map((p) => resolve(REPO_ROOT, p))], { encoding: 'utf8' });
  return { error: r.status !== 0, output: (r.stdout ?? '').trim() };
}

function runSelfTest_(skill) {
  const r = spawnSync('node', [RUN_EVAL, '--self-test', `cases/${skill}.json`, '--judge=heuristic'], {
    encoding: 'utf8',
  });
  return { discriminates: r.status === 0, output: (r.stdout ?? '').trim() };
}

// ---- reporting ------------------------------------------------------------

function renderReport({ base, affected, coverageGaps, harnessCore, changedSkillMd, lint, evals, gating = false }) {
  const L = [];
  L.push(`## Sentinel skill-eval — changed-skill report`);
  L.push('');
  L.push(`base: \`${base}\` · changed SKILL.md: ${changedSkillMd.length} · affected skills: ${affected.length}` +
    (harnessCore ? ' · harness core changed → all skills with a case' : ''));
  L.push('');

  if (!affected.length && !coverageGaps.length && !changedSkillMd.length) {
    L.push('No skills or eval assets touched by this diff — nothing to run.');
    return L.join('\n');
  }

  if (evals.length) {
    L.push('| Skill | Self-test (offline heuristic) |');
    L.push('|---|---|');
    for (const e of evals) L.push(`| \`${e.skill}\` | ${e.discriminates ? '✅ discriminates' : '❌ does NOT discriminate'} |`);
    L.push('');
  }

  if (coverageGaps.length) {
    L.push(`> ⚠️ **Coverage gap** — changed but no eval to catch a regression: ${coverageGaps.map((s) => `\`${s}\``).join(', ')}.`);
    L.push('> A skill without a case in `evals/cases/` can regress silently. Consider adding one.');
    L.push('');
  }

  if (lint) L.push(`Lint on changed SKILL.md: ${lint.error ? '❌ error (see log)' : '✅ no errors'}`);

  L.push('');
  L.push(
    gating
      ? '_Gating (ADR-0024, trust established 2026-07-16): a changed skill whose self-test does not discriminate, or a lint error, fails this check. The self-test grades recorded samples, so a failure is a real regression in the case or its samples — read the log._'
      : '_Report-first (ADR-0013): this check does not gate the merge. A failing self-test is a real regression in the case or its samples — read the log._',
  );
  return L.join('\n');
}

// ---- self-test ------------------------------------------------------------

// Prove the classifier maps a synthetic diff correctly — the harness's own
// discrimination principle applied to the change detector itself.
function runSelfTest() {
  const skillsWithCase = new Set(['audit-test', 'debug-test', 'contract-guard']);
  const files = [
    'skills/audit-test/SKILL.md', // affected (has case)
    'skills/threat-model/SKILL.md', // coverage gap (no case)
    'evals/cases/debug-test.json', // affected via case
    'evals/samples/contract-guard.stale-consumer.pass.md', // affected via sample
    'evals/samples/lint/noop-skill/SKILL.md', // ignored (lint fixture)
    'README.md', // ignored
  ];
  const got = classifyChanges(files, skillsWithCase);
  const expect = {
    affected: ['audit-test', 'contract-guard', 'debug-test'],
    coverageGaps: ['threat-model'],
    harnessCore: false,
  };
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const okBasic =
    eq(got.affected, expect.affected) &&
    eq(got.coverageGaps, expect.coverageGaps) &&
    got.harnessCore === false;

  // A harness-core change fans out to every skill with a case.
  const core = classifyChanges(['evals/lib/grade.mjs'], skillsWithCase);
  const okCore = core.harnessCore === true && eq(core.affected, ['audit-test', 'contract-guard', 'debug-test']);

  // #148: the classifier checks above are all PURE — synthetic file lists, no
  // real git involved — so they could never have caught a broken REPO_ROOT.
  // Prove the real git-integration seam too: REPO_ROOT must land on the
  // actual repo (not two directories too high), and a real, trivial
  // (base=HEAD, so the committed leg is an empty no-op diff) call to
  // changedFiles() must not throw — that is the exact call that silently
  // returned `''` for however many PRs landed under the old `'../..'` path.
  const okRoot = repoRootLooksReal(REPO_ROOT);
  let okGitIntegration = false;
  let gitIntegrationError = '';
  try {
    changedFiles('HEAD');
    okGitIntegration = true;
  } catch (err) {
    gitIntegrationError = err.message;
  }

  const passed = okBasic && okCore && okRoot && okGitIntegration;
  console.log(
    `changed.mjs self-test: mapping=${okBasic}, harness-core fan-out=${okCore}, ` +
      `repo-root=${okRoot}, git-integration=${okGitIntegration} → ${passed ? 'OK' : 'BROKEN'}`,
  );
  if (!okBasic || !okCore) console.log('  got:', JSON.stringify(got), '\n  core:', JSON.stringify(core));
  if (!okRoot) console.log(`  REPO_ROOT resolved to ${REPO_ROOT}, which doesn't look like the repo root`);
  if (!okGitIntegration) console.log(`  changedFiles('HEAD') threw: ${gitIntegrationError}`);
  return passed;
}

// A real repo root must contain both `.git` and this very file's directory —
// a cheap, self-contained check that doesn't depend on any particular commit
// existing (unlike diffing fixed SHAs, which would be brittle history to pin).
function repoRootLooksReal(root) {
  return existsSync(resolve(root, '.git')) && existsSync(resolve(root, 'evals', 'changed.mjs'));
}
