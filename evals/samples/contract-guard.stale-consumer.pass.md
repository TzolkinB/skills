<!-- RECORDED SAMPLE — a faithful /contract-guard run on the .drift-fixture empty-diff drift
     (Case 2, stale-consumer). The backend renamed the field out-of-band (label→name); the
     consumer repo's git diff is empty yet ROOM-01 is red. The published OpenAPI now documents
     `name`, so the rename is DELIBERATE → verdict stale-consumer: OFFER the aligning update for
     human disposition, never green-lock. Used by run-eval.mjs --dry-run to exercise the grader
     offline; a representative transcript, not a live capture. Deliberately does NOT declare the
     test fixed / does not apply the change, and does NOT route to /bug-report or call a
     suspected-break (that branch is for undocumented drift), so the must_not checks read as
     correctly absent. -->

## contract-guard: GET /api/rooms · spec: openapi.yaml (published)

### Tier → 2 differ
Consumer `server.cjs` reads `room.label` straight off `r.json()` — no response validation, and its
own git diff is empty. This is the untyped + empty-diff segment where the differ earns its keep.

### Field-level diff — consumer-expected (E) vs published spec (S)
- `id`    → E reads `.id`; S `GET /api/rooms` 200 items has `id: integer` — unchanged
- `label` → E reads `.label`; S has no `label`, now documents `name: string` (S moved: renamed) — **stale-consumer**

### Verdict → stale-consumer
The published spec has moved away from what the consumer reads: E (`.label`) ≠ S (`name`), and the
provider *documented* `name`. A documented rename is deliberate evolution, so the consumer is stale —
not an undocumented break. Reached statically, by reading the consumer's field access and the
published spec: contract-guard did not run the suite or snapshot the live response.

### Disposition  (challenger's flag — human decides)
Proposed update (you apply it, after confirming the rename was intended):

```diff
- li.textContent = room.label
+ li.textContent = room.name
```

This realigns the stale consumer to the provider's published contract. It is offered for human
disposition, never a green-lock — the published spec is the evidence the change was intended, and
you confirm before accepting.
