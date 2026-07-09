# Contributing / Getting Feedback

Sentinel is a personal framework first, but it's more useful — and more credible — with real input from people who do QA professionally.

## If you're a seasoned QA professional reviewing this

Specific questions that are actually useful (generic "what do you think?" isn't):

- Does this orchestration approach match how you'd structure testing on a real project?
- What's missing from a real testing perspective — not a beginner's checklist, but something you'd expect to see and don't?
- Would you use this on a project? Why or why not?
- Where would this break — what kind of codebase or team would make this fall apart?

## Logging feedback

When feedback comes in, log it in [`LEARNINGS.md`](./LEARNINGS.md) under the "Expert Feedback" section — dated, attributed if the person is willing, and honest about what changed (or didn't) as a result. Feedback that doesn't get acted on is still worth recording; it's evidence the tool was actually reviewed, not just built in isolation.

Don't write up feedback that hasn't happened yet. An empty log is more credible than a fabricated one.

## If you want to contribute code/skills

1. Try the skills on your own code first
2. Open an issue describing the gap you hit
3. PRs welcome, especially ones that come with a real example of what broke without the fix

## Required checks

Every pull request must pass the **`validate`** GitHub Actions workflow before it
can merge. It runs `claude plugin validate` across the repo — the root
marketplace manifest plus each plugin — and fails on any invalid manifest or
malformed skill/agent/command frontmatter. Run it locally before pushing:

```
claude plugin validate .          # marketplace manifest
claude plugin validate ./sentinel # a plugin (manifest + skill frontmatter)
```
