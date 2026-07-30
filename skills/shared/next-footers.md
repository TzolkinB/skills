# Shared: the inline `Next:` footer

Loaded from the Output Format of every judgment skill — `test-plan`, `qa-review`,
`coverage-review`, `audit-test`, `prune-tests`, `threat-model`, `sentinel`. Every report they emit,
full **and** `--digest`, closes with exactly one line:

```
**Next:** `/skill <args>` — <why, in a clause>
```

The routing intelligence lives in [`/ask-sentinel`](../ask-sentinel/SKILL.md). The footer doesn't
duplicate it — it delivers the *one* step that follows **this** report, at the point of use, so a
reader holding a finding doesn't have to stop and run a second lookup to learn what to do with it.
`prune-tests` has shipped this shape for a while as its `Deferred to audit-test` hand-off; this
generalizes it to every judgment skill.

## Rules

- **One line, one primary step.** A footer offering three options has routed nothing (that's
  `ask-sentinel`'s own rule, applied to itself). A second step is allowed only as a trailing
  conditional clause: `… · <condition> → /other`.
- **Result-dependent where the routing is.** Most of these skills have a different next step
  depending on what they found; pick the row below that matches the result you actually reported.
  A footer that ignores the finding is decoration.
- **Derived from the map, not invented — and not a copy of it.** `ask-sentinel`'s routing signals are
  keyed by *situation* ("this test passes but I don't trust it"); a footer is keyed by *result*
  ("🟡 likely — the code wasn't runnable"), because by the time you're writing one, the skill already
  knows what it found. The destinations below are the ones its signals and its intended-flow diagram
  give, and `ask-sentinel` stays authoritative on them: where the two name a different next skill for
  the same situation, `ask-sentinel` is right and the footer is the bug — it's the map, this is the
  shortcut.
- **Hand over, never self-invoke.** The footer prints an invocation the user runs. No skill calls the
  next one on its own (`/sentinel` orchestrating its own chain is the one exception, and it does that
  in its Steps, not in a footer).
- **Terminal steps say so.** `/gate` ends the chain; a footer that reaches it says that's the end
  rather than inventing a further hop.

## The table

| Skill | When | `Next:` |
|---|---|---|
| `test-plan` | default | `` `/qa-review <file>` once the code exists — a plan only holds if the code can be tested `` |
| | the feature touches money, permissions, or stored data | `` `/threat-model <change>` first — what breaks in production is a different question than what to test `` |
| `qa-review` | testability blockers found | `` fix the seams above, then `/coverage-review <test> <code>` — mocking around them locks the coupling in `` |
| | no blockers | `` `/coverage-review <test> <code>` once tests exist — testable is not tested `` |
| `coverage-review` | loose or incidental assertions named | `` `/audit-test <test> <code>` on the assertions above — this pass names them, only a mutation proves whether they bite `` |
| | gaps only, no loose assertions | `` close the gaps above, then `/sentinel <branch>` for the net read `` |
| `audit-test` | 🔴 confirmed or ⚠️ baseline-lock | `` strengthen the assertion above, then re-run `/audit-test <file>` — the fix is only real when the mutation dies `` |
| | 🟡 likely | `` make the code runnable (or point at a scratch copy) and re-run — 🟡 is short of proof · can't run it here → `/audit-orchestrator` to pick the prover your stack can run `` |
| | 🟢, or a clean batch | `` `/sentinel <branch>` for the net QA read, then `/gate` for ship/canary/hold (`--emit-json=<path>` is what Gate ingests) `` |
| `prune-tests` | Deferred entries present | `` `/audit-test <file>` on the Deferred entries before deciding — don't delete what only it can clear `` |
| | plan looks right | `` re-run with `--apply` on a clean tree — this pass proposes, it deletes nothing `` |
| `threat-model` | HIGH risks with no test behind them | `` `/test-plan "<the HIGH risk>"` — turn the ranked risks into cases `` |
| | HIGH risks already covered | `` `/sentinel <branch>` for the QA read across the change `` |
| `sentinel` | any verdict | `` `/gate` — this is the QA read; `/gate` is the one that says ship / canary / hold `` |

## Not yet footered

`debug-test`, `e2e-impact`, `contract-guard`, `bug-report`, `audit-orchestrator`, and `gate` are
out of scope here — they're procedural or terminal rather than judgment skills, and several already
route inline in their own Output Format. Extending the footer to them is a follow-up, not an
omission: don't add a row above without adding the skill's own footer at the same time.
