import { z } from 'zod';
import type { ModelClient } from '../adapters/model/index';
import type { Journey } from '../journey';

// planner: goal -> journey, one strong-model call per run [arch §4.1, §7.1].

export class PlanError extends Error {
  override name = 'PlanError';
}

const actionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('goto'), url: z.string().min(1) }),
  z.object({ kind: z.literal('click'), intent: z.string().min(1) }),
  z.object({ kind: z.literal('type'), intent: z.string().min(1), text: z.string() }),
]);

const stepSchema = z.object({
  name: z.string().min(1),
  action: actionSchema,
  expectation: z
    .object({
      url: z.string().optional(),
      elementText: z.string().optional(),
      elementRole: z.string().optional(),
    })
    .optional(),
});

// Cap the journey length: a runaway/adversarial planner response must not drive thousands of browser
// actions and exhaust the worker [audit 2026-06-27 M8]. 40 steps comfortably covers real flows.
const MAX_STEPS = 40;
const planSchema = z.object({ steps: z.array(stepSchema).min(1).max(MAX_STEPS) });

const SYSTEM = [
  'You are a QA planner. Given a goal and a starting URL, produce an ordered journey of UI',
  'steps that verifies the goal in a real browser. Respond with ONLY JSON of the shape:',
  '{"steps":[{"name":string,"action":{"kind":"goto","url":string}',
  '|{"kind":"click","intent":string}|{"kind":"type","intent":string,"text":string},',
  '"expectation"?:{"url"?:string,"elementText"?:string,"elementRole"?:string}}]}.',
].join(' ');

export async function plan(input: { goal: string; url: string }, model: ModelClient): Promise<Journey> {
  const res = await model.complete('planner', {
    system: SYSTEM,
    prompt: `Goal: ${input.goal}\nStart URL: ${input.url}`,
    // Bound the completion so an oversized response can't be buffered/parsed unbounded [audit M8].
    maxTokens: 4096,
  });

  let raw: unknown;
  try {
    raw = JSON.parse(res.text);
  } catch {
    throw new PlanError('planner returned non-JSON output');
  }

  const parsed = planSchema.safeParse(raw);
  if (!parsed.success) {
    throw new PlanError(`planner output failed validation: ${parsed.error.message}`);
  }

  return {
    goal: input.goal,
    steps: parsed.data.steps.map((step, index) => ({ index, ...step })),
  };
}
