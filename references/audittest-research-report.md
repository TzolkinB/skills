# Audit-test Research Report

## Bottom line

Yes, **“audit-test” has a real reason to exist**. The underlying problem is not hypothetical: software engineering research has repeatedly found **tests that execute code but fail to detect broken behavior**, including “pseudo-tested” methods where the method body can effectively be removed and the tests still pass. More recent work shows that **high coverage and even high mutation scores can still leave important expected behaviors entirely untested**, which means a green test suite can create false confidence rather than real confidence. In parallel, current AI-assisted development is intensifying the problem: developers report that AI-generated code often **looks correct but is not**, automated test generation produces **test smells and flakiness**, and recent research on coding agents shows they can optimize for the available test oracle rather than for the requested behavior itself. citeturn36academia2turn36academia3turn36academia0turn13news0turn14academia2turn14academia0turn16academia5

The strongest product case is **not** “another test quality tool.” It is a **fast, targeted, single-test auditor** for the exact question a skeptical QA or SDET person asks when a test passes but feels untrustworthy: **“Could this test fail for the right reason?”** That sits in a useful gap between broad coverage reports, full mutation testing, and generic test-smell detectors. Your own notes already identify that exact gap after the removal of `test-assert`, and the broader research landscape supports that diagnosis rather than contradicting it. citeturn36academia0turn37academia0turn37academia2turn37academia3 fileciteturn0file0 fileciteturn0file1

## Why suspicious passing tests are a real problem

The clearest evidence comes from the literature on **pseudo-tested methods**. In that work, researchers define pseudo-tested code as code that is covered by tests but for which **no test fails when the method body is removed or its effects are suppressed**. Studies found these methods across all subjects examined, including well-tested projects, which means “the test ran this code” is not the same thing as “the test would catch a meaningful regression here.” citeturn36academia2turn36academia3turn10academia7

That matters because common engineering proxies are weaker than teams often assume. A June 2026 study on **behavioural gaps** found that developers rely heavily on coverage and mutation testing, but these metrics are still implementation-centric. Across ten popular Java libraries, the authors conservatively estimated that **17.5% of detected expected behaviors were entirely untested**. More importantly for your concept, the study found that **most untested behaviors occurred in methods that already had high line coverage**, and **more than half persisted even in methods with high mutation kill score**. In other words, even relatively strong existing adequacy signals can still miss the specific question your skill wants to answer. citeturn36academia0

The mutation-testing literature also points in the same direction. Research on the “oracle gap” argues that the difference between coverage and mutation score helps identify places where code is executed but the **oracle is weak**, meaning the assertions do not strongly verify the behavior that matters. An industrial case study on extreme mutation testing similarly argues that teams should surface **pseudo-tested code** and run such checks closer to the act of writing tests, not only in detached quality-reporting sessions. citeturn36academia1turn10academia7

AI-assisted development is making this more urgent, not less. Sonar-reported survey findings from early 2026 show that **96% of developers do not fully trust AI-generated code to be functionally correct**, yet **fewer than half consistently check it before committing**, and **61% say AI code often looks correct but isn’t**. That is almost a textbook description of the “false confidence” problem. citeturn13news0turn13news1

Research on AI-generated tests and coding agents tightens the match even further. Studies have found that LLM-generated tests frequently contain **common test smells** such as **Assertion Roulette** and **Useless Test**, that generated tests can be **slightly more flaky** than existing tests, and that state-of-the-art automated test generators still leave substantial expected behaviors unvalidated. A recent paper on coding agents described a broader pattern of **“building to the test”**: when the oracle is available, agents can optimize toward passing it even while failing to deliver the requested artifact in the way a user would care about. That is extremely close to the failure mode you described as “test does not actually prove behavior.” citeturn14academia2turn14academia0turn36academia0turn16academia5

## Where respected QA and SDET professionals would likely find value

The best way to think about the audience is not “everyone who writes tests.” It is **well-known testing leaders whose public work centers on behavior, examples, automation quality, and skepticism about shallow green signals**.

**Angie Jones** is an especially strong fit for the automation-education and modern-SDET audience. Public sources describe her as a software engineer and automation architect with work across IBM, Twitter, Applitools, and Block, and note that she helped create **Test Automation University**, which Applitools described in 2021 as having surpassed **75,000 students** and becoming the largest free online education community for test automation at the time. For an audience shaped by that style of practitioner education, `audit-test` would be useful as a **PR-review or CI-side assistant for newly added tests**, especially AI-generated unit or API tests that compile, pass, and look respectable but may not strongly verify outcomes. This is an inference from Jones’s public focus on scalable automation education and from the documented rise of AI verification debt; it is not a claim of endorsement. citeturn22view0turn23view0turn24view1turn24view2turn13news0turn14academia2

