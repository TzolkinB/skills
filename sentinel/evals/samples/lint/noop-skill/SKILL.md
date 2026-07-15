---
name: noop-skill
description: Seeded fixture for lint --self-test — do not ship
allowed-tools: [Read]
disable-model-invocation: true
---

# Seeded lint fixture

This skill exists only to prove the Phase 0 lint catches what it should. It deliberately
plants two smells:

1. A no-op directive: always write clean, readable code and follow best practices.
2. A dead link: see [the missing reference](reference/does-not-exist.md) for details.

A real skill would say what to actually do here; this one intentionally does not.
