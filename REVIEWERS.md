# Reviewing these QA skills? Start here.

Thanks for taking a look. This is an early, honest ask: I want to know whether the flagship skill
earns its keep on *your* real tests — and whether anything reads as over-claiming.

## The one skill to focus on: `/audit-test`

It answers: **would this passing test actually fail if the code it covers broke?** — and proves the
answer by running one targeted mutation, not by reasoning.

Its differentiator is honesty in both directions on **app-driven (Playwright/Cypress) tests**:

- won't fake a 🔴 on a stale/served app where the mutation never reaches the running code *(reachability guard)*
- catches a 🟢 that's been **pinned to a regression** — the trap a self-healer leaves when it "fixes"
  a red test by editing the expected value *(baseline-lock)*

## Try it in ~10 minutes (on your own repo)

1. **Install:** `/plugin marketplace add TzolkinB/skills` then `/plugin install kimbell-skills@kimbell`
2. **Point it at a passing test you don't fully trust:**
   `/audit-test path/to/your.spec.ts path/to/the-code-it-covers.ts`
   (Giving it both the test *and* its code is the first-class mode — it can reason about what should break.)
3. **Make sure the app is "dev-served"** — *Playwright/Cypress only; skip this for unit tests.*

   `/audit-test` works by editing your source, re-running one test, then reverting. For that edit to
   reach your app, the running app must reflect source changes **live**:

   - ✅ **Dev-served (what you want):** the test starts your app with a dev server that recompiles on
     the fly — `npm run dev`, `vite`, `next dev`, `ng serve`. Check your Playwright
     `webServer.command` in `playwright.config` (or however you start the app for Cypress): if it's
     your **dev** command, you're set.
   - ⚠️ **Warm dev server (HMR) — one more step:** a watch-mode dev server (Vite/webpack HMR) can
     propagate an edit *asynchronously*, so a survival that wasn't confirmed live is **inconclusive, not
     🔴**. `/audit-test` forces the mutation live first — a fresh-boot-per-run harness (e.g.
     `cypress/included`, or a built/CI server) or a dev-server restart/hard-reload; a `sleep` doesn't fix
     it ([reachability-check](./skills/audit-test/reference/reachability-check.md)).
   - ❌ **Build-served / deployed (won't work):** the test runs against a pre-built or deployed copy —
     `build && preview`, a served `dist/` or `build/` folder, `next start`, or a live `https://…` URL.
     Your source edit never reaches that running app, so the audit can't prove anything. **audit-test
     detects this and downgrades to 🟡 with an explanation rather than reporting a false result** — but
     you only get a real verdict when dev-served.
   - **If you're build-served:** for the audit run, temporarily point your test's `webServer.command`
     at your dev command (`npm run dev`), or just run `/audit-test` on a **unit test** instead — those
     import the code directly and always work, no dev server needed.

   Unit tests (Jest / Vitest / pytest) are always source-live — this step only matters for tests that
   drive a running app.

## No Claude Code? Paste-and-run

The skill *is* just a self-contained procedure — the plugin install is only convenience, so you can
run it in almost anything:

- **Any agentic coding tool with file + shell access** (Cursor agent mode, Cline, Windsurf, Copilot
  agent, Codex CLI, …) → **full fidelity.** Paste the raw skill
  ([`skills/audit-test/SKILL.md`](./skills/audit-test/SKILL.md)) and say: *"Follow this procedure to
  audit the test `X` in `path/to/test`, whose code is `path/to/code`. Clean git tree; mutate → run one
  test → revert."* Replace the `$ARGUMENTS` reference with your actual paths. It mutates, runs one
  test, reverts, and gives the same execution-confirmed verdict as the installed skill. *(This is exactly
  how it was validated — pointed at the raw file, no install.)*
- **A plain chat with no tools** (a vanilla Claude/ChatGPT window) → it can't run a mutation, so it
  falls back to the **reasoned-only 🟡** path the skill explicitly defines: static triage + a mutation
  thought-experiment. Weaker (no proof), but honest — it won't dress reasoning up as a confirmed verdict.

## One known limitation to watch (please poke at this)

`/audit-test` reasons only about the code you point it at. If a behavior is *also* enforced by
something it can't see — a **database constraint/trigger, or an external service/validator** — then
removing the app-level guard may not change what the test observes, and audit-test could in principle
report a **false 🔴** (calling a good test hollow). In practice it often handles this well: it reasons
about defense-in-depth and, when the hidden layer surfaces a *different* result, attributes correctly.
The risk is narrow — a hidden layer that produces an *identical* observable outcome with no trace in
the code. **So if you get a 🔴, sanity-check it: is this behavior guarded somewhere audit-test couldn't
see?** If so, tell me — that false-🔴 is exactly the edge I most want to find.

## The feedback I actually want

1. **Did you reach for `/audit-test` again unprompted?** (the real signal — did it earn a second use?)
2. **Did it catch something real** — a test that looked fine but guarded nothing, or one pinned to a
   regressed value?
3. **Did anything read as over-claiming / slop** — a verdict it hadn't earned? *(Be brutal here — this
   is the thing I most want to know.)*
4. **Where did it get in your way or misfire?** (false positives, confusing output, setup friction.)

## The other skills

They're here too — try them if useful (`/ask-sentinel` routes you to the right one). But they're
honest **static** helpers that reason about your tests; `/audit-test` is the one making the strong,
execution-backed claim, so that's where I want your scrutiny.

## How to send feedback

File a GitHub issue on the repo, or just reply to me directly. Real usage against real code is
exactly what sharpens this. Thank you.