**Lisa Crispin and Janet Gregory** are another strong fit because their public contribution is tied to **Agile Testing** and the popularization of the **Agile Testing Quadrants**, with a strong emphasis on examples, collaboration, and using tests to support delivery of the right product rather than only the product built a certain way. For that audience, `audit-test` would be most useful when a team already has examples and acceptance criteria, but suspects a particular automated test is merely following the current implementation instead of protecting the intended behavior. In that sense, the skill would act as a **micro-level executable-specification audit**. Again, this is an inference from their public body of work, not a direct statement from them about your feature. citeturn32search1turn32search0turn36academia0

**Gojko Adzic** is a particularly good fit for the **specification-by-example / living-documentation** audience. Public sources describe him as a software delivery consultant and prolific conference speaker, and note that he won the **Most Influential Agile Testing Professional Award** and the **European Software Testing Outstanding Achievement Award**. His work on **Specification by Example** argues that shared examples should become a reliable source of truth about business functionality. For people who think in that way, `audit-test` is useful when a passing test has drifted into becoming a **historical record of implementation** rather than a good example of desired behavior. That is exactly the kind of drift the skill could surface. citeturn40search0turn32search0

**James Bach** represents a different but still relevant school: exploratory, context-driven testing. Public sources describe him as a software tester, consultant, co-author of *Lessons Learned in Software Testing*, and an advocate of exploratory testing and session-based testing. That audience would probably not want `audit-test` presented as a truth machine. They would be more likely to value it as a **heuristic challenger** that proposes suspicious patterns, mutation thought experiments, and review prompts for humans to investigate. Presented that way, the skill fits the deeply skeptical tester rather than fighting them. citeturn42search1turn36academia2

The common thread across all four is this: each public body of work values **meaningful evidence over superficial green status**, even if they express that value in different ways. That makes your proposed skill credible for a respected testing audience if it is framed as a **trustworthiness audit for one test**, not as a replacement for test design, exploratory testing, or full mutation analysis. citeturn32search0turn36academia0turn10academia7

## Where current approaches help and where the gap still exists

There are already adjacent approaches, and that is actually a good sign: it means the problem is real. But the adjacent tools are not the same thing as your proposed workflow.

**Coverage tools** answer whether code was executed. They do not reliably answer whether a test would notice a meaningful behavioral regression. The behavioural-gap and pseudo-tested-method studies are both explicit on this point. citeturn36academia0turn36academia3

**Mutation testing tools** are closer to your goal. Research around PIT, Descartes, and extreme mutation testing is directly concerned with whether tests would detect seeded faults and with highlighting pseudo-tested methods. But mutation testing usually operates at the suite, method, or project level, often with runtime overhead and configuration demands that make it feel heavier than a quick “audit this one test right now” interaction. The industrial case study is telling here: the authors explicitly argue that the results are useful close to the time of writing tests, and that pseudo-tested code should be highlighted. That is a strong argument for a **lighter, faster front-end** to the same concern. citeturn37academia0turn10academia7turn36academia1

**Test-smell detectors** also help, but they stop earlier. Tools such as **TsDetect** and **PyNose** can identify patterns like Assertion Roulette, Useless Test, or Suboptimal assert, and the Python study found at least one test smell in **98% of studied projects**. That is valuable, but smell detection still does not fully answer the more applied question your skill centers: **what code change would break behavior while this specific test still passes?** Smell detectors find patterns; your skill would reason about likely false confidence for a singled-out test. citeturn37academia2turn37academia3

This is why your own internal notes line up well with the outside evidence. In `LEARNINGS`, you describe a gap created when `test-assert` was replaced by `debug-test`: there is no longer a tool explicitly aimed at a **passing-but-suspicious** test. In `sentinel_mpocock.md`, you argue that `/audit-test` should be priority work because the product thesis is about false confidence, while `debug-test` only handles failed tests. The research above suggests that diagnosis is sound. fileciteturn0file0 fileciteturn0file1

So the gap is real, but it is narrow. The right positioning is:

**`audit-test` is a fast, one-test trust audit that sits between test-smell linting and full mutation testing.**

That is a credible reason for existence. citeturn37academia0turn37academia2turn10academia7turn36academia0

## Use cases and scenarios that justify the skill

The strongest use case is **AI-generated or AI-edited tests in pull requests**. Developers are increasingly using AI in day-to-day coding, many do not fully trust the result, and many still under-review it. In that environment, newly generated tests are especially likely to become “green theater”: passing artifacts that appease CI without strongly protecting behavior. `audit-test` would give reviewers a fast way to interrogate a single suspicious test before merge. citeturn13news0turn13news1turn14academia2

A second high-value scenario is **regression-test validation after a bug fix**. Teams often add a regression test, watch it go green, and move on. But pseudo-tested-method research shows that a test can exercise the relevant code path and still fail to detect breakage. Here, `audit-test` would ask whether the new regression test can actually distinguish the fixed behavior from the broken one, ideally via a mutation thought experiment or a small set of targeted hypothetical code changes. citeturn36academia2turn36academia3turn10academia7

