# contract-guard — did the backend change without the frontend seeing it?

> **Agent instructions:** [`skills/contract-guard/SKILL.md`](../skills/contract-guard/SKILL.md)
>
> **Run:** `/contract-guard [endpoint or red spec] [published spec path/URL]`

## What it does

Pact is the standard tool for catching a backend change before it breaks a consumer. But Pact needs the _provider_ to run verification. An enterprise frontend team often depends on a backend that another team owns, on a different release schedule. If that backend team does not participate in Pact, the frontend gets **no coverage at all**. The backend renames a field, drops a field, or changes a field's type. The frontend's green E2E suite goes red on a contract change it did not cause. The frontend team is not able to fix the change at the source.

`contract-guard` is the consumer-side check for that stranded team. It gives what Pact does not. It reads what the frontend already has — its response-consumption code, and any in-code schema — against the provider's **published** OpenAPI/Swagger document. That published document is almost always _readable_ across the org boundary, even when the provider will not _run_ verification.

The skill is **tiered, and it starts with the cheapest check**.

Tier 0 checks whether the consumer already validates responses against a schema — Zod, io-ts, or yup. If it does, a backend change is already self-revealing. Tier 0 recommends nothing new.

Tier 1 applies to an untyped consumer. It proposes and scaffolds response-schema validation at the fetch boundary. This is the light option: it makes a future backend change self-diagnosing. It needs another team's sign-off to merge.

Tier 1b applies when a published spec is also available. It additionally proposes validating the live response **inside the suite the SDET already owns** — `cypress-schema-validator` or `playwright-schema-validator`. These are the current MIT packages. Do not use their more-downloaded, superseded `*-ajv-schema-validator` predecessors. Tier 1b needs **zero production code**.

That plugin only catches what the operation's schema declares as `required`. So every Tier 1b recommendation carries a per-operation **drift-coverage** line, read directly off `required`. The line states plainly which of rename, drop, or retype the check actually catches on _this_ endpoint, and it names the uncovered fields. It never gives a percentage ([ADR-0013](./adr/0013-evidence-provenance-sentinel-labels-not-gates.md)). The same `required` read also promotes the optional/nullable flag to a first-class output, not an aside.

Tier 2 handles the hard case: an untyped consumer facing an **empty-diff mismatch** — the repo changed nothing, yet the suite turned red. Tier 2 compares what the consumer expects against the published spec and returns one of three verdicts:

- **`stale-consumer`** — the spec moved. The change is deliberate and provider-documented. `contract-guard` offers the aligning update.
- **`suspected-break`** — the spec still matches, yet the test is red. This is an undocumented change. `contract-guard` routes the finding to [`bug-report`](./bug-report.md).
- **`no-spec`** — `contract-guard` is not able to confirm intent. It never fabricates a match.

An unresolvable operation degrades the drift-coverage line to `no-spec` the same way ([ADR-0049](./adr/0049-contract-guard-test-boundary-validation-tier.md)).

## When to reach for it

| Your situation | Where to go |
| --- | --- |
| A frontend E2E suite turns red with an empty diff, and the likely cause is a backend team you do not control | **`/contract-guard [endpoint or red spec] [published spec path/URL]`** — this page |
| You want to know whether a backend contract change is deliberate (documented in its published spec) or an undocumented break, without waiting for the provider to run anything | **`/contract-guard`** |
| The spec is already red and you have not classified why | [`debug-test --drift`](./debug-test.md) is the first stop — it recommends this skill for the harder empty-diff case, instead of duplicating the differ inline |
| You want to know which specs a diff hits | [`e2e-impact`](./e2e-impact.md) |
| You want to prove that a passing spec catches a real break | [`audit-test`](./audit-test.md) |
| You want to structure the cross-team escalation itself | Not this skill — it routes a `suspected-break` to [`bug-report`](./bug-report.md) rather than writing the report |

## Prerequisites

Just Claude Code. It reads consumer source, any in-code schema, and a published OpenAPI/Swagger document. That document is a local path or a URL you supply. Fetching the published document is the one network call any skill in this repo makes on its own ([README](../README.md)). `contract-guard` never runs the suite, drives a browser, or snapshots a live response ([ADR-0010](./adr/0010-execution-out-temporal-deferred-behind-a-seam.md)).

## Worked example

`contract-guard` needs a real frontend that consumes a real backend over HTTP. So it uses **warm sibling fixtures** in `~/projects/`, instead of a vendored one ([why](../fixtures/README.md)): [expected findings](../fixtures/contract-guard/expected-findings.md).

