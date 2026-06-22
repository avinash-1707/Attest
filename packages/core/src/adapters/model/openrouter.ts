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

      const completion = await client.chat.completions.create({ model, messages });
      return { text: completion.choices[0]?.message?.content ?? '' };
    },
  };
}
