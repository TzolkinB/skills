// LLM-as-judge for the Sentinel skill-eval harness — the real Phase-1 grader
// mandated by ADR-0022 §Decision.2. Zero-dependency Node: a single `fetch` to
// the Anthropic Messages API. Cheap model (Haiku 4.5 — the ADR's "cheap judge
// model"; Haiku still accepts `temperature`, unlike the 4.7/4.8/5 tier), and a
// forced `tool_choice` so grades come back as one validated JSON object instead
// of prose to re-parse.
//
// Quote-grounding (ADR-0022 §Decision.2 / §Consequences) is enforced *after*
// the model returns: a claimed quote only counts if it is a verbatim substring
// of the transcript. That is the anti-rubber-stamp check — the model cannot pass
// an item by asserting it without pointing at a real line.
//
// Same signature and return shape as judgeHeuristic (grade.mjs), so run-eval
// swaps it in with --judge=llm. Requires ANTHROPIC_API_KEY.

const API_URL = (process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com') + '/v1/messages';
const MODEL = process.env.SENTINEL_EVAL_JUDGE_MODEL ?? 'claude-haiku-4-5';
const ANTHROPIC_VERSION = '2023-06-01';

const GRADE_TOOL = {
  name: 'record_grades',
  description:
    'Record the grade for every rubric item, each with a verbatim supporting quote copied from the transcript.',
  input_schema: {
    type: 'object',
    properties: {
      surfaced: {
        type: 'array',
        description: 'One entry per must_surface item, keyed by its index.',
        items: {
          type: 'object',
          properties: {
            index: { type: 'integer', description: 'Index of the must_surface item.' },
            satisfied: { type: 'boolean', description: 'True only if the transcript actually states this.' },
            quote: { type: 'string', description: 'Verbatim transcript line supporting it; empty if not satisfied.' },
          },
          required: ['index', 'satisfied', 'quote'],
        },
      },
      violations: {
        type: 'array',
        description: 'One entry per must_not item, keyed by its index.',
        items: {
          type: 'object',
          properties: {
            index: { type: 'integer', description: 'Index of the must_not item.' },
            violated: { type: 'boolean', description: 'True if the transcript does the forbidden thing.' },
            quote: { type: 'string', description: 'Verbatim transcript line showing the violation; empty if absent.' },
          },
          required: ['index', 'violated', 'quote'],
        },
      },
    },
    required: ['surfaced', 'violations'],
  },
};

const SYSTEM =
  'You are a strict grader for a QA-skill evaluation. You receive the TRANSCRIPT of a QA ' +
  "skill's run and a RUBRIC. For each rubric item, decide whether the transcript satisfies it " +
  'and copy the EXACT verbatim line from the transcript that supports your decision — never ' +
  'paraphrase a quote. If you cannot quote a real line from the transcript, the item is not ' +
  'satisfied. Grade only what the transcript actually says; do not reward intent or ' +
  'plausibility. Call record_grades exactly once.';

export async function judgeLLM(transcript, testCase) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'judge=llm needs ANTHROPIC_API_KEY in the environment (or export a token from ' +
        '`ant auth print-credentials --access-token`). Use --judge=heuristic to grade offline.',
    );
  }
  const surface = testCase.must_surface ?? [];
  const notItems = testCase.must_not ?? [];

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      temperature: 0, // valid on Haiku 4.5; override SENTINEL_EVAL_JUDGE_MODEL only to another sampling-capable model
      system: SYSTEM,
      tools: [GRADE_TOOL],
      tool_choice: { type: 'tool', name: 'record_grades' },
      messages: [{ role: 'user', content: buildPrompt(transcript, surface, notItems) }],
    }),
  });
  if (!res.ok) throw new Error(`judge API ${res.status}: ${(await res.text()).slice(0, 500)}`);

  const data = await res.json();
  if (data.stop_reason === 'refusal') throw new Error('judge refused to grade this transcript');
  const toolUse = (data.content ?? []).find((b) => b.type === 'tool_use' && b.name === 'record_grades');
  if (!toolUse) throw new Error('judge returned no record_grades tool call');

  return groundAndMap(transcript, testCase, toolUse.input);
}

function buildPrompt(transcript, surface, notItems) {
  const list = (items) => items.map((it, i) => `${i}. ${it.claim}`).join('\n') || '(none)';
  return (
    `TRANSCRIPT:\n"""\n${transcript.trim()}\n"""\n\n` +
    `RUBRIC — must_surface (the run SHOULD name each of these):\n${list(surface)}\n\n` +
    `RUBRIC — must_not (the run must NOT do any of these):\n${list(notItems)}\n\n` +
    'Grade every item by its index. Quote verbatim from the transcript.'
  );
}

// Enforce quote-grounding and map the model's index-keyed answers back to the
// rubric claims + the heuristic judge's return shape. A quote only counts if it
// is a real substring of the transcript; both directions default to the safe
// reading (unsupported claim → not surfaced; unsupported violation → not a
// violation), so the judge can't rubber-stamp either way without evidence.
function groundAndMap(transcript, testCase, input) {
  const hay = transcript.toLowerCase();
  const grounded = (q) => typeof q === 'string' && q.trim() !== '' && hay.includes(q.trim().toLowerCase());
  const byIndex = (arr) => new Map((arr ?? []).filter((e) => Number.isInteger(e.index)).map((e) => [e.index, e]));

  const sMap = byIndex(input.surfaced);
  const vMap = byIndex(input.violations);

  const surfaced = (testCase.must_surface ?? []).map((item, i) => {
    const e = sMap.get(i);
    const ok = e?.satisfied === true && grounded(e.quote);
    return { claim: item.claim, ok, evidence: ok ? e.quote.trim() : '(judge found no grounded evidence)' };
  });
  const violations = (testCase.must_not ?? []).map((item, i) => {
    const e = vMap.get(i);
    const violated = e?.violated === true && grounded(e.quote);
    return { claim: item.claim, ok: !violated, evidence: violated ? e.quote.trim() : '(correctly absent)' };
  });
  return { surfaced, violations };
}
