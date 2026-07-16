<!-- RECORDED SAMPLE — faithful route-NONE: a Kubernetes deploy/pipeline failure is an infra/CD
     problem, outside Sentinel's test-credibility domain. Nothing fits + one clarifying question,
     no **Use:** route. Used by run-eval.mjs --dry-run offline. -->

**You're at:** your Kubernetes deploy is failing on rollout — an infrastructure/pipeline problem.

Nothing in Sentinel fits this cleanly: Sentinel's skills all judge test credibility (what to test, coverage, whether green tests really guard anything), and a failing rollout is a CD/infra issue, not a testing one. I won't force a bad match.

**Could you tell me** if there's a *test* you expected to catch this before the rollout? Otherwise this is outside what Sentinel routes.
