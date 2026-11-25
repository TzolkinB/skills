# audit-test — Running just one test

Loaded from Step 4 (deep audit). "Run just that one test" is framework-specific — never run the whole suite, and never trust a run you can't confirm targeted exactly one test:

- **Jest / Vitest:** `jest -t '<test name>' <file>` / `vitest run -t '<test name>' <file>`
- **Node built-in (`node:test`):** `node --test --test-name-pattern='<test name>' <file>`
- **pytest:** `pytest '<file>::<test_id>'`
- **Go:** `go test -run '^<TestName>$' ./<pkg>`
- **JUnit (Maven / Gradle):** `mvn -Dtest='<Class>#<method>' test` / `gradle test --tests '<Class>.<method>'`
- **Playwright:** `npx playwright test <file> -g '<test title>' --project=<one project>` — `-g` targets by title; **`--project` pins a single browser** (without it every configured project runs, so "one test" executes 2–3× and muddies the result). Confirm the match first with the same command plus `--list`. App-driven → also subject to the [Reachability check](reachability-check.md).
- **Cypress:** single-`it` isolation needs the **`@cypress/grep`** plugin: `npx cypress run --spec '<file>' --env grep='<test title>'`. **Without it, `cypress run --spec` executes the *whole spec file*, not one test** — another test in the file can catch your mutation and mask the target's hollowness. So prefer a one-test spec (or install `@cypress/grep`); if you can only run the whole spec and can't attribute the result to the target test, **fall back to 🟡**. App-driven → also subject to the [Reachability check](reachability-check.md).
  - **⚠ If the Cypress runner won't launch** (`cypress verify`/`run` fails with `bad option: --smoke-test` / `--ping`, or "Cypress failed to start"): this is an **environment reachability failure, not a test verdict.** The common cause is **macOS 26 (Tahoe)**, whose incompatibility with Cypress's bundled **Electron 36** is unfixed upstream — and neither `cypress install --force` nor a Cypress version bump resolves it. Do **not** emit a 🔴/🟢 you could not actually prove — report the blocker and stop at an honest **"can't execute here."** **Remedy:** run the spec in **Docker** (`cypress/included`, with the app **and** Cypress in *one* container sharing `localhost`) or in **CI/Linux**; native runs are fine on Linux, Windows, and macOS ≤ 25.

**Paths with `[`, `]`, `(`, `)` or other regex characters** (Next.js routes such as `bookings/[id]/route.test.ts`): some runners read the file argument as a regex, so a bare path can match **zero files** or the wrong one.
- **Jest:** use `jest --runTestsByPath '<file>' -t '<test name>'`, or escape the characters (`\[id\]`). Verified: a bare bracketed path listed no tests; both fixes listed exactly the one file.
- **Vitest:** the filter is a plain substring, so pass the path **as is** and quote it. Do **not** escape — `\[id\]` matches nothing. Verified with `vitest list`: bare listed the test, escaped listed none.
- **Playwright:** file args are regexes, so a bare `[id]` matches nothing ("Total: 0 tests"). Escape the characters (`'src/\[id\]/a.spec.ts'`). Verified with `--list`: escaped listed exactly one test.
- Whatever the runner, the rule below still decides: if you cannot confirm exactly one test ran, fall back to 🟡.

If the name is ambiguous (duplicate names, parametrized cases), target by file + name and **confirm the run executed exactly one test**. A selector that matches zero tests "passes" vacuously and would fake a 🟢 — if you can't confirm exactly one test ran, fall back to 🟡.