A third scenario is **overmocked unit tests**. In practice, many suspicious passing tests are not “bad” because they have no assertion; they are bad because they verify collaborator calls, object shapes, or current implementation structure rather than the outcome the business or user cares about. That is where a code-aware audit is more useful than a smell linter: it can inspect whether the unit under test is meaningfully invoked and whether the asserted predicates are behaviorally central or incidental. This scenario is strongly suggested by the behavioural-gap literature and by the distinction specification-by-example writers make between business-facing validation and purely technical checks. citeturn36academia0turn32search0

A fourth scenario is **test suites generated or amplified by tools**. Generated tests can inherit or introduce flakiness, produce common smells, and still miss expected behaviors. In database-system experiments, the most common cause of LLM-generated test flakiness was reliance on an order that was not guaranteed. That means `audit-test` should not only ask “would this fail?” but also “would it fail for a stable, intention-aligned reason?” citeturn14academia0turn14academia2

A fifth scenario is **legacy characterization tests**. These deserve special treatment, because characterization tests intentionally record existing behavior even when the deeper requirement is unclear. In those situations, `audit-test` should not blindly condemn the test for matching current behavior. Instead, it should classify it as a **characterization-style safety net** and explain that it offers limited evidence about intended behavior unless paired with stronger specification or risk analysis. That distinction matters if you want the tool to be welcomed by experienced testers rather than dismissed as naïve. citeturn36search6turn32search0

## Product criteria that would make audit-test genuinely useful

Your current acceptance criteria are directionally strong. The research suggests refining them in three important ways.

First, the input model should be **tiered rather than flat**. A single test file is enough to detect some obvious problems, such as loose assertions, no invocation of a focal unit, or brittle ordering assumptions. But claims like **“this only matches the current implementation”** are often much stronger when the tool also has the related production code, or at least the named focal function/class. Because behavioural gaps are specifically about the mismatch between expected behavior and what tests validate, a **code/test pair should be a first-class mode**, not just an optional bonus. citeturn36academia0turn36academia2

Second, the output should be a **structured verdict plus rationale**, not just flags. A useful shape would be:

- **Verdict:** likely strong, questionable, or likely false-confidence test.
- **Why:** concise explanation tied to one or more findings.
- **Failure classes:** for example, no focal invocation, assertion too loose, assertion incidental, overmocked interaction, order dependence, implementation coupling, or coverage-without-oracle pattern.
- **Mutation thought experiment:** a plausible code change that would break intended behavior while still letting the test pass.
- **Suggested rewrite:** what a stronger test would assert instead.

That emphasis on reasoned feedback rather than a naked score is consistent with research showing that practitioners value assertion clarity and troubleshooting help, and with the fact that skeptical testers will want something they can argue with, not merely obey. citeturn2academia0turn42search1

Third, the detection logic should combine **heuristics with progressive depth**:

- In **test-only mode**, look for weak oracles, assertion roulette, useless tests, order-sensitive assertions, and missing focal invocation. citeturn37academia2turn37academia3turn14academia0
- In **code-aware mode**, compare asserted behavior with the focal code path and detect likely implementation-coupling or pseudo-tested patterns. citeturn36academia0turn36academia2
- In **runtime-assisted mode**, optionally run tiny targeted perturbations, selected mutants, or “no-op” experiments for higher confidence, borrowing the spirit of mutation testing without requiring a full mutation campaign for every use. citeturn10academia7turn37academia0

Based on the evidence, I would revise the acceptance criteria to something like this:

**Recommended acceptance criteria**

The skill accepts **a single test file, a single named test, or a code/test pair**, with the code/test pair treated as the preferred high-confidence mode. It answers the core question **“Could this test fail for the right reason?”** and returns a verdict with a short explanation, explicit findings, a mutation thought experiment, and a suggested stronger assertion or test structure. It flags at least these conditions: **no meaningful invocation of the focal unit, overmocking or interaction-only verification, assertions on incidental details, loose or low-information assertions, order-sensitive assertions where order is not guaranteed, behavior checked only via current implementation shape, and tests that appear pseudo-tested or too weak to detect a plausible regression**. When the input is only a test file, it should clearly label any conclusion about implementation coupling as lower confidence. citeturn36academia0turn36academia2turn14academia0turn37academia2turn37academia3

## Recommendation

The evidence supports a **qualified yes**.

`audit-test` should exist **if it stays narrow**. It is most defensible as a companion skill for **passing-but-suspicious tests**, especially in AI-assisted workflows where teams are accumulating verification debt and where generated tests can be green, flaky, smelly, or behaviorally shallow. It should **not** be sold as a replacement for coverage, mutation testing, exploratory testing, or specification-by-example practices. Its value is speed, focus, and pragmatic skepticism: it audits one test at a time and asks whether the test deserves trust. citeturn13news0turn14academia2turn14academia0turn36academia0turn10academia7

The best product thesis is therefore:

**Use `audit-test` when a test passes but you are not sure it actually proves the behavior you care about.**

That thesis is consistent with the research, with the needs of respected testing practitioners, and with the gap already documented in your own Sentinel notes. citeturn36academia2turn36academia3turn16academia5 fileciteturn0file0 fileciteturn0file1