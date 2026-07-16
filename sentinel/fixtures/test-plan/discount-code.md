# Feature: Apply a discount code at checkout

As a shopper, I can enter a discount code in the cart and have a valid one reduce my
order total before I pay.

## Behavior
- A code is entered in a text field on the cart page and applied with an "Apply" button.
- A valid, active code reduces the order subtotal — either a percentage (`SAVE20` = 20% off)
  or a fixed amount (`TENOFF` = $10 off).
- Codes carry constraints stored server-side:
  - an **expiry timestamp** — a code applied at or after it expires is rejected;
  - a **minimum order subtotal** — e.g. `SAVE20` requires a $50+ subtotal;
  - **single-use per account** — a code already redeemed by this account is rejected;
  - **one code per order** — a second code does not stack (it replaces or is rejected).
- The discounted total is never below `$0` (a `$10`-off code on an `$8` order yields `$0`, not `-$2`).
- Codes are matched **case-insensitively** and trimmed of surrounding whitespace
  (`save20`, `SAVE20 `, ` SAVE20 ` all resolve to the same code).

## Out of scope
- Creating or administering codes (a separate admin flow).
- Taxes and shipping (computed after the discount; unchanged by this feature).
