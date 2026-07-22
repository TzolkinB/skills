<!-- RECORDED SAMPLE — a faithful /sentinel synthesis of the feat/payments-refund scenario. A 🔴
     confirmed false-confidence test lands on the sacred path src/payments/**, so the Sacred-Path
     Override fires → un-overridable 🔴 FAIL. Names the sacred path + paired source, keeps provenance
     honest (confirmed counted as confirmed; 5 Unexamined reported as unexamined). Used by run-eval.mjs
     --dry-run offline. Deliberately does NOT soften to CAUTION/PASS and emits no numeric score, so
     the must_not checks read as correctly absent. -->

# Sentinel Report: feat/payments-refund

## Overview
**Verdict:** 🔴 FAIL
**Provenance:** static judgment — 0 confirmed-solid · 1 confirmed-hollow · 0 likely-hollow · 5 unexamined (audit ran; not INCONCLUSIVE)
**Risk Level:** High
**Shippable:** No — un-overridable
**Sacred paths:** `src/payments/**` (1 designated) — **TRIPPED**

---

## False-Confidence Audit
Audited 6 changed tests · deep-audited 1 (0 🟢 confirmed-solid · 1 🔴 confirmed-hollow) · 5 unexamined
🔴 "refunds the full charge" (`src/payments/refund.test.js`) — overmocked, confirmed (removed the refund-amount guard → test stayed green) — paired to `src/payments/refund.js`
→ 1 confirmed false-confidence **on a sacred path**. The paired source `src/payments/refund.js` matches `--sacred=src/payments/**`, so the **Sacred-Path Override fires**: this is an **un-overridable 🔴 FAIL**. It cannot be softened to CAUTION by the rest of the branch. The 5 Unexamined tests are triaged-clean only — not proof, and not counted as confirmed-solid.

---

## Risk Summary
| Category | Count | Severity |
|----------|-------|----------|
| Confirmed false-confidence (sacred) | 1 | CRITICAL |
| Loose assertions | 1 | MEDIUM |
| Testability issues | 1 | MEDIUM |

---

## Recommendations
1. **BEFORE SHIPPING (blocks merge — sacred, un-overridable):** Fix "refunds the full charge" — assert the refund amount actually returned, not that a stub was called. It guards `src/payments/refund.js` and currently guards nothing (confirmed by mutation).
2. **BEFORE SHIPPING:** Mock the hard-coded URL in `src/reports/export.js` (testability).
3. **FOLLOW-UP:** Tighten the loose assertion in `src/reports/export.test.js`.
