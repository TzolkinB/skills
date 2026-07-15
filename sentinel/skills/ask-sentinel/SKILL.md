---
name: ask-sentinel
description: Router — describe your QA situation and get pointed at the right Sentinel skill, plus where it sits in the flow across Sentinel's skills
argument-hint: "[what you're trying to do, or a file/branch/situation — omit for the full map]"
allowed-tools: [Read, Glob]
---

A dozen Sentinel skills is more than anyone wants to memorize. `ask-sentinel` is the front door: describe the situation in plain terms — *"AI just wrote 500 lines of tests"*, *"a Playwright test is red"*, *"about to merge"* — and it names the one skill that answers your question, says why, and shows where that step sits in the wider QA flow.

It **routes; it doesn't analyze** — never reads your code, never runs a test, never emits a verdict; it hands you the skill that does. It is not one of them and never joins the `/sentinel` chain — it's the map, not a stop on the route. The one rule worth internalizing: **`/sentinel` is the orchestrator, not a peer** — the other atomic skills run standalone, and each answer exactly one question. Route to an atomic skill for a specific question; route to `/sentinel` for the "am I safe to merge" moment.

## The core skills, by the question each answers

| Skill | Question it answers | Reach for it when |
|---|---|---|
| `/test-plan` | What *should* be tested, before any code exists? | You're about to build a feature and want the cases + layers up front |
| `/qa-review` | Is this code testable at all? | Mid code-review — hard-coded deps, `Date.now()`, hidden coupling |
| `/coverage-review` | Of what's testable, what's actually covered? | AI wrote tests; you need the *missing* cases and loose assertions |
| `/audit-test` | Would this *passing* test fail if the code it covers broke? | A test is green and you don't trust it — prove it by mutation |
| `/prune-tests` | Which existing tests cost more than they protect? | The suite is slow/noisy — cut redundant, over-mocked, stale tests |
| `/threat-model` | If this change is wrong, what breaks in production and would anyone notice? | Before shipping something risky — blast radius, detectability, reversibility |
| `/debug-test` | A Playwright test is failing — root cause and fix? | A `*.spec.ts` is red and you want it diagnosed and routed |
| `/bug-report` | How do I hand this off cleanly? | Something broke and you need a structured, repro-able report |
| `/sentinel` | What's the net verdict across all of the above? | The merge gate — full pass on a branch, one PASS/CAUTION/FAIL |

`/threat-model` and `/bug-report` are core-but-independent: real skills, but deliberately **not** in the `/sentinel` chain, because they answer questions (what breaks in production; how to hand off) orthogonal to shippability. Call them on their own when that's the question.

> **Not yet in this router's table:** three newer app-driven skills — `/e2e-impact` (which E2E specs a diff hits), `/audit-orchestrator` (route a suspicious passing test to the tool that can prove it), and `/contract-guard` (does the backend response still match its published contract) — exist and run standalone, but aren't wired into the routing decision above yet. That's a separate stack-aware orchestration-router effort; reach these three directly for now.

## Steps

1. Read the situation from $ARGUMENTS. It may be a plain description, a file path, a branch name, or empty.
2. **If $ARGUMENTS is empty**, output the full map (the table above plus the flow below) and stop — that's valid routing guidance on its own.
3. Otherwise, match the situation to exactly one primary skill using the routing signals below — a router that returns five options has routed nothing. If two questions are genuinely in play (e.g. "review this AI-written test file *and* tell me if it's safe to ship"), prefer the one whose *single question* most directly matches what the user asked, name it first, then the secondary as a follow-up.
4. If the situation is the merge/ship decision over a whole branch, route to `/sentinel` and note it will call the atomic shippability skills for you — don't also tell the user to run those by hand.
5. Output the recommendation in the format below: the skill, one line on *why* it fits, the exact invocation, and the natural next step in the flow.
6. If nothing fits cleanly, say so plainly and ask one clarifying question — do not force a bad match.

## Routing signals

- "before I write / about to build / what should I test" → **`/test-plan`**
- "is this testable / hard to test / hidden dependency / flaky by design" → **`/qa-review`**
- "AI wrote these tests / are the tests complete / what's missing / loose assertion" → **`/coverage-review`**
- "this test passes but I don't trust it / does it actually catch anything / prove it" → **`/audit-test`**
- "suite is slow / too many tests / redundant / over-mocked / stale" → **`/prune-tests`**
- "what could go wrong in prod / blast radius / would we even notice / is it reversible" → **`/threat-model`**
- "Playwright test is failing / red spec / locator or timing error" → **`/debug-test`**
- "need to file this / hand it off / write it up for the team" → **`/bug-report`**
- "about to merge / am I safe to ship / full pass on my branch" → **`/sentinel`**

## The intended flow

Sentinel maps onto the life of a change, not a fixed pipeline — most runs touch two or three of these, not all of them:

```
BEFORE CODE        /test-plan        define the cases + layers before anything exists
      │
WHILE REVIEWING    /qa-review        is the code even testable?
      │
AFTER TESTS        /coverage-review  what's missing / asserted loosely?
   EXIST           /audit-test       do the green tests actually guard anything? (proven by mutation)
      │
SUITE HYGIENE      /prune-tests      cut tests that cost more than they protect
      │
SHIP GATE          /sentinel   ◄──── orchestrates test-plan + coverage-review + qa-review
                                     + debug-test (on failing tests) + audit-test (batch)
                                     into ONE verdict: PASS / CAUTION / FAIL

INDEPENDENT of the chain (call on their own, any time — /sentinel never runs these):
   /threat-model   what breaks in production if this is wrong, and would anyone notice
   /bug-report     structure a failure for handoff

ALSO STANDALONE (in the chain above, but usable alone the moment one spec goes red):
   /debug-test     a Playwright test is actively red — diagnose and route the fix
```

`/debug-test` is the one skill that lives in two places on purpose: `/sentinel` invokes it over any failing tests it finds on the branch, *and* you can run it standalone the moment a single spec goes red. That's why it sits under "also standalone" here, not under "independent" — unlike `/threat-model` and `/bug-report`, it *is* part of the `/sentinel` chain.

## Output Format

For a matched situation:

```
**You're at:** [one line restating the situation in QA terms]

**Use:** `/skill-name`
**Why:** [one sentence tying the skill's one question to the situation]
**Run:** `/skill-name <args derived from the situation>`

**Next in the flow:** [the natural follow-up skill, or "— this is the ship gate" for /sentinel]
```

For empty $ARGUMENTS, output the skill table and the intended-flow diagram above, then one line: "Tell me what you're trying to do and I'll point you at one."
