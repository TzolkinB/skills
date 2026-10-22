// Clean-room check (see CLAUDE.md). Runs on every pull request.
//   Rule A: the PR body must either tick all four clean-room boxes or say "Clean-room: n/a".
//   Rule B: no added line in a non-Markdown file may carry a restrictive-license marker
//           (a sign that code was pasted from an AGPL / Elastic-licensed source).
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RESTRICTED = /SPDX-License-Identifier:\s*[^\n]*(AGPL|Elastic)|GNU Affero General Public License|Elastic License/i;

// The check's own files necessarily contain the marker words it looks for.
const SELF = /^\.github\/(scripts\/clean-room-check|workflows\/clean-room\.yml)/;

export function checkBody(body = '') {
  if (/clean-room:\s*n\/a/i.test(body)) return [];
  const section = body.split(/^#+\s*Clean-room check/im)[1];
  if (section === undefined) {
    return ['PR body has no "Clean-room check" section. Tick the four boxes, or write "Clean-room: n/a" if this change was not inspired by another tool.'];
  }
  const boxes = section.split(/^#+\s/m)[0].split('\n').filter((l) => /^\s*-\s*\[[ xX]\]/.test(l));
  if (boxes.length < 4) return ['The Clean-room check section is missing some of its four boxes.'];
  const open = boxes.filter((l) => /\[ \]/.test(l));
  return open.length ? [`${open.length} clean-room box(es) are not ticked. Tick them, or write "Clean-room: n/a".`] : [];
}

export function scanDiff(diff = '') {
  const problems = [];
  let file = '';
  let line = 0;
  for (const text of diff.split('\n')) {
    if (text.startsWith('+++ ')) { file = text.slice(6); continue; }
    const hunk = text.match(/^@@ -\S+ \+(\d+)/);
    if (hunk) { line = Number(hunk[1]) - 1; continue; }
    if (text.startsWith('+') && !text.startsWith('+++')) {
      line += 1;
      if (!/\.md$/i.test(file) && !SELF.test(file) && RESTRICTED.test(text)) {
        problems.push(`${file}:${line} adds a restrictive-license marker (AGPL/Elastic). Do not paste code from those sources.`);
      }
    } else if (!text.startsWith('-')) line += 1;
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { PR_BODY = '', BASE_SHA, HEAD_SHA } = process.env;
  const diff = BASE_SHA && HEAD_SHA
    ? execFileSync('git', ['diff', '-U0', `${BASE_SHA}...${HEAD_SHA}`], { encoding: 'utf8', maxBuffer: 1 << 28 })
    : '';
  const problems = [...checkBody(PR_BODY), ...scanDiff(diff)];
  for (const p of problems) console.log(`::error::${p}`);
  if (problems.length) process.exit(1);
  console.log('clean-room check passed');
}
