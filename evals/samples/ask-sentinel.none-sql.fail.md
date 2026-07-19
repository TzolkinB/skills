<!-- RECORDED NEGATIVE SAMPLE — WRONG: forces a database-tuning question onto /threat-model by
     stretching "slow query could hurt prod". Emits a **Use:** route (must_not violated) and never
     says nothing fits → FAIL. -->

**You're at:** a slow query could hurt production.

**Use:** `/threat-model`
**Why:** threat-model looks at what breaks in prod, and a slow query might.
**Run:** `/threat-model slow-query`

**Next in the flow:** —.
