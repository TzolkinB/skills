// Grading for the Sentinel skill-eval harness (Phase 1 of issue #74).
//
// Stance is fixed by ADR-0022: assert deterministically on tokens, judge the
// prose against the fixture rubric, NEVER diff output. This module implements
// the two graders:
//
//   1. assertTokens()  — the deterministic layer. Cheap regex over genuinely
//      deterministic tokens (the **Verdict:** emoji, a route name, a filename).
//      Free of model cost, fails fast.
//   2. judge()         — the prose layer. Grades each `must_surface` / `must_not`
//      rubric item from the fixture's expected-findings.
//
// The real judge (ADR-0022 §Decision.2) is an LLM that reads `claim` as the
// rubric and must QUOTE the transcript line that satisfies it. That is wired as
// `judgeLLM` but not yet implemented; the default `judgeHeuristic` is an OFFLINE
// STAND-IN so the pipeline runs and is testable without an API key. The
// heuristic screens by anchor keywords — it is a scaffold, not the design.

import { readFileSync } from 'node:fs';

// ---- deterministic token layer -------------------------------------------

export function assertTokens(transcript, testCase) {
  const results = [];
  if (testCase.expect_verdict) {
    const line = firstLineMatching(transcript, /\*\*verdict:\*\*/i);
    const ok = line != null && line.includes(testCase.expect_verdict);
    results.push({
      kind: 'verdict',
      expected: testCase.expect_verdict,
      ok,
      evidence: line ?? '(no **Verdict:** line found)',
    });
  }
  for (const tok of testCase.expect_tokens ?? []) {
    const line = firstLineContaining(transcript, tok);
    results.push({ kind: 'token', expected: tok, ok: line != null, evidence: line ?? `(missing: ${tok})` });
  }
  return results;
}

// ---- prose judge layer ----------------------------------------------------

// Offline heuristic stand-in for the ADR-0022 LLM judge. Each rubric item
// carries `anchors` ({ all: [...] } / { any: [...] }) that let this screen the
// transcript offline; the LLM judge would use `claim` directly and drop the
// anchors. must_surface: a match is a PASS. must_not: a match is a FAILURE (the
// run did the forbidden thing).
export function judgeHeuristic(transcript, testCase) {
  const surfaced = (testCase.must_surface ?? []).map((item) => {
    const ev = anchorEvidence(transcript, item.anchors);
    return { claim: item.claim, ok: ev != null, evidence: ev ?? '(no line matched rubric anchors)' };
  });
  const violations = (testCase.must_not ?? []).map((item) => {
    const ev = anchorEvidence(transcript, item.anchors);
    return { claim: item.claim, ok: ev == null, evidence: ev ?? '(correctly absent)' };
  });
  return { surfaced, violations };
}

// The real judge — ADR-0022 §Decision.2. Same signature as judgeHeuristic so
// run-eval can swap it in with --judge=llm once wired to a model call.
export function judgeLLM() {
  throw new Error(
    'judge=llm is not implemented yet (ADR-0022 §Decision.2). ' +
      'Wire a cheap-model call that grades each `claim` and returns a quoted ' +
      'transcript line per item, then meta-eval it against a known-good and ' +
      'known-bad sample before trusting it. Use --judge=heuristic offline.',
  );
}

const JUDGES = { heuristic: judgeHeuristic, llm: judgeLLM };

// ---- combine into a per-transcript verdict --------------------------------

export function gradeTranscript(transcript, testCase, { judge = 'heuristic' } = {}) {
  const judgeFn = JUDGES[judge] ?? judgeHeuristic;
  const tokens = assertTokens(transcript, testCase);
  const { surfaced, violations } = judgeFn(transcript, testCase);
  const pass =
    tokens.every((t) => t.ok) && surfaced.every((s) => s.ok) && violations.every((v) => v.ok);
  return { pass, tokens, surfaced, violations };
}

export function gradeSampleFile(path, testCase, opts) {
  // Sample files carry an explanatory <!-- … --> header a live transcript would
  // not; strip it so the quoted evidence reflects the real output lines.
  const transcript = readFileSync(path, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  return gradeTranscript(transcript, testCase, opts);
}

// ---- helpers --------------------------------------------------------------

// The one line-finder the three callers share: first line satisfying `pred`, trimmed.
function findLine(transcript, pred) {
  return transcript.split('\n').find(pred)?.trim() ?? null;
}
function firstLineMatching(transcript, re) {
  return findLine(transcript, (l) => re.test(l));
}
function firstLineContaining(transcript, needle) {
  return findLine(transcript, (l) => l.toLowerCase().includes(needle.toLowerCase()));
}
function anchorEvidence(transcript, anchors = {}) {
  const lineWith = (kw) => findLine(transcript, (l) => l.toLowerCase().includes(kw.toLowerCase()));
  if (anchors.all) {
    const allPresent = anchors.all.every((kw) => lineWith(kw) != null);
    return allPresent ? lineWith(anchors.all[0]) : null;
  }
  if (anchors.any) {
    for (const kw of anchors.any) {
      const l = lineWith(kw);
      if (l) return l;
    }
    return null;
  }
  return null;
}
