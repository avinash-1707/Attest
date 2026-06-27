import OpenAI from 'openai';
import type { AgentRole, RunModelConfig } from '@attest/contracts';
import type { ModelClient, ModelRequest, ModelResponse } from './index';

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';

interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

interface ChatCompletion {
  choices: Array<{ message: { content: string | null } }>;
  // OpenRouter returns per-request cost in `usage.cost` automatically on every response (the old
  // `usage: { include: true }` request flag is deprecated and a no-op). UNIT CAVEAT: treated here as a
  // USD decimal; confirm against a live response before hosted launch, since it feeds the credit-debit
  // formula [tech-arch §13.2]. The value is config-multiplied and re-baselined against real run data.
  usage?: { cost?: number; total_tokens?: number } | null;
}

export interface OpenAILikeClient {
  chat: {
    completions: {
      create(params: { model: string; messages: ChatMessage[] }): Promise<ChatCompletion>;
    };
  };
}

// Compile-time guard: the real SDK must stay assignable to the seam we depend on. If a future openai
// major reshapes chat.completions.create or the response, this fails to build instead of silently
// breaking against the live gateway (which the all-fake tests cannot catch).
type AssertOpenAiSatisfiesSeam = OpenAI extends OpenAILikeClient ? true : never;
const _openAiSatisfiesSeam: AssertOpenAiSatisfiesSeam = true;
void _openAiSatisfiesSeam;

export function createOpenRouterModelClient(
  config: RunModelConfig,
  opts?: { baseURL?: string; client?: OpenAILikeClient },
): ModelClient {
  const client: OpenAILikeClient =
    opts?.client ??
    new OpenAI({ apiKey: config.apiKey, baseURL: opts?.baseURL ?? DEFAULT_BASE_URL });

  return {
    async complete(role: AgentRole, req: ModelRequest): Promise<ModelResponse> {
      const model = config.models[role];
      if (!model) {
        throw new Error(`no model configured for role: ${role}`);
      }

      const messages: ChatMessage[] = [];
      if (req.system) {
        messages.push({ role: 'system', content: req.system });
      }
      messages.push({ role: 'user', content: req.prompt });

      const completion = await client.chat.completions.create({
        model,
        messages,
        ...(req.maxTokens ? { max_tokens: req.maxTokens } : {}),
      });
      const text = completion.choices[0]?.message?.content;
      // An empty completion (no choices / null content) is a real fault - quota, content filter, or a
      // truncated response - not valid output. Throw a clear error instead of returning '' that later
      // surfaces as a misleading "non-JSON" parse failure downstream [audit 2026-06-27 L8].
      if (text == null || text === '') {
        throw new Error('model returned an empty completion (quota, content filter, or truncated response)');
      }
      const cost = completion.usage?.cost;
      return typeof cost === 'number' ? { text, costUsd: cost } : { text };
    },
  };
}
