# Read-only leaf skills are model-invoked; anything that executes or writes stays user-invoked

**Status: Accepted (2026-11-25).** Partly supersedes [ADR-0020](0020-suite-trigger-model-leaves-user-invoked.md)
for four skills: `coverage-review`, `e2e-impact`, `qa-review`, `test-plan`. ADR-0020 stays in force for every
other leaf.

## Context

[ADR-0020](0020-suite-trigger-model-leaves-user-invoked.md) made every leaf skill user-invoked
(`disable-model-invocation: true`). It did so to cut always-on description load (10 → 2) and the
unpredictability of a model that may or may not pick a leaf. It also named a counter-cost: the user must know the
skill exists and type it.

The maintainer now wants the QA flow to run with less manual driving: the model should start the review and
planning steps itself, while anything risky stays under human control. The question this ADR settles is which
skills are safe to hand to the model.

## Decision

Split the leaves by **what the skill can do to the working tree**, not by how often it is used.

- **Model-invoked (flag removed):** a skill whose output is a report or plan only. It reads code and prints
  findings. It has no flag, mode or step that edits, deletes, installs or runs the project's tests. Four leaves
  meet this bar today: `coverage-review`, `e2e-impact`, `qa-review`, `test-plan`.
- **User-invoked (flag kept):** a skill that executes code, changes files, files issues, or issues the ship
  verdict. This keeps `audit-test` (mutates source to prove a test hollow, per
  [ADR-0001](0001-audit-test-proves-by-execution.md)), `audit-orchestrator`, `gate`, `prune-tests`
  (its `--apply` mode deletes tests; see [ADR-0003](0003-prune-tests-proposes-before-deleting.md)),
  `debug-test`, `contract-guard`, `bug-report` and `threat-model`.

`prune-tests` is the edge case. Its default output is a proposal only, but a model-invoked skill could pass
`--apply`. Its safeguards (clean tree, explicit confirmation, high-confidence changes only) are written in the
skill text, which the model follows but nothing enforces. So it stays user-invoked until `--apply` is split into
its own user-only skill.

The test for a future leaf: if it can write, delete, execute project code or decide a release, it keeps the flag.

## Consequences

- **Always-on descriptions rise from 2 to 6.** `qa-pass` and `qa-compass` plus the four skills above. This
  re-accepts part of the context cost ADR-0020 avoided. Only the read-only skills pay it.
- **Explicit calls do not change.** `/coverage-review`, `/e2e-impact`, `/qa-review` and `/test-plan` work
  exactly as before when the user types them. The change adds model-started runs; it removes nothing.
- **Less reliance on the router for discovery.** The router, `/qa-compass`, stays model-invoked and keeps its
  map. These four skills can now also surface from their own descriptions.
- **The safety line is a rule, not a lock (see the addendum: file-tool writes are now blocked, Bash writes are not).** "Read-only" holds because each skill's own steps contain no write or
  execute path. All four still list `Bash` in `allowed-tools` for read commands (`ls`, `find`, `stat`, `git`),
  and Claude Code does not restrict Bash to those commands. Nothing in this repo enforces the boundary.
- **`evals/lint.mjs` reports each of these skills as `review`** ("model-invoked, confirm intended"). This ADR is
  that confirmation. The lint message cites ADR-0020; read it together with this record.
- **Reversible.** Each skill carries one frontmatter flag. Restoring `disable-model-invocation: true` undoes
  the change for that skill.

## Alternatives considered

- **Keep all leaves user-invoked (ADR-0020 as written).** Rejected: it keeps the maintainer in the loop for
  steps that cannot change anything.
- **Make every leaf model-invoked.** Rejected: that gives the model execution and file-changing skills
  (`audit-test`, `prune-tests --apply`, `gate`) with only prose between it and the working tree.
- **Include `prune-tests` and rely on its in-skill safeguards.** Rejected for now, for the reason above.

## Addendum: partial guard, resolves #286 (2026-11-25)

[#286](https://github.com/TzolkinB/skills/issues/286) asked whether to add a hard guard. Decision: add the
cheap, enforced part and a lint, and accept that Bash is still a rule, not a lock.

**What Claude Code gives us** (T1 docs: code.claude.com skills, hooks and permissions pages; T3 run on
Claude Code 2.1.332, 2026-11-25):

- `allowed-tools` only pre-approves tools. It does not restrict the others. Narrowing it to
  `Bash(ls:*)`-style patterns would not be a lock either; the permissions page calls Bash argument
  patterns fragile.
- `disallowed-tools` in skill frontmatter removes tools while the skill is active. T3: a skill with
  `disallowed-tools: [Write, Edit, NotebookEdit]` asked to create a file had the `Write` call denied; a
  control skill without the field created the file. A Bash `echo x > file` in a skill with the field still
  worked.
- Permission `deny` rules are global in `settings.json`. They cannot be tied to "while this skill runs", so
  they would also block the user's normal work.

**Decision.**

- The four skills in this ADR set `disallowed-tools: [Write, Edit, NotebookEdit]`. File-tool writes are
  blocked by Claude Code, not by the model's good manners.
- `evals/lint.mjs` fails (error) if any of the four drops that field, or if its text names a write path
  (`--apply`, `git commit`/`push`/`reset`/`checkout`/`clean`/`stash`/`rebase`/`merge`, `rm`, package installs,
  `sed -i`). A future edit that adds a write path is caught in review, not after a user hits it. The lint
  list of skills is `READ_ONLY_LEAVES` in `evals/lint.mjs`; add a skill there when it joins this ADR.
- **Not guarded:** writes made through `Bash` (`>`, `rm`, `git`). They still rely on the skill text and the
  lint. A PreToolUse hook could block them, but it would ship executable code to every user and I have not
  confirmed how long skill-scoped hooks stay active, so it is not part of this change.
- `prune-tests --apply` stays as described above. Splitting it into a user-only skill is a separate
  decision; no issue filed yet.

Reversible: remove the field from the four skills and the lint list.
