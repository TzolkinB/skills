<!-- RECORDED NEGATIVE SAMPLE — WRONG: forces a CSS question onto /qa-review. It emits a **Use:**
     route (must_not violated) and never says nothing fits / never asks a clarifying question
     (must_surface unsatisfied) → FAIL. This is the "forced bad match" SKILL step 6 forbids. -->

**You're at:** you have a UI concern with a div.

**Use:** `/qa-review`
**Why:** qa-review looks at whether UI code is testable, which touches your layout.
**Run:** `/qa-review src/components/Layout.tsx`

**Next in the flow:** `/coverage-review`.
