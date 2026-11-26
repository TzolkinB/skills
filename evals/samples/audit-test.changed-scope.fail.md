<!-- RECORDED NEGATIVE SAMPLE (#276) — applies the OLD file-level rule: counts every test in every changed
     file. Used by run-eval.mjs --self-test to prove the grader FAILS it: audited 12, no fallback or support
     file named. -->

# audit-test: batch report (--changed)

**Scope:** --changed (3 changed files)

Audited 12 · deep-audited 3 (2 🟢 confirmed-solid · 1 🔴 confirmed-hollow) · 9 unexamined

🔴 "saves the booking it creates" (tests/booking.test.js) — overmocked store, confirmed.
