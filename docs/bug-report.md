# bug-report — turn a messy failure into a clean handoff

> **Agent instructions:** [`skills/bug-report/SKILL.md`](../skills/bug-report/SKILL.md)
>
> **Run:** `/bug-report "what went wrong"`

## What it does

`bug-report` converts a messy failure description into a structured, reproducible, scoped report. The report gives the person who fixes the bug enough context. That person does not need to ask a follow-up question.

The skill derives a specific title, a severity, and minimal numbered repro steps. It derives expected-vs-actual behavior, environment, frequency, and affected scope. It adds a root-cause hypothesis and a suggested fix only when these are obvious.

A vague "it's broken" report is the top reason a report gets sent back unresolved. This skill turns an observation into a report. A stranger reproduces the bug from the report. A teammate acts on it. Paste the report into Jira, Linear, or GitHub Issues.

## When to use it

| Your situation | Where to go |
| --- | --- |
| Something breaks and you need to hand it off cleanly to the team | **`/bug-report "what went wrong"`** — this page |
| You have a rough idea of the steps that trigger the bug, and want it turned into a report another person follows without help | **`/bug-report`** |
| A Playwright test is red and you want the root cause | [`debug-test`](./debug-test.md) instead — it runs and diagnoses it |
| You want the ship/no-ship verdict on a branch | [`qa-pass`](./qa-pass.md) instead — like [`threat-model`](./threat-model.md), `bug-report` sits outside the `/qa-pass` chain |

## Prerequisites

Just Claude Code. It structures the failure description you provide. There is nothing to install. Nothing runs, and the skill adds no network calls of its own.

## Worked example

`bug-report` consumes a failure narrative, not a source file. It has no code fixture ([why](../fixtures/README.md)). Given a raw observation:

```
/bug-report "Date filter on /books page broken, returns empty results, browser console shows dateRange.start is undefined"
```

a good report replaces "broken" with something reproducible:

- **Title:** _Date filter clears all results and throws `dateRange.start is undefined`_
- **Severity:** High (feature broken, no workaround)
- **Steps to reproduce:** log in → go to `/books` → click _Filter by date_ → enter a past date → _Apply_
- **Expected vs Actual:** results update to that date forward _vs_ page reloads, filters clear, console shows `TypeError: dateRange.start is undefined`
- **Affected scope:** date filtering; `BookList` / `DateFilter` / `useBooks`; blocks reporting, which depends on filters
- **Root-cause hypothesis** (included only because it is plausible here): something clears the `dateRange` state before the filter effect runs.

## It's Working If

- Every report replaces "broken" with a reproducible claim — a specific title, not a vague symptom.
- A stranger who has never seen the bug reproduces it from the steps alone.
- A root-cause hypothesis appears only when it's actually plausible — left blank otherwise, never guessed.
- Frequency is stated as an observed rate, not collapsed into a vague "sometimes."

If `bug-report` ever guesses a root cause or drops the frequency, that is a bug — file it. See [Contributing & Support](../README.md#contributing--support).

## FAQ

**Q: Does bug-report always include a root-cause hypothesis?**
A: No — only when one is actually plausible from the description given. Otherwise it's left blank rather than guessed.

**Q: Can I paste the output straight into Jira, Linear, or GitHub Issues?**
A: Yes — that's the intended handoff. The report is structured so the person who picks it up doesn't need to ask a follow-up question.

## Where it fits

The skill sits outside the [`qa-pass`](./qa-pass.md) chain. It is a handoff tool, not a QA judgment or ship-decision skill. It often follows [`debug-test`](./debug-test.md). Once a failing test is diagnosed, bug-report turns the finding into a report. The team acts on that report.

## Anti-patterns

- **"It's broken" / "doesn't work" titles.** State exactly what is wrong and what the correct behavior is.
- **Reproducible steps a stranger fails to follow.** If a person who has never seen the bug does not reproduce it from the steps, the report is not done.
- **A guessed root cause.** Leave the hypothesis blank rather than inventing one.
- **A dropped frequency.** "Happens 50% of the time" is a different bug from "always."
