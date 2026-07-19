#!/usr/bin/env node
// Phase 0 static lint for the Sentinel skill-eval harness (issue #74).
//
// No model calls, no network — pure text over SKILL.md files, meant to run on
// every commit (pre-commit hook or CI). Catches the cheap rot the "Don't ship
// skills without evals" talk and Matt Pocock's kill-the-noops flag:
//
//   * no-op directives  — hollow instructions that change no agent behavior;
//                         reported for HUMAN REVIEW, never auto-stripped.
//   * description shape  — missing / too short / no directive.
//   * dead local links   — a relative .md/reference link that doesn't resolve.
//   * frontmatter sanity — name + description required; allowed-tools expected;
//                          invocation mode noted.
//   * line ceiling       — <500 (skillsbench); informational here (we're ~160).
//
// Severity: `error` fails the run; `warn`/`review` do not, unless --strict.
// (ADR-0013 lineage: label, don't gate — until a check earns a gate.)
//
// Usage:
//   node evals/lint.mjs                 # lint skills/*
//   node evals/lint.mjs --strict
//   node evals/lint.mjs path/to/skills  # lint a specific tree
//   node evals/lint.mjs --self-test     # prove detection on a seeded skill

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { dirname, resolve, join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const EVALS_ROOT = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(EVALS_ROOT, '../..');

// Conservative — only the clearest hollow phrases, since the goal is a signal a
// human reviews, not a firehose. Extend as real no-ops surface.
const NOOP_PATTERNS = [
  /\bwrite (clean|readable|high[- ]quality|good) code\b/i,
  /\bfollow (industry )?best practices\b/i,
  /\bhigh[- ]quality code\b/i,
  /\bclean and maintainable\b/i,
  /\bproduction[- ]ready\b/i,
  /\bmake (it|the code) (more )?readable\b/i,
  /\bas (needed|appropriate)\b/i,
  /\bwhere appropriate\b/i,
  /\bif (necessary|needed)\b/i,
  /\bbe sure to (carefully|properly)\b/i,
];

const targets = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const strict = process.argv.includes('--strict');
const selfTest = process.argv.includes('--self-test');

const roots = selfTest
  ? [resolve(EVALS_ROOT, 'samples/lint')]
  : targets.length
    ? targets.map((t) => (isAbsolute(t) ? t : resolve(process.cwd(), t)))
    : [resolve(REPO_ROOT, 'skills')];

const findings = [];
const skillFiles = roots.flatMap(findSkillFiles);
for (const f of skillFiles) lintSkill(f);

report(findings, skillFiles.length);

if (selfTest) {
  const reviews = findings.filter((f) => f.level === 'review').length;
  const errors = findings.filter((f) => f.level === 'error').length;
  const passed = reviews >= 1 && errors >= 1;
  console.log(
    `\nself-test: seeded no-op detected=${reviews >= 1}, dead link detected=${errors >= 1} → ${passed ? 'OK' : 'BROKEN'}`,
  );
  process.exit(passed ? 0 : 1);
}

const hardFail = findings.some((f) => f.level === 'error') || (strict && findings.length > 0);
process.exit(hardFail ? 1 : 0);

// ---- checks ---------------------------------------------------------------

function lintSkill(file) {
  const rel = file.replace(REPO_ROOT + '/', '');
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');
  const add = (level, line, msg) => findings.push({ level, rel, line, msg });

  // frontmatter
  const fm = parseFrontmatter(src);
  if (!fm) add('error', 1, 'no YAML frontmatter (--- … ---) found');
  else {
    if (!fm.values.name) add('error', fm.lineOf('name') ?? 1, 'frontmatter missing `name`');
    if (!fm.values.description) add('error', fm.lineOf('description') ?? 1, 'frontmatter missing `description`');
    else if (fm.values.description.length < 25)
      add('warn', fm.lineOf('description'), `description looks thin (${fm.values.description.length} chars) — say why + how`);
    if (!/allowed-tools/.test(fm.raw)) add('warn', 1, 'frontmatter has no `allowed-tools` — declare the tool surface');
    // Invocation mode must be a conscious choice (ADR-0020: leaves are user-invoked,
    // only the router/orchestrator are model-invoked). We can't read intent, but we
    // can surface the model-invoked exception for confirmation and catch a malformed flag.
    const dmi = fm.values['disable-model-invocation'];
    if (dmi === undefined)
      add('review', fm.lineOf('name') ?? 1, "model-invoked (no `disable-model-invocation`) — always-on description; confirm intended (ADR-0020)");
    else if (dmi !== 'true')
      add('warn', fm.lineOf('disable-model-invocation'), `\`disable-model-invocation\` should be \`true\` or omitted, got \`${dmi}\``);
  }

  // line ceiling (informational)
  if (lines.length > 500) add('warn', lines.length, `SKILL.md is ${lines.length} lines (>500 skillsbench ceiling)`);

  // no-op directives
  lines.forEach((ln, i) => {
    if (i === 0) return;
    for (const re of NOOP_PATTERNS) {
      const m = ln.match(re);
      if (m) add('review', i + 1, `possible no-op: “${m[0]}” — does it change agent behavior? if not, cut it`);
    }
  });

  // dead local links
  const dir = dirname(file);
  for (const { target, line } of markdownLinks(src)) {
    const path = target.split('#')[0];
    if (!path || /^(https?:|mailto:)/.test(path)) continue;
    if (!/\.(md|mjs|js|ts|json|sh)$/.test(path) && !path.includes('/')) continue;
    const resolved = resolve(dir, path);
    if (!existsSync(resolved)) add('error', line, `dead link → ${target}`);
  }
}

// ---- parsing helpers ------------------------------------------------------

function parseFrontmatter(src) {
  if (!src.startsWith('---')) return null;
  const end = src.indexOf('\n---', 3);
  if (end < 0) return null;
  const raw = src.slice(3, end);
  const values = {};
  const lineIndex = {};
  raw.split('\n').forEach((l, i) => {
    const m = l.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (m) {
      values[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
      lineIndex[m[1]] = i + 2; // +1 for the opening ---, +1 for 1-based
    }
  });
  return { raw, values, lineOf: (k) => lineIndex[k] };
}

function markdownLinks(src) {
  const out = [];
  src.split('\n').forEach((l, i) => {
    for (const m of l.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) out.push({ target: m[1], line: i + 1 });
  });
  return out;
}

function findSkillFiles(root) {
  if (!existsSync(root)) return [];
  if (statSync(root).isFile()) return root.endsWith('SKILL.md') ? [root] : [];
  const out = [];
  for (const name of readdirSync(root)) {
    const p = join(root, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...findSkillFiles(p));
    else if (name === 'SKILL.md') out.push(p);
  }
  return out;
}

// ---- reporting ------------------------------------------------------------

function report(all, scanned) {
  const icon = { error: '✗', warn: '!', review: '?' };
  if (!all.length) {
    console.log(`\n✅ lint clean across ${scanned} SKILL.md file(s)\n`);
    return;
  }
  const byFile = {};
  for (const f of all) (byFile[f.rel] ??= []).push(f);
  console.log('');
  for (const [rel, fs] of Object.entries(byFile)) {
    console.log(rel);
    for (const f of fs.sort((a, b) => a.line - b.line)) console.log(`  ${icon[f.level]} ${f.level}:${f.line}  ${f.msg}`);
    console.log('');
  }
  const n = (lvl) => all.filter((f) => f.level === lvl).length;
  console.log(`scanned ${scanned} file(s) — ${n('error')} error, ${n('warn')} warn, ${n('review')} review\n`);
}
