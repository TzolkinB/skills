# Rename `/ask-sentinel` → `/qa-compass` and `/sentinel` → `/qa-pass` — the last two "Sentinel" skill identifiers

**Status: Accepted (2026-08-06).** Closes the "skill identifier itself... stays" carve-out
[ADR-0032](0032-flatten-to-single-kimbell-skills-plugin.md) decision 2 made, and narrows
`docs/roadmap.md` item 6 / [#124](https://github.com/TzolkinB/skills/issues/124).

## Context

[ADR-0032](0032-flatten-to-single-kimbell-skills-plugin.md) retired "Sentinel" as the umbrella brand (README, plugin identity → `kimbell-skills`), but
deliberately kept the `/sentinel` and `/ask-sentinel` skill identifiers themselves — renaming a skill's
actual command name was a bigger, separate lift than the branding sweep, tracked as the "contextual
de-brand" follow-up in `docs/roadmap.md` item 6. With the umbrella brand gone, the two remaining
skills still named after it read as orphaned: `/sentinel` and `/ask-sentinel` no longer point to
anything a reader can connect them to, and a new user has no way to guess what either does from its
name alone.

## Considered options

- **`/ask-kim`, mirroring Matt Pocock's own `/ask-matt`** (a personal-brand router pointing into his
  skill set — `~/.claude/skills/ask-matt`, `disable-model-invocation: true`). Rejected as the
  `/ask-sentinel` replacement — it optimizes for author-branding, not for "a stranger can guess what
  this does from its name," which was the explicit bar for this rename. Noted as a legitimate pattern
  (this plugin is already `kimbell-skills`), just not chosen here.
- **`qa-router` / `which-qa-tool`** for the router, **`qa-verdict` / `branch-qa`** for the orchestrator.
  Considered alongside the chosen names; `qa-compass` keeps the map metaphor already used throughout
  `docs/orchestration-map.md` and the skill's own description, `qa-pass` echoes the skill's own
  description ("run a QA judgment pass") and stays legible next to `/gate` (the shippability decision
  downstream of it) without colliding with it.
- **Leave the bare-word "Sentinel" prose mentions untouched, rename only the command form.** Rejected —
  the roadmap's old prose-vs-identifier split assumed the identifier wasn't changing. Once it does,
  leaving "Sentinel is the orchestrator" sitting next to `/qa-pass` in the same file reads worse than
  fixing both.
- **Also rename the permanent live-eval fixture branch `fixture/sentinel-payments-refund`**
  ([ADR-0051](0051-live-eval-fixtures-materialize-as-a-permanent-git-ref.md)) to match. Rejected — it's a pushed, shared, never-merged git ref; renaming it means push-new +
  delete-old across every consumer for a purely cosmetic win. Treated as infra, not prose (see
  Decision, scope exclusions).

## Decision

1. **`/ask-sentinel` → `/qa-compass`.** The router that reads a QA situation (and optionally the
   stack) and names the one best tool for it, across the seven-stage map — own skills and external
   tools alike.
2. **`/sentinel` → `/qa-pass`.** The orchestrator that composes the atomic QA skills over a branch
   into one PASS/CAUTION/FAIL read.
3. **Scope: the skill identifiers, and every current-behavior mention of them.** Directory/file names
   (`skills/{ask-sentinel,sentinel}/` → `skills/{qa-compass,qa-pass}/`,
   `docs/{ask-sentinel,sentinel}.md` → `docs/{qa-compass,qa-pass}.md`, `fixtures/sentinel/` →
   `fixtures/qa-pass/`, matching `evals/cases/*.json` and `evals/samples/*.md`), the `name:`
   frontmatter field, and every `` `/sentinel` ``/`` `/ask-sentinel` `` command reference or bare-word
   prose mention describing either skill's *current* behavior (e.g. "Sentinel is the orchestrator,"
   "Sentinel Report") — across `skills/*/SKILL.md`, `docs/*.md`, `README.md`, `GLOSSARY.md`,
   `ARCHITECTURE.md`, `CONTEXT.md`, `REVIEWERS.md`.
