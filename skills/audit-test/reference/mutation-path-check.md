# audit-test — Mutation path check (is the change on the test's path?)

Loaded from Step 4. Run it **before** a mutation is applied, and read its second half **after** a 🟢 or a 🔴 candidate. It costs one read, not an extra run. ([ADR-0056](../../../docs/adr/0056-audit-test-checks-the-mutation-is-on-the-tests-path.md), #275.)

A mutation in the wrong place gives a wrong answer both ways. A change in code the test never calls survives, which fakes a 🔴. A change that breaks the whole module can "kill" a test for the wrong reason, which fakes a 🟢. The [Reachability check](reachability-check.md) does not catch either: it proves the harness is source-live, not that *this* change was on *this* test's path.

## Before the mutation runs

1. **Name the entry call.** The function, route handler, class method or page action the test invokes (for example `createBooking`, the `POST` handler, `AdminNewBookingPage.submit`).
2. **Show the line you will change and its enclosing function.** One line of the report, e.g. `src/bookings/route.ts:41 in POST`.
3. **Confirm it sits on the path.** The enclosing function is the entry call, or is reached from it through calls you have read (follow imports across files). Do not guess from the file name.
4. **Off the path → reject it.** Another handler (`GET` when the test calls `POST`), a branch the test's inputs never reach, setup code a different test uses. Do not run it and do not count it as a run. Choose a mutation on the path. **A mutation someone else suggested gets the same check.** If you cannot find a path, say so and fall back to **🟡 Likely**.

## After the mutation runs

5. **A kill must come from the target.** For 🟢 the output must show an assertion failure (or a timeout on the UI state the test waits for) **in this test**. A syntax, compile or import error, a crash while loading the module, or a failure in a different test is **not** a kill: the change broke more than the target. Make the mutation valid and local, and run again.
6. **If you cannot tell why it failed**, run the same single test once on the **unmutated** code. If it fails there too, the test is already red: report that, and record neither 🟢 nor 🔴.
7. **A 🔴 candidate needs both checks:** this one (the change was on the path) and the [Reachability check](reachability-check.md) (the harness runs the edited source). Either failing means **🟡**, not 🔴.

State the result in the finding's **Proof** line: the entry call, the mutated line and function, and why the failure came from the target.
