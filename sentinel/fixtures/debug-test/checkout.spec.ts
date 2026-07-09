// KNOWN-BAD INPUT for /debug-test (Playwright)
// A failing test whose root cause is catchable by Step 2 QA heuristics without any
// routing: the retrying assertion is never awaited, so `expect(...).toBeVisible()`
// returns a floating promise that is never enforced. The test either passes falsely
// or fails with an unhandled-rejection / wrong-value signal rather than a real check.
// Run: `/debug-test sentinel/fixtures/debug-test/checkout.spec.ts`

import { test, expect } from '@playwright/test';

test('shows confirmation after checkout', async ({ page }) => {
  await page.goto('/checkout');
  await page.getByRole('button', { name: 'Pay now' }).click();

  const banner = page.getByText('Order confirmed');

  // BUG: missing `await`. Playwright web-first assertions are async and must be awaited;
  // without it the assertion never actually retries or fails the test.
  expect(banner).toBeVisible();
});
