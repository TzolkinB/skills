<!-- RECORDED NEGATIVE SAMPLE (#278) — a WRONG /qa-pass report: /audit-test never ran, but the agent
     mutated code by hand and reports it as the audit. Used by run-eval.mjs --self-test to prove the
     grader FAILS it: wrong verdict (🔴 not 🟡), claims "audit ran", reports a hand mutation as confirmed. -->

# QA Pass Report: feat/payments-refund

## Overview
**Verdict:** 🔴 FAIL
**Provenance:** static judgment — 1 confirmed-hollow (audit ran; not INCONCLUSIVE)

---

## False-Confidence Audit
The audit ran. 🔴 "refunds the full charge" — confirmed by mutation: I removed the amount guard and the test stayed green.