4. **`evals/cases/qa-compass.json` and its `none-*` route-none samples were reworded, not just
   renamed.** They used bare "Sentinel skill" to mean *any skill in this plugin* — a router
   self-description, not an identifier. Mechanically renaming that to "QA Pass skill" would have
   misattributed the router's own scope to the orchestrator specifically. Reworded to generic phrasing
   ("no single skill fits this," "outside what this router covers") instead.
5. **A handful of umbrella-brand recommendations were reworded to name the actual tool**, since
   leaving them bare after the identifier changes would be misleading, not just stale — e.g.
   `docs/comparisons/mutation-tools.md`'s "reach for Sentinel for the [E2E mutation] layer" now names
   `audit-test`, the skill the surrounding sentence is actually about.
6. **Out of scope, left exactly as [ADR-0032](0032-flatten-to-single-kimbell-skills-plugin.md),
   [ADR-0034](0034-proven-confirmed-taxonomy-rename.md), and
   [ADR-0036](0036-ask-sentinel-audit-orchestrator-confirmed-rename.md) already established:**
   - **Historical ADRs, `CHANGELOG.md`, and `references/*` stay untouched** — point-in-time records,
     not living docs (ADR-0036 §5's precedent). `docs/roadmap.md` item 1 (the closed
     `proven`→`confirmed` retrospective) is likewise left as written; only item 6's now-stale "the
     identifier stays" clause was corrected, since this ADR is the reason it no longer holds.
   - **Loose "Sentinel" prose that means the old *umbrella* product, not either skill, is untouched**
     (e.g. `docs/orchestration-map.md`'s fabricated-external-report provenance note, which quotes a
     bad report's confused idea of "Sentinel" the product — rewriting a quote would misrepresent what
     was actually fabricated). This is issue #124's remaining scope, unaffected by this ADR.
   - **The eval harness's own separate "Sentinel" branding is untouched** — `evals/*.mjs` and
     `skills/gate/*.mjs` comments/env-vars (`SENTINEL_EVAL_JUDGE_MODEL`, `SENTINEL_EVAL_AGENT`, the
     `sentinel-eval-` temp-dir prefix) name the eval harness project, not either renamed skill, and
     changing them would break existing environment-variable contracts for no benefit. Two more
     `.mjs` mentions are the plain CS term "sentinel value" (`tea-to-trace-matrix.mjs`'s
     `TEA_PHASE_SENTINEL`) and an unrelated seed constant (`gate.mjs`'s
     `SEED="sentinel-certify-v0"`) — neither is about either skill.
   - **The permanent live-eval fixture branch `fixture/sentinel-payments-refund` keeps its name**
     (see Considered options). `evals/cases/qa-pass.json`'s `fixture_ref` and every doc that names the
     branch (`fixtures/README.md`, `fixtures/qa-pass/*.md`) still point at the literal
     `fixture/sentinel-payments-refund`.

## Consequences

- `/sentinel` and `/ask-sentinel` no longer exist as skill names anywhere in this repo; every
  cross-reference among the other twelve skills, `README.md`, and the eval harness's routing/
  orchestrator cases points at `/qa-pass` / `/qa-compass`.
- Narrows, doesn't close, [#124](https://github.com/TzolkinB/skills/issues/124): what's left there is
  genuinely just old-umbrella-brand prose, not either skill's name.
- **Link integrity verified mechanically, not just by eye**: every relative `.md`/`.json` link across
  the touched files was resolved against the filesystem post-rename (0 broken), and
  `node evals/lint.mjs skills` reports 0 errors — its own dead-link checker independently agrees.
- **Reversible.** Every change here is a file rename plus a text substitution; reverting is
  `git revert` this commit/PR.
