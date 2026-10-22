# Working in this repo

## Clean-room rule for third-party tools

Ideas and behaviours are free to learn from. Code and text are not. Whenever work is inspired by
another tool (Tautest, TEA, Stryker, mewt, Kane, Explorbot, and so on), check it against these four rules
before you finish, and say in your summary how it passes.

1. **Write it ourselves.** Use our own code and our own wording. Take the behaviour or idea only.
2. **Cite the inspiration.** Name the tool and what idea we took in the ADR (or the doc that records the
   decision). Mark any claim about the tool with its evidence tier (T1 docs, T2 source, T3 run).
3. **Respect permissive licenses.** If anything is copied from an Apache-2.0 or MIT source (Tautest, TEA,
   Kane, StrykerJS, Playwright), keep its license notice and attribution. Copying should be rare.
4. **Do not copy from restrictive licenses.** mewt is AGPL-3.0 and Explorbot is Elastic-2.0: copy no code
   and no text. Describe their behaviour in our own terms, from their docs. Check the license of any
   other tool before you read its source with the intent to reuse it.

If a change cannot pass these four rules, stop and ask the owner.

The `clean-room` CI check runs on every pull request: the PR body must tick the four boxes (or say
`Clean-room: n/a`), and no code may add an AGPL or Elastic license marker. Claude sessions check their own
work against the four rules; CI checks the PR.
