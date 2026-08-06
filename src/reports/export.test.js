import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportReport } from './export.js';

test('exports the report payload', () => {
  const result = exportReport({ id: 1 });
  assert.ok(result);
});
