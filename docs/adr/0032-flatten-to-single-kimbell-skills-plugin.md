# Flatten to a single `kimbell-skills` plugin at the repo root; retire the "Sentinel" umbrella; collapse "Witness" → "Gate"

**Status: Accepted (2026-07-18).** **Supersedes [ADR-0006](0006-bundled-two-plugin-marketplace-repo.md)** (the bundled two-plugin marketplace repo). Also resolves the [#113](https://github.com/TzolkinB/skills/issues/113) naming/attestation collision by rename rather than caveat.

## Context

ADR-0006 shaped the repo as a **marketplace** (`.claude-plugin/marketplace.json`) holding a nested plugin at `sentinel/`, so more plugins could be added later. In practice only one plugin ever existed, the nesting added a path level to every reference, and the layout diverged from the community norm (e.g. [`mattpocock/skills`](https://github.com/mattpocock/skills)): a **single plugin at the repo root**, `source: "./"`.

Two naming problems had also accumulated:

- **"Sentinel"** is heavily overloaded (Microsoft Sentinel, HashiCorp Sentinel, a same-window simbastack AI-QA "Sentinel", …) — a poor umbrella brand, flagged by all three pre-launch reviewers (`references/critique-synthesis.md`).
- **"Witness"** is the name of the canonical in-toto attestation tool, while the gate shipped unsigned JSON and *claimed* "in-toto Statements" — a collision the attestation community would correct on launch day ([#113](https://github.com/TzolkinB/skills/issues/113)).

## Decision

**1. Flatten to a single plugin at the repo root.** Delete the `sentinel/` nesting; `skills/`, `docs/`, `evals/`, `fixtures/`, `scripts/`, and `.claude-plugin/plugin.json` live at the root. `marketplace.json`: name `skills` → **`kimbell`**, plugin `sentinel`/`./sentinel` → **`kimbell-skills`**/`./`. `plugin.json` name `sentinel` → `kimbell-skills`. Install is now `/plugin install kimbell-skills@kimbell`. (Still a marketplace-of-one, so a second plugin remains addable later — but the default is root-single, matching the norm.)

**2. Retire "Sentinel" as the umbrella/product brand.** The README is rebuilt in the `mattpocock/skills` style — no umbrella name, skills grouped under **`## Judgement`** and **`## Gate`** with **`### User-invoked`** / **`### Model-invoked`** subheadings (the invocation split is the real axis: `disable-model-invocation: true` skills vs. model-invokable). The **skill names keep their identifiers** — `/sentinel` (the orchestrator) and `/ask-sentinel` (the router) are unchanged; only the *product* brand is retired.

**3. Collapse "Witness" → "Gate".** The gate's user-facing surface — the SKILL prose, the printed report header (`## Gate decision`), the eval samples, and the gate eval rubric — drops the "Witness" brand; the skill is simply the **Gate**. The attestation claims are softened in the same pass: "in-toto Statements" → "in-toto-*shaped* Statements (not signed attestations)", "auditable" → "human-readable". This resolves #113 by rename, so no "not-affiliated" caveat is needed.

## Considered options

- **Keep the nested marketplace (ADR-0006 as-is).** Rejected — one plugin never justified the marketplace nesting or the extra path level, and it diverged from the ecosystem norm.
- **Keep "Witness", add a not-affiliated caveat (the #113 "keep + caveat" branch).** Rejected in favor of rename — a caveat leaves the search-collision and the "named after the in-toto tool" read intact; renaming removes both.
- **Rename the internal identifiers too, now.** Deferred at the time — `witness.mjs`, the `witness://` namespace, and the `witness-evidence-bundle` / `witness-audit-test` schema ids are plumbing behind the honesty-guarded self-test and the v0.1 contract ([ADR-0031](0031-witness-evidence-bundle-v0.1-empty-result.md)); renaming them is a contract-touching change better done deliberately, not in the brand pass. **Done in [ADR-0033](0033-witness-internal-identifier-rename.md).**

## Consequences

- **Breaking for the old install path** — `sentinel@skills` no longer resolves; use `kimbell-skills@kimbell`. Acceptable pre-launch (no released consumers).
- **All in-tree path references rewritten** (`sentinel/skills` → `skills`, CI trigger/run paths, the one `evals` `../../.github` depth ref); `changed.mjs`'s path regexes updated. Verified: gate self-test 81/81, `changed.mjs` + `lint` self-tests, all JSON valid, README links resolve.
- **Residual brand cleanup remains** (deliberate, tracked): ~35 docs still reference "Sentinel" (mostly the legit `/sentinel` skill, the "Sentinel-map" orchestration artifact, and historical ADR content). The internal `witness://` namespace / schema ids were renamed in [ADR-0033](0033-witness-internal-identifier-rename.md); a full contextual "Sentinel" de-brand remains a follow-up.
- **ADR-0006 is superseded**, not deleted — its reasoning stays as the record of why the marketplace shape existed.
