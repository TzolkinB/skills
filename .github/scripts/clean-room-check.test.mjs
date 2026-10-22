import test from 'node:test';
import assert from 'node:assert/strict';
import { checkBody, scanDiff } from './clean-room-check.mjs';

const ticked = '## Clean-room check\n\n- [x] a\n- [x] b\n- [x] c\n- [x] d\n';

test('all four boxes ticked passes', () => assert.deepEqual(checkBody(ticked), []));
test('n/a passes', () => assert.deepEqual(checkBody('Clean-room: n/a - not inspired by a tool'), []));
test('an unticked box fails', () => assert.equal(checkBody(ticked.replace('[x] d', '[ ] d')).length, 1));
test('no section and no n/a fails', () => assert.equal(checkBody('just a description').length, 1));
test('empty body fails', () => assert.equal(checkBody('').length, 1));
test('a section with fewer than four boxes fails', () => assert.equal(checkBody('## Clean-room check\n- [x] a\n').length, 1));

const diffWith = (file, added) => `+++ b/${file}\n@@ -1,0 +1,1 @@\n+${added}\n`;
test('AGPL header added to code fails', () => assert.equal(scanDiff(diffWith('skills/x.mjs', '// SPDX-License-Identifier: AGPL-3.0-only')).length, 1));
test('Elastic license text in code fails', () => assert.equal(scanDiff(diffWith('skills/x.mjs', '// Elastic License 2.0')).length, 1));
test('the same words in Markdown are allowed', () => assert.deepEqual(scanDiff(diffWith('docs/map.md', 'mewt is AGPL-3.0, SPDX-License-Identifier: AGPL')), []));
test('ordinary code passes', () => assert.deepEqual(scanDiff(diffWith('skills/x.mjs', 'export const a = 1;')), []));
test('reports the line number', () => assert.match(scanDiff(diffWith('skills/x.mjs', 'GNU Affero General Public License'))[0], /skills\/x\.mjs:1 /));
test('the check\'s own files are exempt', () => assert.deepEqual(scanDiff(diffWith('.github/scripts/clean-room-check.mjs', 'Elastic License')), []));
