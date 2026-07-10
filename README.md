# skills

A bundled Claude Code plugin marketplace by [TzolkinB](https://github.com/TzolkinB).

One repo, one marketplace manifest, one or more installable plugins. Add the
marketplace once, then install any plugin from it by name. Everything here is
QA-focused: tools that verify behavior instead of trusting a green checkmark.

## Plugins

### [sentinel](./sentinel/) — QA-first testing skills

Verify behavior, not green lights. Sentinel is a **judgement layer, not a test
runner** — nine composable skills that reason about whether your tests actually
protect you, rather than producing tests or coverage themselves. Where execution
is needed it composes with the tools that already do it (coverage
instrumentation, Playwright, mutation testing) instead of reimplementing them.

The skills span the testing loop — planning what to test, reviewing coverage and
testability, auditing whether passing tests actually protect anything, pruning
test debt, modeling production risk, and diagnosing failures. `/sentinel` is the
orchestrator that runs the shippability skills together and reduces them to a
single 🟢 PASS / 🟡 CAUTION / 🔴 FAIL verdict.

Full skill list, dependencies, and a privacy breakdown of what each skill reads
and runs: see [`sentinel/README.md`](./sentinel/README.md).

## Install

Add this marketplace, then install the plugin you want:

```
/plugin marketplace add TzolkinB/skills
/plugin install sentinel@skills
```

To try it from a local checkout instead:

```
/plugin marketplace add ./
/plugin install sentinel@skills
```

## Repo layout

```
.
├── .claude-plugin/marketplace.json   # marketplace manifest (lists the plugins)
├── sentinel/                         # the Sentinel plugin
│   ├── .claude-plugin/plugin.json
│   ├── skills/                       # the nine skills
│   ├── docs/adr/                     # architecture decision records
│   └── README.md                     # Sentinel's full overview
└── README.md                         # you are here
```

## License

[MIT](./LICENSE)
