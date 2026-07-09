# Sentinel — Project Discussion Summary

A reference log of the decisions made while merging the SDET Framework Building Guide with the Sentinel plugin. For the plugin's own internal docs, see `ARCHITECTURE.md` (design rationale) and `LEARNINGS.md` (usage/research log) inside the plugin itself — this doc is the conversation-level record, one level up.

---

## 1. What got merged, and why

Two source projects: the **SDET Framework Building Guide** (a personal strategy doc — solve your real problem, document the why, make it portable, then polish for release) and **Sentinel** (an already-built 6-skill Claude Code plugin for QA-first testing). "Combining" them meant applying the Guide's process to the finished artifact, not building two separate things.

**Identity resolved early:** Kim and the person building this are the same person. No persona-stripping needed — Kim's voice in the docs stays as-is. "Jon" was a build-credit reference, not a separate identity to reconcile.

**Scope decision:** Deliberately kept test/QA-focused rather than broadened into a general orchestration layer, to stay maintainable. This was a conscious choice, revisited and reaffirmed later in the conversation.

## 2. What was actually built

- **6 skills** (`test-plan`, `coverage-review`, `qa-review`, `bug-report`, `test-assert`, `sentinel`) — carried over from the original build essentially unchanged; they were already solid.
- **`ARCHITECTURE.md`** (new) — the Guide's "capture the why" deliverable. Covers: why 6 separate skills instead of one prompt, why `/sentinel` orchestrates instead of everything being flat, why a 3-state verdict (PASS/CAUTION/FAIL) instead of binary, why loose assertions count as gaps, and an honest tradeoffs section (no real test-runner execution, judgment-based severity, markdown not structured output).
- **`--explain` flag** on all 6 skills — optional, off by default. When passed, each report adds a "Why This Matters" section teaching the underlying concept, not just the finding. `/sentinel` propagates the flag to whichever sub-skills it calls.
- **`GLOSSARY.md`** (new) — plain-language definitions (boundary condition, loose assertion, flaky test, mocking, coverage vs. verification, etc.) that explain-mode links back to instead of re-explaining every time.
- **`LEARNINGS.md`** (new) — a growing, dated log of what real usage and real research actually taught, distinct from ARCHITECTURE.md's stable rationale. Currently contains the competitive-landscape research entry (see below) and a template for logging the first real run against a private repo (mosaic-room-booking).
- **`CONTRIBUTING.md`** (new) — specific, non-generic questions to ask seasoned QA professionals for real feedback, plus where to log it (in LEARNINGS.md's "Expert Feedback" section). Explicitly: don't write up feedback that hasn't happened yet.
- **README Roadmap section** — starter templates, progressive unit→E2E guide, a testing decision tree. Attributed honestly to the stated newcomer-focused goal, not to a Guide section that doesn't actually exist in the source doc.
- **`DEPLOYMENT.md`** — generalized machine-specific paths, kept the publish steps.
- **`index.html`** — landing page, unchanged from the original build (see gap noted below).

## 3. Corrections made along the way

- **Fact-checked another AI's feedback** that claimed the Guide had a "Scaling for Learners" and "Getting Feedback from Seasoned QA" section. Initially flagged this as likely fabricated (the uploaded Guide didn't have it, and the citation markers were empty). Turned out to be real — those sections were added to the Guide in a *different* conversation, after the version uploaded here. Correction: don't assume staleness cuts only one way; verify before calling something fabricated.
- **Corrected an overstated claim about Sentinel's own design.** Described all 6 skills as one forced sequential pipeline when comparing against competitors. Actually: only `/sentinel` chains anything, and it composes 4 of 6 (`test-plan`, `coverage-review`, `qa-review`, `test-assert`) — `bug-report` is independent. The real design intent, stated from the start, is mix-and-match, with `/sentinel` as one optional full-pass mode on top. Corrected both in conversation and in `LEARNINGS.md`.
- **Source of truth for the Guide** is the copy in the Desktop project folder, not whatever's pasted into any given chat — established explicitly to prevent future drift.

## 4. Competitive landscape research (verified independently, not just taken from secondhand AI research)

The Claude Code QA-skill space is crowded, not underserved:
- **gstack** — live-browser QA (`/qa`, `/qa-only`), real Chromium execution, not static analysis. Noted elsewhere as token-heavy/bloated when fully enabled.
- **myclaude** — generates test plans from PRDs/specs, overlaps `test-plan`.
- **levnikolaevich/claude-code-skills** — broad multi-category codebase audit suite including test coverage gaps and structure.
- **Superpowers** (173k+ stars) — `systematic-debugging` skill, overlaps `test-assert`'s territory.
- **qaskills.sh** — 450+ curated QA skills across the testing pyramid.

