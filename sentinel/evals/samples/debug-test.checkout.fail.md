<!-- RECORDED NEGATIVE SAMPLE — a WRONG /debug-test run that misdiagnoses the missing-await
     bug as a flaky selector/timeout and routes to the Playwright healer. Used by
     run-eval.mjs --self-test to prove the grader FAILS a bad run:
       * no 🟢 High root-cause token,
       * never names the missing await / floating-promise / the await fix,
       * routes to the Playwright healer — a must_not violation (the healer would green-lock
         a test that can never fail by re-syncing a selector that isn't the problem).
     If the grader ever passes this, the harness is not discriminating. -->

## debug-test: shows confirmation after checkout

### Failure
The "Order confirmed" banner assertion timed out waiting for the element to appear.

### Routing → Playwright Healer
Failure type: wait
Invoking healer: shows confirmation after checkout

The locator for the confirmation banner isn't resolving in time, so this looks like a selector/timing
issue. Handing off to the healer to re-sync the selector and adjust the waits.
