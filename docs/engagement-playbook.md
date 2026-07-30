# Engagement playbook — replying to posts in this space

Derived from [`positioning.md`](positioning.md). Every claim here is one that file sanctions; if the
two disagree, `positioning.md` wins.

Purpose: when a post or comment lands in the "AI writes tests / can we trust them" space, have a
response ready that is honest, short, and useful **whether or not** anyone installs anything.

## Five rules

1. **Lead with agreement and a concrete fact — never with a link.** These threads are full of people
   pitching. The differentiator is being the one comment that adds a checkable detail.
2. **Only Confirmed claims.** No calibration, no confidence numbers, no business-risk coverage, and
   nothing from the "claims we must not make" list. If you want to say something not on the sanctioned
   list, verify it first, then say it.
3. **Disclose that you built it, in the same breath as mentioning it.** "I build a tool in this space"
   costs one clause and buys the whole comment's credibility.
4. **No takedowns.** Never post a competitor's failure as a gotcha — particularly not TEA, which is a
   free credibility-side ally and the closest thing to an aligned community. The claim is always about
   the **category**, and the reason we can make it is that TEA is open enough to check.
5. **Be short.** Three to five sentences. If it needs more, it's a post, not a comment.

## When not to engage

- The thread is a product launch — you'd be a competitor in someone's comments.
- Your only contribution would be the link.
- The claim you want to make isn't Confirmed yet. Go verify it, then come back — or don't.

---

## Draft: the "generation is a commodity, proof is the challenge" post

The most common and most aligned post type. They've already made the argument; do not re-make it.

> Strongly agree on the framing. The part I'd add: most tools in this space establish coverage by
> showing a test **exists** and passes — a requirement gets marked covered because something maps to
> it, never because that test would actually fail if the behaviour broke. Those are very different
> claims, and only one of them survives a regression.
>
> The check I've found useful is blunt: break the code the test covers, on purpose, and see if the
> test notices. A test that stays green is the coverage illusion, caught. (I build a tool that does
> this for Playwright/Cypress, so I'm biased — but the technique works by hand too.)

Why it holds up: every sentence is Confirmed, the concrete technique is useful without our tool, and
the disclosure is in-line.

## Draft: the "self-healing broke my traceability" comment

Our strongest ground, and there's a real experiment behind it.

> This matches what I found testing it. A self-healer given a genuine regression rewrote the
> assertion to match the broken behaviour — the test went green and stayed "passing," while what it
> actually verified had silently changed.
>
> The bit I didn't expect: mechanical checks alone missed it. Catching it needed the test's original
> *intent* to still be recoverable from the code. So "does this test still verify what we think"
> can't be answered by re-running it — by then the evidence is gone.

Never state the healer finding without that second paragraph. The caveat is part of the claim
([`positioning.md`](positioning.md), claims table).

## Draft: the "our coverage is 90% and I don't trust it" complaint

> That instinct is usually right, and it's cheap to confirm. Pick one test on a critical path, break
> the code underneath it deliberately, and run just that test. If it still passes, the coverage number
> was measuring execution, not protection.
>
> Worth doing on three or four tests before you trust any number — it's the fastest way to find out
> whether your suite is guarding behaviour or just running it.

Pure value, no mention of the tool. Use this when the thread is already crowded with pitches.

## Draft: replying to a vendor pitch

Usually don't. If the exchange is genuinely technical:

> Curious how yours determines a requirement is covered — is it that a mapped test exists and passes,
> or does something check the test would fail if the behaviour broke? Genuinely asking; that's the
> line I've found most tools sit on one side of, mine included on plenty of axes.

Asks a real question, concedes our own limits, invites a substantive answer. Do not follow with a
link.

---

## Sanctioned facts to draw on

All Confirmed; sources in [`orchestration-map.md`](orchestration-map.md)'s evidence ledger.

- Mutation tools (StrykerJS, Tautest) mutate source and run Vitest/Jest — they structurally cannot
  reach a test driving a running app.
- Playwright's and Cypress's first-party agents optimise toward green; the healer will **skip** a test
  if the functionality appears broken.
- `audit-test` runs a real mutation against dev-served Playwright/Cypress and reports whether the test
  caught it — validated outside our own fixtures.
- TEA's `trace` gates on coverage presence — usable as *"the best free tool in this category works
  this way,"* **never** as *"TEA is broken."*
- A killed mutation confirms the test catches **that specific** break. Not any break. Say it that way.

## Never say

Numeric confidence · "verified" where we mean "self-reported" · Sigstore or trusted-publisher ·
"we measure business risk coverage" · calibration as a live feature · anything framing a named
competitor as the villain.
