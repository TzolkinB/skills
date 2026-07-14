# Suite trigger model: leaf skills are user-invoked, discovery goes through the router

**Status: Accepted (2026-07-14).** Prompted by a checklist audit of the suite against Matt Pocock's *writing-great-skills* rubric — specifically its **trigger** axis (how a skill is invoked). A cross-cutting decision for all ten skills, not a single-skill refinement.

## Context

Every Sentinel skill was **model-invoked** — no `disable-model-invocation` flag — so each skill's `description` sat in the agent's context on **every request**. Ten skills = ten always-on descriptions. The rubric names two costs of that default:

- **Context load.** Ten descriptions the agent carries and reasons over on every turn, whether or not any QA skill is relevant.
- **Unpredictability.** A model-invoked skill is a *context pointer the model may decline to follow* — even when it is exactly right for the task. That is a class of problem (needing evals to confirm skills fire at the right time) rather than a one-off bug.

The counter-cost of user-invoked skills is **cognitive load on the pilot** (the user must know the skill exists to type it). The rubric's guidance is that the choice is a real trade-off to make deliberately, not a default to accept.

The suite's standing design goal is that each skill is usable **two ways at once**: *independently* (a QA engineer runs `/audit-test` on a suspect test) **and** *in orchestration* (`ask-sentinel` routes to it; `sentinel` and `debug-test` invoke it as part of a larger flow). The question is which trigger model serves both.

The key observation: **neither use requires model auto-invocation of the leaf.**

- Independence is served by the **user** invoking it.
- Orchestration is served by the router/orchestrator invoking it **explicitly by name** via the `Skill` tool — and `disable-model-invocation` removes a skill from the model's *auto-selection* context **without** blocking explicit by-name invocation.

## Decision

Split the suite into **entry points** (model-invoked) and **leaves** (user-invoked):

- **Model-invoked — the two discovery entry points:**
  - `ask-sentinel` — the router ("describe your QA situation, get pointed at the right skill").
  - `sentinel` — the full QA pass over a feature branch.
- **User-invoked (`disable-model-invocation: true`) — the eight leaves:** `audit-test`, `coverage-review`, `debug-test`, `prune-tests`, `qa-review`, `threat-model`, `test-plan`, `bug-report`.

Always-on descriptions drop from **10 → 2**. Discovery is delegated to the router: when the model recognises a QA situation it can invoke `ask-sentinel`, which names the right leaf for the user (or the orchestrator invokes it directly). Leaf `description` fields are **retained** — under `disable-model-invocation` they still serve the user on the slash-command surface; they just no longer load into the model's always-on context.

## Considered options

- **Keep all ten model-invoked (status quo).** Rejected: ten always-on descriptions and the unpredictability cost, for leaves whose discovery the router already provides. The flexibility bought (model may auto-pick any leaf) duplicates the router and is exactly the unpredictable path the rubric warns against.
- **Make all ten user-invoked.** Rejected: it removes the model's ability to *surface* the suite at all — a user who describes a QA problem without knowing Sentinel exists would get nothing. Keeping the router (and the full-pass) model-invoked preserves one always-on, low-cost discovery surface.
- **Hybrid: entry points model-invoked, leaves user-invoked (chosen).** Keeps model-driven discovery through a single router description, removes nine of ten unpredictable pointers, and preserves both independence and orchestration.

## Consequences

- **Context-load footprint: 10 → 2 always-on descriptions.** The suite's standing cost on every request is now the router plus the full-pass, not the whole catalogue.
- **The router is load-bearing for discovery.** `ask-sentinel` is now the model's primary way to surface a leaf. It must stay model-invoked and keep an accurate map of which leaf owns which QA question; a leaf added later is discoverable through the router, not by its own always-on description.
- **Orchestration is unchanged.** `sentinel` (batch) and `debug-test` (self-invoking orchestrator, [ADR-0010](0010-execution-out-temporal-deferred-behind-a-seam.md)) invoke leaves **by name** via the `Skill` tool; `disable-model-invocation` does not affect that path.
- **Predictability over flexibility.** The suite trades "the model *might* auto-pick a leaf" for "a leaf runs when the user or the router invokes it" — removing the eval-the-trigger burden on the eight leaves.
- **Reversible.** The trigger model is a per-skill frontmatter flag; a leaf can be re-promoted to model-invoked if a use case demands its own always-on description.
