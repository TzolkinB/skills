# TzolkinB/skills is a bundled multi-plugin marketplace repo installed via a manifest

> **Superseded by [ADR-0032](0032-flatten-to-single-kimbell-skills-plugin.md) (2026-07-18)** — the repo was flattened to a single `kimbell-skills` plugin at the root (`source: "./"`). Kept as the record of why the nested-marketplace shape originally existed.

`TzolkinB/skills` is structured as a bundled multi-plugin repository, not a single plugin at its
root and not a submission to Anthropic's public catalog. Plugin folders sit directly at the repo
root — no `plugins/` wrapper directory — each with its own `.claude-plugin/plugin.json`. Sentinel's
former root-level content (skills, `docs/adr`, ARCHITECTURE, CONTEXT, GLOSSARY, CONTRIBUTING,
DEPLOYMENT, README, and the plugin manifest) moves down into a `sentinel/` folder. A second QA
plugin folder can join later as a sibling with no disruption to Sentinel. The repo root hosts
marketplace-level concerns; each plugin folder owns its own contents.

Install is the standard native pattern, driven by a root `.claude-plugin/marketplace.json` that
lists each plugin by relative-path source (`"source": "./sentinel"`):

```
/plugin marketplace add TzolkinB/skills
/plugin install kimbell-skills@kimbell
```

The manifest is an install catalog only — it does not list the repo in Anthropic's public
marketplace.

## Why a marketplace manifest, not a bare plugin.json

A single `plugin.json` at the root can only describe one plugin, and the planned second QA plugin
needs a home in the same repository without a later breaking move. Claude Code's native
`marketplace.json` is exactly the mechanism for "several independent plugins in one repo, installed
with one `add`." It is required here, not overhead: the alternative distribution model (a bare
`plugin.json` shipped through a custom `npx` installer) gives up native install and cannot express
two independent plugins. Keeping plugin folders at the root with no `plugins/` wrapper keeps the
relative-path sources short and the repo shape flat and obvious.

## Consequences

- The root is a valid marketplace: `claude plugin validate .` checks the manifest and every plugin's
  frontmatter, and installing `sentinel` from it loads all nine skills by auto-discovery.
- Per-plugin version lives in each `plugin.json` (single source of truth), not duplicated into the
  marketplace entry.
- Adding the second plugin is additive: a new sibling folder plus one more entry in the `plugins`
  array — Sentinel's paths and install command are unaffected.
- Skills auto-discover from each plugin's `skills/` directory; the manifest lists plugins, not
  individual skills.
