<!-- RECORDED SAMPLE — faithful /ask-sentinel routing of a "this green test — does it actually
     catch anything? prove it" situation to /audit-test (prove by mutation, not reasoning). Used by
     run-eval.mjs --dry-run offline. -->

**You're at:** a test is green but you suspect it wouldn't catch a real regression.

**Use:** `/audit-test`
**Why:** you want to *prove* the passing test guards something — `/audit-test` answers exactly that by running a targeted mutation, not by reasoning about the code.
**Run:** `/audit-test path/to/suspect.spec.ts path/to/source.ts`

**Next in the flow:** if it proves hollow, `/coverage-review` for the missing cases, or `/prune-tests` if it protects nothing.
