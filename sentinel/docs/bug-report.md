# bug-report — turn a messy failure into a clean handoff

> **Agent instructions:** [`skills/bug-report/SKILL.md`](../skills/bug-report/SKILL.md) · **Run:** `/bug-report "what went wrong"`

## What it does

`bug-report` converts a messy failure description into a structured, reproducible, scoped report — one that gives the person fixing it enough context that they don't have to ask a single follow-up question. It derives a specific title, a severity, minimal numbered repro steps, expected-vs-actual behavior, environment, frequency, and affected scope, and adds a root-cause hypothesis and suggested fix only when they're actually obvious.

Its value is that a vague "it's broken" is the number-one reason bugs bounce back unresolved. This skill turns an observation into something a stranger can reproduce and a teammate can act on, ready to paste into Jira, Linear, or GitHub Issues.

## When to use it

- Something broke and you need to hand it off cleanly to the team.
- You have a rough repro in your head and want it turned into a report someone else can follow.

## When *not* to use it

- **A Playwright test is red and you want the root cause** → [`debug-test`](./debug-test.md), which runs and diagnoses it.
- **You want the ship/no-ship verdict on a branch** → [`sentinel`](./sentinel.md). Like [`threat-model`](./threat-model.md), bug-report is not part of the `/sentinel` chain.

## Prerequisites

Just Claude Code — it structures the failure description you provide. Nothing to install, nothing runs, and it adds no network calls of its own.

## Worked example

`bug-report` consumes a failure narrative rather than a source file, so it has no code fixture ([why](../fixtures/README.md)). Given a raw observation:

```
/bug-report "Date filter on /books page broken, returns empty results, browser console shows dateRange.start is undefined"
```

a good report replaces "broken" with something reproducible:

- **Title:** *Date filter clears all results and throws `dateRange.start is undefined`*
- **Severity:** High (feature broken, no workaround)
- **Steps to reproduce:** log in → go to `/books` → click *Filter by date* → enter a past date → *Apply*
- **Expected vs Actual:** results update to that date forward *vs* page reloads, filters clear, console shows `TypeError: dateRange.start is undefined`
- **Affected scope:** date filtering; `BookList` / `DateFilter` / `useBooks`; blocks reporting, which depends on filters
- **Root-cause hypothesis** (only because it's plausible here): the `dateRange` state is cleared before the filter effect runs.

## Where it fits

Outside the [`sentinel`](./sentinel.md) chain — it's a handoff tool, not a shippability check. It often follows [`debug-test`](./debug-test.md): once a failing test is diagnosed, bug-report turns the finding into a report the team can act on.

## Anti-patterns

- **"It's broken" / "doesn't work" titles.** Say exactly what's wrong and what should happen instead.
- **Repro steps a stranger can't follow.** If it isn't repeatable by someone who's never seen the bug, it isn't done.
- **Guessing a root cause you don't have.** Leave the hypothesis blank rather than inventing one.
- **Dropping frequency.** "Happens 50% of the time" is a different bug from "always."
