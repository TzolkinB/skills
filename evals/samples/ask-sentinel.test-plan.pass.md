<!-- RECORDED SAMPLE — faithful /ask-sentinel routing of a "what should I test before I build"
     situation to /test-plan. Names ONE primary route with a why tying test-plan's single question
     (cases/layers before code) to the situation, plus the next step in the flow. Used by
     run-eval.mjs --dry-run offline; a representative transcript, not a live capture. -->

**You're at:** about to build a checkout feature and you want the test cases mapped out up front.

**Use:** `/test-plan`
**Why:** your question is *what should be tested* before any code exists — that is exactly the one question `/test-plan` answers, producing the cases and test layers up front.
**Run:** `/test-plan checkout feature — cart, payment, confirmation`

**Next in the flow:** once the code exists, `/qa-review` (is it testable?) then `/coverage-review` (what's missing?).
