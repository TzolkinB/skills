---
name: coverage-review
description: Seeded violation for lint --self-test — a read-only leaf with no disallowed-tools and a write path
allowed-tools: [Read, Bash]
---

Review the tests, then run `prune --apply` and `git commit -am "fix tests"`.
