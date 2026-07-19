# coverage-review, audit-test, and prune-tests consume one shared behavior-contract read; the three-into-one merge is designed but not taken

Under `/sentinel`, three skills independently read every changed test and derive the same thing —
each test's behavior contract and its assertion-quality smells (loose / incidental / overmocked).
`coverage-review` does it to find gaps, `audit-test` to pick mutation suspects, `prune-tests` to
find debt. A recent `audit-test` Step 3 revision de-duplicated the *definition* of that read (one
canonical source in `coverage-review`), but not its *execution*: the same test file is still
read three-plus times and the same loose assertion can be quadruple-reported (coverage-review,
audit-test, `/sentinel`'s Assertion Quality section, and prune-tests).

## Decision: share the pass, keep the three skills

Define **one canonical behavior-contract read** — read each changed test, state its contract in one
sentence, classify assertion quality — that runs once per `/sentinel` invocation. The three skills
consume its output and route to their disposition:

- `coverage-review` → **gap** (behavior with no covering assertion)
- `audit-test` → **mutate** (escalate suspects to a live mutation)
- `prune-tests` → **prune** (redundant / low-value / stale)

The skills keep their identities, their Owns/Not-this boundaries, and their ADRs. What changes is
that they stop re-deriving the read and instead consume a shared result, so a given finding is
reported once, by the skill that owns its disposition.

We keep three skills rather than merging into one because the boundaries are currently a strength,
not friction — but that judgment depends on user feedback we don't have yet.

## The merge go-plan (designed, not taken)

If feedback shows users want one test-quality skill instead of three, the collapse is pre-planned so
it is a rename, not a redesign:

- **Trigger:** repeated signal that the three-skill split adds ceremony without clarity — users
  invoking all three in sequence, or asking "which one do I run?"
- **Shape:** a single `test-quality` skill over the shared read with three dispositions
  (strengthen / gap / prune) as output sections rather than separate entry points.
- **What the shared pass already buys us:** the canonical read *is* the merged skill's core; merging
  becomes collapsing three thin dispositions onto one entry point, with the destructive-action gates
  (`audit-test` mutation revert, `prune-tests` propose-before-delete) carried over unchanged.
- **What we would lose:** the independent Owns/Not-this boundaries and per-skill ADRs; that cost is
  only worth paying if feedback says the split confuses more than it clarifies.

## Consequences

- The quadruple-report collapses to one finding per issue, owned by one disposition.
- The three-read cost drops to one read plus three cheap routing passes.
- We hold a ready migration path, so the merge decision is a product call on feedback, not an
  architecture project.