**Conclusion:** No single tool found combines test-plan + coverage-review + qa-review + test-assert into one synthesized ship/no-ship verdict while keeping each independently callable — that specific combination appears to be a real, if narrow, differentiator. But most individual techniques already exist elsewhere, often with real execution behind them (Sentinel's skills reason over static text; they don't run anything). Decision: don't chase differentiation against the ecosystem — the original personal motivation (tests that chase green lights, drowning in code review) is real regardless of what else exists, and that's reason enough to keep building.

## 5. "Is this just a GPT wrapper?"

Answered directly: yes, in the strict sense — no custom model, no fine-tuning, just markdown instructions Claude follows. So is essentially the entire ecosystem researched above (gstack, myclaude, Superpowers — all SKILL.md files). The honest framing is "workflow/prompt engineering that encodes QA judgment," not "AI infrastructure" — a defensible answer in an interview, not a defensive one.

## 6. Three target audiences — and an honest assessment of each

Stated goal: build for QA professionals, developers, and people new to tech. Assessment per audience:

- **QA professionals** — weakest case. This audience already has access to deeper, execution-based tools (gstack, levnikolaevich). Not worth building toward as a primary target.
- **Developers** — mixed, but real: Sentinel's lightweight, readable, no-heavy-setup nature is a legitimate differentiator against bloated alternatives, if leaned into deliberately.
- **New to tech** — strongest case. Nothing found in the competitive research has a teaching layer. `GLOSSARY.md` + `--explain` mode fill a real, currently-empty niche.

**Overall recommendation:** stop measuring Sentinel against production-velocity tools (gstack, etc.) — different category entirely. Lean into "small, honest, teaching-oriented tool that's also personally useful" rather than competing on capability.

## 7. Open gap identified (not yet resolved)

The landing page (`index.html`) is accurate on the mechanics (all 6 skill cards match the real SKILL.md files) but is **stale relative to the project's current direction**:
- No mention of `--explain` mode, `GLOSSARY.md`, `LEARNINGS.md`, `CONTRIBUTING.md`, or the Roadmap
- Framed entirely as "built by a QA professional, for QA professionals" — doesn't reflect the newcomer-facing angle that the conversation concluded is actually the strongest differentiator

**Not yet decided:** whether/when to update the landing page to reflect this.

## 8. Still outstanding

- First real test run against mosaic-room-booking (private repo) hasn't happened yet — `LEARNINGS.md`'s usage-log template is waiting for that entry.
- No expert QA feedback logged yet.
- Landing page update (see #7) — pending a decision.

---

## 9. Competitive research follow-up: gstack's `/qa` and `/qa-only` specifically

Follow-up session focused narrowly on gstack (from §4) — tried to find reviews of its `/qa` and `/qa-only` skills from senior/experienced QA or SDET voices specifically, not general marketing coverage.

**Search outcome:** no substantive review found from a named, credentialed QA/SDET professional evaluating `/qa`/`/qa-only` directly. What exists publicly instead:
- Promotional/enthusiast writeups (dev.to, Medium, "AgentConn," "Augment Code" blog) — functional descriptions, not critical practitioner assessments.
- A Hacker News thread (referenced via Garry Tan's own tweet: "didn't get totally destroyed... people were kind of nice") — visible commentary was about YC/startup-signal concerns, not QA rigor.
- A GitHub security issue (#1579) on prompt-injection risk when `/qa` points its headless browser at arbitrary URLs — the closest thing to a substantive technical critique found, but security-focused, not test-quality/coverage-focused.
- Generic industry content on agentic AI testing (TestGuild, QA Wolf, AIMultiple) that is skeptical of the *category* of browser-driving AI testing agents (e.g. "most AI testing tools are just GPT wrappers"; "skilled QA engineers generally avoid these tools... don't build transferable coding skills") but doesn't name gstack specifically.

**Key architectural distinction surfaced:** gstack's `/qa` is "Agentic Manual Testing" in QA Wolf's taxonomy — a live headless-Chromium session driven per-run (navigate, click, screenshot, diff), non-deterministic, not portable to CI, can't parallelize the same way. Sentinel's own skills are a third category again — reasoning over static text/diffs, no execution at all (already captured honestly in `ARCHITECTURE.md`'s tradeoffs section).

**Relevance to Sentinel:** reinforces the §4 conclusion — don't benchmark Sentinel against gstack's category. The "AI testing tools" landscape has at least three distinct tiers worth keeping straight in future competitive notes:
1. Agentic Automated Testing — generates real, versionable Playwright/Appium code, deterministic, CI-runnable (e.g. QA Wolf, testRigor).
2. Agentic Manual/Browsing Testing — live computer-use-style agents driving a real or headless browser per session (gstack `/qa`).
3. Static/reasoning-based review — no execution, reasons over code/diffs/text and produces judgment calls (Sentinel).

**Not yet logged in `LEARNINGS.md`:** this three-tier distinction is worth adding there as a refinement of the existing competitive-landscape entry, since it sharpens *why* comparing Sentinel to gstack was the wrong frame, rather than just asserting it was.
