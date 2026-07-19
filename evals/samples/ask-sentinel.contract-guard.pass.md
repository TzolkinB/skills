<!-- RECORDED SAMPLE — faithful /ask-sentinel routing of a "frontend E2E red, backend changed the
     response — does it still match the contract?" situation to /contract-guard. --dry-run offline. -->

**You're at:** a frontend E2E suite going red on a suspected backend response change you didn't cause and can't fix at the source.

**Use:** `/contract-guard`
**Why:** the question is whether the backend response still matches its published contract — `/contract-guard` diffs the shape your frontend expects against the provider's published OpenAPI/Swagger and surfaces deliberate-vs-accidental for a human, never green-locking.
**Run:** `/contract-guard GET /api/rooms ./openapi.json`
**Evidence:** advice (own) — static-judgment; reads the published contract, never snapshots a live response.

**Next in the flow:** a suspected break routes to `/bug-report`; you can also `/debug-test --drift` to classify the red first.
