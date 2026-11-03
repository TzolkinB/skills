<!-- RECORDED SAMPLE — a faithful /qa-review run on the booking-notifier.ts fixture. Surfaces the
     silent `?? []` drop and the console-only failure signal, stays in the testability lane. Used by
     run-eval.mjs --dry-run offline. -->

## QA Review: booking-notifier.ts

### Testability Issues (Will Slow You Down)
- [ ] **MEDIUM** Line 18: `byId.get(id) ?? []` silently drops any room id with no matching row — the email can name fewer rooms than the contact booked, and no log, return value or throw records it. A test of the happy path cannot see this.
- [ ] **MEDIUM** Line 24: both `catch` blocks swallow the error and the promise always resolves — a test cannot tell "sent" from "failed" except by spying on `console.error`.

### Coupling / Mock Challenges
- [ ] `sendEmail` and `db` are imported singletons — they can only be replaced by module mocking, which works but is the only seam.

### Unclear Contracts
- [ ] What should the confirmation say when some room ids cannot be resolved? The code picks "name the ones that resolved", which is never stated.

### Suggestions
1. Decide the unresolved-id behaviour explicitly (log the missing ids, and treat it like a failed lookup).
2. Return an observable result, or inject a logger, so failure is not console-only.

**Next:** fix the seams above, then `/coverage-review booking-notifier.test.ts fixtures/qa-review/booking-notifier.ts` — mocking around them locks the coupling in
