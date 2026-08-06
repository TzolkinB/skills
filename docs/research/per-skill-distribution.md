# Per-skill install/update — primary-source research for #185

**Scope**: pure investigation for [#185](https://github.com/TzolkinB/skills/issues/185) ("v2: per-skill
install/update instead of the all-or-nothing plugin bundle"). No recommendation, no build. Every claim
below is cited to a primary source (official docs, source code, or a repo's own committed artifact) —
not a blog post or secondary summary. Researched 2026-08-06 against Claude Code's docs as they exist
today; the plugin system is actively evolving, so re-verify version numbers before acting on this.

---

## Question 1 — Does Claude Code's plugin system support per-skill granularity?

**Short answer: no native per-skill enable/disable or per-skill update inside a single *installed*
plugin — but the marketplace layer supports something close to it: one repo can publish *multiple
plugin entries*, each scoped to a subdirectory, each independently installable. That's a real seam,
with one real limitation (update-staleness detection isn't scoped the same way install is).**

### 1a. Inside one installed plugin, everything is whole-plugin

The plugin manifest schema (`plugin.json`) has no field for enabling or disabling individual skills,
commands, or agents once the plugin is installed. Its component-path fields (`skills`, `commands`,
`agents`, etc.) control *where Claude Code looks for* components at load time — they are authored by
the plugin developer, not toggled by the end user. Source: full schema table, [Plugins reference §
Plugin manifest schema](https://code.claude.com/docs/en/plugins-reference#plugin-manifest-schema).

The only enable-state field, `defaultEnabled`, is plugin-scoped, not skill-scoped: *"Whether the plugin
starts in an enabled state when the user has not set one. Defaults to `true`."* — one boolean per
plugin, and per-user overrides live in `enabledPlugins`, keyed `"plugin-name@marketplace-name": true`,
never by skill name. Source: [Plugins reference § Default
enablement](https://code.claude.com/docs/en/plugins-reference#default-enablement) and the
`enabledPlugins` example in [Plugin marketplaces § Require marketplaces for your
team](https://code.claude.com/docs/en/plugin-marketplaces#require-marketplaces-for-your-team):
```json
{ "enabledPlugins": { "code-formatter@company-tools": true, "deployment-tools@company-tools": true } }
```

All the CLI/slash commands operate on a whole plugin identifier (`plugin-name` or
`plugin-name@marketplace-name`) — there is no sub-plugin argument form:
- `claude plugin install/uninstall/enable/disable/update <plugin>` — every arguments table in [Plugins
  reference § CLI commands
  reference](https://code.claude.com/docs/en/plugins-reference#cli-commands-reference) defines
  `<plugin>` as "Plugin name or `plugin-name@marketplace-name`".
- `/plugin install`, `/plugin enable`, `/plugin disable`, `/plugin uninstall` — same, per [Discover and
  install plugins § Manage installed
  plugins](https://code.claude.com/docs/en/discover-plugins#manage-installed-plugins).
- Installing itself is framed as whole-unit by design: *"Using a marketplace is a two-step process: 1)
  Add the marketplace... 2) Install individual plugins... Think of it like adding an app store: adding
  the store gives you access to browse its collection, but you still choose which apps to download
  individually."* — "individually" means per-plugin, not per-skill-inside-a-plugin. Source: [Discover
  and install plugins § How marketplaces
  work](https://code.claude.com/docs/en/discover-plugins#how-marketplaces-work).
- `claude plugin details <name>` shows a plugin's full component inventory (skills, agents, hooks, MCP,
  LSP) and a token-cost estimate before/after install, but this is a *preview*, not a selector — there's
  no flag to install only some of a plugin's listed skills. Source: [Plugins reference §
  details](https://code.claude.com/docs/en/plugins-reference#plugin-details).

One near-miss worth naming precisely so it isn't mistaken for what #185 wants: `SKILL.md` frontmatter
supports a per-skill `disable-model-invocation` boolean (seen in the plugin quickstart's example
skill). That's scoped to a single skill, but it only gates *automatic* invocation by the model — the
skill is still installed and still runnable via its explicit `/plugin:skill-name` slash form either way.
It is not an install/uninstall or enable/disable-in-the-`/plugin`-sense toggle. Source: [Create plugins
§ Create your first plugin, step
4](https://code.claude.com/docs/en/plugins#create-your-first-plugin).

### 1b. The marketplace layer *can* scope multiple installable units to one repo

`marketplace.json`'s `plugins` array is not limited to one entry per repo. Each entry gets its own
`name` (what users type into `/plugin install <name>@marketplace`), and its `source` can point at a
subdirectory of the same repo rather than the repo root. Two ways to do this are documented:

1. **Separate `source` per entry** — a `git-subdir` source type exists specifically to point a plugin
   entry at "a plugin that lives inside a subdirectory of a git repository," using "a sparse, partial
   clone to fetch only the subdirectory." A relative path source (`"source": "./skills/to-spec"`) works
   the same way for same-repo entries. Source: [Plugin marketplaces § Plugin
   sources](https://code.claude.com/docs/en/plugin-marketplaces#plugin-sources) and [§ Git
   subdirectories](https://code.claude.com/docs/en/plugin-marketplaces#git-subdirectories).

2. **Shared root, scoped `skills` list per entry** — documented explicitly for exactly this shape:
   *"When several plugin entries share one `skills/` folder at the marketplace root (`source: "./"`),
   list specific subdirectories instead so each entry loads only its own skills:*
   ```json
   "source": "./",
   "skills": ["./skills/code-review", "./skills/docs"]
   ```
   *With a marketplace-root `source`, the listed paths are the complete set for that entry, and other
   directories in the shared `skills/` folder don't load."* Source: [Plugin marketplaces § Advanced
   plugin entries](https://code.claude.com/docs/en/plugin-marketplaces#advanced-plugin-entries).

Either shape gives real, independent `/plugin install <skill>@marketplace`, `/plugin enable
<skill>@marketplace`, `/plugin disable <skill>@marketplace`, and `/plugin uninstall <skill>@marketplace`
— from **one repo, one `marketplace.json`**, no repo-splitting required. This is the one piece of Q1
that most directly bears on option (a) in the issue: "N standalone plugins" does not have to mean N
repos.

**The limitation is on the update side, not the install side.** Version resolution (what decides
whether `/plugin update` sees "a new version") is: (1) the entry's own `plugin.json` `version` field,
else (2) the marketplace entry's `version` field, else (3) "the git commit SHA of the plugin's source,
for `github`, `url`, `git-subdir`, and relative-path sources in a git-hosted marketplace." Source:
[Plugins reference § Version
management](https://code.claude.com/docs/en/plugins-reference#version-management). Nothing in the
docs indicates that SHA is scoped to "the last commit that touched this subdirectory" — it reads as the
resolved commit for the whole clone. Practically: if two skill-scoped entries in one repo both fall
back to git-SHA versioning, a commit to *either* skill (or to an unrelated file at the repo root) moves
the same SHA for both entries, so `/plugin update` can't tell them apart. Getting real per-skill
staleness detection this way requires each entry to carry its own explicit `version` string that the
maintainer bumps by hand, only when that entry's own files change — a manual discipline, not something
the plugin system verifies or enforces for you.

---

## Question 2 — Matt Pocock's `skills` CLI

### Identity and provenance

The CLI is published to npm as the unscoped package **`skills`**
([registry.npmjs.org/skills](https://registry.npmjs.org/skills)) — v1.5.22 at research time, 89
published versions, maintained by `rauchg` and `quuu`, sourced from
**[github.com/vercel-labs/skills](https://github.com/vercel-labs/skills)** ("The CLI for the open agent
skills ecosystem"). It is not Matt Pocock's own project — his repo,
**[github.com/mattpocock/skills](https://github.com/mattpocock/skills)**, is a *content* repo (a
collection of skills) that this general-purpose CLI can install *from*, the same way it installs from
`vercel-labs/agent-skills` or any other GitHub source. `npx skills add mattpocock/skills --skill
to-spec` names the CLI's generic `add <source> --skill <name>` form against his repo as the source.

### Is it file-copy based?

Both — user's choice, install-time. Two installation methods, quoted verbatim from the CLI's own
README: *"**Symlink** (Recommended) — Creates symlinks from each agent to a canonical copy. Single
source of truth, easy updates."* vs. *"**Copy** — Creates independent copies for each agent. Use when
symlinks aren't supported."* Source: [vercel-labs/skills
README](https://github.com/vercel-labs/skills/blob/main/README.md), § Installation Methods. It is not
a git submodule and not a package dependency — installed skills land as plain files (or symlinks to a
canonical local copy) inside each detected agent's skills directory (`.claude/skills/`, `.codex/skills/`,
etc. — a 70+-row compatibility table is in the README).

### Does it track per-skill versioning?

**Yes — via content hashes, not semver, and via two separate lock files, one global and one
project-scoped.** This is not visible from the README alone; confirmed by reading the CLI's own source:

- **Global lock**: `~/.agents/.skill-lock.json` (or `$XDG_STATE_HOME/skills/.skill-lock.json`). Each
  entry records `source`, `sourceType`, `sourceUrl`, `ref`, `skillPath`, and a `skillFolderHash` —
  *"GitHub tree SHA for the entire skill folder. This hash changes when ANY file in the skill folder
  changes."* Source:
  [src/skill-lock.ts](https://github.com/vercel-labs/skills/blob/main/src/skill-lock.ts) (interface
  `SkillLockEntry`, lines 15–40).
- **Project lock**: `skills-lock.json`, written to the project root and explicitly *"meant to be
  checked into version control."* Each entry stores a `computedHash` — *"SHA-256 hash computed from all
  files in the skill folder... computes the hash from actual file contents on disk"* — plus `skillPath`,
  documented as *"Required to re-install only this skill on update — without it, an update would refetch
  every skill in the source repo."* Entries are alphabetically sorted specifically to "minimize merge
  conflicts" on the committed file. Source:
  [src/local-lock.ts](https://github.com/vercel-labs/skills/blob/main/src/local-lock.ts), interface
  `LocalSkillLockEntry` (lines 15–46) and its doc comments.
- **Staleness check**: `skills update` fetches the current GitHub tree SHA for just that skill's
  `skillPath` and compares it to the locked hash — `if (latestHash && latestHash !==
  entry.skillFolderHash)` — only re-installing when they differ. Source:
  [src/update.ts](https://github.com/vercel-labs/skills/blob/main/src/update.ts), line 587 (and the
  parallel local-lock comparison at line 624).

So `skills update to-spec` genuinely touches only that skill: it reads `to-spec`'s lock entry, checks
just that skill folder's hash against upstream, and only re-fetches if changed. There's no semantic
version number anywhere in this — "is it stale" is answered by content-hash equality, not by a bumped
version string the source author has to remember to increment (contrast with Claude Code's plugin
versioning, which is exactly that manual-bump model when git-SHA fallback isn't precise enough — see
§1b above).

### What does the source repo need to look like?

No required per-skill manifest beyond `SKILL.md` itself — the CLI works off directory structure and
frontmatter, not a repo-level registry file. Requirements, quoted from the README: each skill is *"a
directory containing a `SKILL.md` file with YAML frontmatter"* with two required fields, `name`
(lowercase, hyphens) and `description`; an optional `metadata.internal: true` hides a skill from
discovery unless `INSTALL_INTERNAL_SKILLS=1`. Discovery walks a bounded set of conventional locations —
repo root, `skills/`, `skills/.curated/`, `.claude/skills/`, and 60+ other agent-specific paths — "up to
three levels deep, covering flat layouts (`skills/<name>/SKILL.md`) and catalog layouts." If nothing is
found in those locations, it falls back to a recursive search. Source: [vercel-labs/skills README §
Creating Skills / Skill
Discovery](https://github.com/vercel-labs/skills/blob/main/README.md#skill-discovery).

**It also reads Claude Code's own manifest format**, which is directly relevant to option (c) in the
issue: *"If `.claude-plugin/marketplace.json` or `.claude-plugin/plugin.json` exists, skills declared in
those files are also discovered... This enables compatibility with the Claude Code plugin marketplace
ecosystem."* Source: [vercel-labs/skills README § Plugin Manifest
Discovery](https://github.com/vercel-labs/skills/blob/main/README.md#plugin-manifest-discovery). This
means a repo that already ships a valid `plugin.json`/`marketplace.json` (as this repo does) is already
partially readable by the `skills` CLI with no extra files — the open question (not resolved here) is
whether `skills`'s discovery of that manifest would pick up all 14 skills correctly as-is or need the
per-entry `skills` path scoping described in §1b to expose them individually.

### Documented limitations

- **No skill-to-skill dependency management.** Nothing in the README, and nothing in the source files
  read, addresses declaring that one skill requires another, detects conflicts between two installed
  skills, or orders install/update across dependent skills.
- **Per-agent feature variance, not the CLI's problem to solve.** The README ships a compatibility
  matrix (`allowed-tools`, `context: fork`, hooks) showing some skill features work only on some of the
  70+ supported agents — the CLI installs the files regardless; whether the target agent honors every
  frontmatter field is on the agent, not the installer.
- **Global lock is machine-local, not portable.** The global `~/.agents/.skill-lock.json` lock isn't
  committed anywhere — a fresh machine or a teammate who clones a project has no record of prior
  `skills update` runs unless the *project*-scoped `skills-lock.json` was also committed and used.
- **Content-hash staleness, not semantic versioning** — a real design choice, not a defect, but worth
  flagging: there's no way to pin to "skill v2.1.0" or roll back to a prior published version the way
  semver-pinned Claude Code plugin entries can; it's always "match upstream's current file contents or
  don't."

### Direct precedent: Matt Pocock's own repo dual-publishes today

This is the most load-bearing finding for option (c). Matt Pocock's repo ships **both** formats
side by side, and documents exactly why in a committed ADR:

- **Claude Code plugin** — `.claude-plugin/plugin.json` + `.claude-plugin/marketplace.json`, listing
  promoted skills as an explicit array of paths, installed via `/plugin install mattpocock-skills`. As
  of the README's current install block, it's listed in Anthropic's **official** marketplace
  (`claude-plugins-official`) — confirmed directly by fetching that marketplace's own
  `marketplace.json`, which contains a `mattpocock-skills` entry sourced from
  `{"source": "url", "url": "https://github.com/mattpocock/skills.git", "sha": "8b36d4f..."}`.
- **skills.sh / the `skills` CLI** — `npx skills add mattpocock/skills`, kept explicitly as *"the
  universal installer... it already serves Codex and other harnesses today."*

Source: [mattpocock/skills README § Installation (30-second
setup)](https://github.com/mattpocock/skills/blob/main/README.md#installation-30-second-setup) and the
committed decision record [.agents/adr/0002-ship-as-a-claude-code-plugin.md](https://github.com/mattpocock/skills/blob/main/.agents/adr/0002-ship-as-a-claude-code-plugin.md).

The ADR's stated reason for shipping *both*, rather than just one, is a **curation** constraint, not a
per-skill-granularity one — worth reading precisely, because it doesn't map cleanly onto #185's
question: his repo has "promoted" (`engineering/`, `productivity/`) and "not promoted"
(`misc/`, `personal/`, `in-progress/`, `deprecated/`) bucket folders, and *"a plugin must expose only the
promoted set, which spans two of those bucket folders."* Claude Code's `plugin.json` can express that
as an explicit array of paths; Codex's plugin manifest at the time could only take a single directory
path, which would either leak the unpromoted buckets or require restructuring the repo — so a **native
Codex plugin was deferred**, and `skills.sh` was kept as the cross-agent installer in the meantime. The
ADR also confirms the whole-plugin version model from §1b directly: *"`.claude-plugin/plugin.json`'s
`version` tracks `package.json`'s version — bump both together on release. Claude uses the plugin
`version` to decide when installed users see an update."* — one version number for the whole bundle,
exactly as documented in Claude Code's own reference.

---

## Implications — factual mapping only, no recommendation

- **(a) Split into N standalone plugins** does not require N repos. §1b shows one repo, one
  `marketplace.json`, can list N plugin entries scoped to subdirectories, each independently
  install/enable/disable/uninstall-able via the existing `/plugin install <skill>@kimbell` command —
  no new tooling needed. The unresolved part is *update* granularity: without either per-entry
  `git-subdir` sourcing plus hand-maintained per-entry `version` bumps, or accepting that "update
  available" fires for every skill whenever any commit lands anywhere in the repo, this doesn't cleanly
  deliver the "update just touches that one skill" half of the issue title.
- **(b) A config-time per-skill allowlist inside one plugin** is not something Claude Code's plugin
  system provides a hook for — there is no schema field or settings key, at the skill level, that the
  *host* reads to gate which of an installed plugin's skills are active (§1a; `defaultEnabled` and
  `enabledPlugins` are both plugin-scoped). Building (b) would mean this repo inventing and enforcing
  its own allowlist convention (e.g., a skill checking some config before acting, or a wrapper skill
  gating others) — nothing in the platform does it for you, unlike (a)'s marketplace-entry mechanism.
- **(c) Dual-publish in both formats** has a working, primary-source precedent in Matt Pocock's own
  repo (§ "Direct precedent" above) — same author, same underlying skill content, both distribution
  paths live simultaneously today, plus a public ADR explaining the tradeoff they hit. Separately, the
  `skills` CLI's own discovery logic already reads `.claude-plugin/plugin.json` /
  `.claude-plugin/marketplace.json` if present (§2, "Plugin Manifest Discovery"), meaning a repo that
  already ships a valid Claude Code manifest — as this repo does — may need less extra work for (c)
  than starting from zero; whether that auto-discovery already exposes this repo's 14 skills correctly,
  or needs the same per-skill path scoping described in §1b, was not tested here.

---

## Out of scope / not answered here

This research is intentionally narrow to the two questions in the issue. It does **not** address:

- What breaks for the composed skills (`qa-pass`, `qa-compass`, `gate`) if a user installs only a
  subset of the 14 skills — whether they need to detect a missing routing target and degrade
  gracefully, error clearly, or something else. That's an internal-codebase question about this repo's
  own skills, not a question about either distribution mechanism, and needs its own pass.
- How any of options (a)/(b)/(c) interacts with the plugin-independence precedent already decided in
  [#99](https://github.com/TzolkinB/skills/issues/99) (Gate stays inside this one plugin until it earns
  independence via calibration). That decision was scoped to a different question (should Gate be its
  own plugin) and hasn't been re-examined against what §1b's multi-entry-marketplace finding would mean
  for it specifically.

Both are flagged in the issue itself as separate scope questions and are left for a later session.