Against `mosaic-room-booking`, the consumer runs `z.array(RoomSchema).safeParse(data)` on `GET /api/rooms`. This is Tier 0: `contract-guard` recommends nothing new, because a `label`→`name` rename already fails loudly.

Against `epic-stack/.drift-fixture`, the consumer reads `room.label` straight off `r.json()`, with no validation. The "backend team" renames the field out-of-band. This leaves an **empty diff** in the consumer repo, while the spec goes red. If you supply the published OpenAPI document, which now lists `name` instead of `label`, the verdict is **`stale-consumer`**: the spec sanctions the rename. `contract-guard` offers `room.label → room.name` as a deliberate-evolution fix, instead of green-locking the mismatch silently. If the published spec still said `label`, the same red test gets the verdict **`suspected-break`**, and `contract-guard` routes it to `bug-report` instead.

Run `contract-guard` against the same untyped `.drift-fixture` consumer, with a spec supplied but no empty-diff mismatch yet. Tier 1b also fires here. It proposes `playwright-schema-validator`, because the suite is Playwright. It reads the operation's `required: [id, label]` and states the coverage plainly: the check catches a retype, drop, or rename of `label`. It does not catch a drop or rename of an unrequired field like `capacity`. `contract-guard` flags that gap separately, as a latent optional/nullable break.

## It's Working If

- Tier 0 recommends nothing new when the consumer already validates responses against a schema — a backend change there is already self-revealing.
- Every Tier 1b recommendation states plainly which of rename, drop, or retype it actually catches on this endpoint, read off the operation's `required` fields — never a percentage.
- A `stale-consumer` verdict only fires when the published spec confirms the change is deliberate; anything that still mismatches the spec is `suspected-break`, not waved through.
- An unresolvable operation degrades honestly to `no-spec` — `contract-guard` never fabricates a match.
- `contract-guard` never runs the suite, drives a browser, or snapshots a live response.

If `contract-guard` ever green-locks a `suspected-break`, or guesses a verdict with no published spec, that is a bug — file it. See [Contributing & Support](../README.md#contributing--support).

## FAQ

**Q: My consumer already validates responses with Zod, io-ts, or yup — does contract-guard still recommend adding schema validation?**
A: No. Tier 0 checks for this first. If it's already there, a backend change is already self-revealing, and `contract-guard` recommends nothing new.

**Q: Does the Tier 1b drift-coverage line give a percentage?**
A: No — it names exactly which of rename, drop, or retype the check catches on this endpoint, read off the operation's `required` fields, and names the uncovered fields plainly ([ADR-0013](./adr/0013-evidence-provenance-sentinel-labels-not-gates.md)).

**Q: What happens when there is no published spec to compare against?**
A: The verdict degrades honestly to `no-spec` — `contract-guard` never fabricates a match to force a `stale-consumer` or `suspected-break` call.

**Q: Does contract-guard apply the fix itself?**
A: No. The Tier 1 schema and the Tier 2 aligning update are proposed diffs. A human — and, for Tier 1, another team's sign-off — applies them.

## Where it fits

`contract-guard` sits alongside [`debug-test --drift`](./debug-test.md) as the escalation path. It handles the case that drift mode's lightweight inline check does not resolve on its own — the untyped-consumer, empty-diff segment ([EXPERIMENT-0018](./experiments/EXPERIMENT-0018-drift-triage.md)). It shares the deliberate-vs-accidental check with drift mode's disposition ([ADR-0018](./adr/0018-debug-test-drift-triage.md), [ADR-0021](./adr/0021-contract-guard-consumer-side-openapi-differ.md)). It hands a `suspected-break` off to [`bug-report`](./bug-report.md) for the cross-team escalation.

## Anti-patterns

- **Green-locking a `suspected-break`.** If the published spec still matches what the consumer reads, a live response that deviates from the provider's own contract is a real break. Do not paper over it.
- **Reaching for the differ when Tier 0 already covers it.** A consumer with existing response validation gets no new guard. Adding one is ceremony over a case that already self-diagnoses.
- **Guessing a verdict with no published spec.** No spec, an unlocatable endpoint, or a malformed document degrades honestly to `no-spec`. `contract-guard` never fabricates a match.
- **Applying the fix yourself.** The Tier-1 schema and the Tier-2 aligning update are proposed diffs. The human adopts them.
