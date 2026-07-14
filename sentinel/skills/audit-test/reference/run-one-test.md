# audit-test — Running just one test

Loaded from Step 4 (deep audit). "Run just that one test" is framework-specific — never run the whole suite, and never trust a run you can't confirm targeted exactly one test:

- **Jest / Vitest:** `jest -t '<test name>' <file>` / `vitest run -t '<test name>' <file>`
- **pytest:** `pytest '<file>::<test_id>'`
- **Go:** `go test -run '^<TestName>$' ./<pkg>`
- **JUnit (Maven / Gradle):** `mvn -Dtest='<Class>#<method>' test` / `gradle test --tests '<Class>.<method>'`
- **Playwright:** `npx playwright test <file> -g '<test title>' --project=<one project>` — `-g` targets by title; **`--project` pins a single browser** (without it every configured project runs, so "one test" executes 2–3× and muddies the result). Confirm the match first with the same command plus `--list`. App-driven → also subject to the [Reachability check](reachability-check.md).
- **Cypress:** single-`it` isolation needs the **`@cypress/grep`** plugin: `npx cypress run --spec '<file>' --env grep='<test title>'`. **Without it, `cypress run --spec` executes the *whole spec file*, not one test** — another test in the file can catch your mutation and mask the target's hollowness. So prefer a one-test spec (or install `@cypress/grep`); if you can only run the whole spec and can't attribute the result to the target test, **fall back to 🟡**. App-driven → also subject to the [Reachability check](reachability-check.md).
  - **⚠ If the Cypress runner won't launch** (`cypress verify`/`run` fails with `bad option: --smoke-test` / `--ping`, or "Cypress failed to start"): this is an **environment reachability failure, not a test verdict.** The common cause is **macOS 26 (Tahoe)**, whose incompatibility with Cypress's bundled **Electron 36** is unfixed upstream — and neither `cypress install --force` nor a Cypress version bump resolves it. Do **not** emit a 🔴/🟢 you could not actually prove — report the blocker and stop at an honest **"can't execute here."** **Remedy:** run the spec in **Docker** (`cypress/included`, with the app **and** Cypress in *one* container sharing `localhost`) or in **CI/Linux**; native runs are fine on Linux, Windows, and macOS ≤ 25.

If the name is ambiguous (duplicate names, parametrized cases), target by file + name and **confirm the run executed exactly one test**. A selector that matches zero tests "passes" vacuously and would fake a 🟢 — if you can't confirm exactly one test ran, fall back to 🟡.
