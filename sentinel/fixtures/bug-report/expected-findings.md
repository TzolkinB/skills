# Expected findings — bug-report / reports export

Run: `/bug-report "$(cat sentinel/fixtures/bug-report/report-export.md)"` (or paste the observation).

A scenario/prompt fixture: the input is a **messy, sparse** user observation. A correct report
extracts what is stated and marks what is not **Unknown — not provided**, never inventing a field to
fill the template — the skill's anti-guess rule: *a plausible-but-wrong detail is worse than a blank*
because it sends the fixer down a false path.

## Should extract (stated in the input)
- **Title** — specific, e.g. "Reports export intermittently downloads an empty CSV (header row only)",
  not "export broken".
- **Actual behavior** — sometimes the button does nothing; when it does download, the CSV has the
  header row but none of the report data.
- **Expected behavior** — the export downloads a populated CSV of the report rows.
- **Frequency** — Sometimes / intermittent (stated "sometimes", "eventually").
- **Severity** — High: a broken feature blocking the monthly close (the stated business impact).
- **Affected scope** — reports export; blocks the monthly close.

## Should mark Unknown / Needs info (NOT invented)
- **Environment** — browser, OS, versions: **Unknown — not provided** ("work laptop" is not a version).
- **Exact error / console / network output** — none provided → Unknown; ask for it.
- **Precise repro** — the exact trigger is unclear (intermittent); reliable repro steps are needed.
- **Root cause** — not obvious from the description → leave blank, do not guess.

## Boundary notes (what the report should NOT do)
- **Never fabricate a field.** Don't invent a browser / OS / version (e.g. "Chrome 130 / macOS 14"),
  an exact error message (e.g. a `TypeError`), or a confident root cause the input doesn't support —
  mark it Unknown.
- **Don't say "broken" / "doesn't work"** as the title — name the specific symptom.
- **Severity from stated impact**, not invented — "holding up the monthly close" ⇒ High.
