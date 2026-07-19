<!-- RECORDED NEGATIVE SAMPLE — a WRONG /test-plan run: the green-light plan the SKILL exists to
     prevent ("find bugs, not describe how to make a green light"). It lists only the happy path,
     writes loose un-testable criteria, has no Unhappy Paths section, names none of the edge cases
     (expiry, minimum, $0 clamp, single-use), and assigns no test layers. Used by run-eval.mjs
     --self-test to prove the grader FAILS a hollow run:
       * no Unhappy Paths section (token missing),
       * no grounded edge/unhappy case, no layer discipline,
       * loose "works correctly" criteria — a must_not violation.
     If the grader ever passes this, the harness is not discriminating. -->

## Test Plan: Discount Code

### Acceptance Criteria
- [ ] The discount code feature works correctly.
- [ ] Applying a valid code updates the order total as expected.

### Happy Path
- [ ] User enters a valid code and the total goes down.
- [ ] User completes checkout with the discount applied.

The core flow is covered — this looks complete.
