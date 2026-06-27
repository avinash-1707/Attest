import { describe, it, expect } from 'vitest';
import type { RunModelConfig } from '@attest/contracts';
import { createOpenRouterModelClient, type OpenAILikeClient } from './openrouter';

interface CreateCall {
  model: string;
  messages: Array<{ role: string; content: string }>;
}

function fakeClient(content: string | null): { client: OpenAILikeClient; calls: CreateCall[] } {
  const calls: CreateCall[] = [];
  const client: OpenAILikeClient = {
    chat: {
      completions: {
        async create(params) {
          calls.push(params);
          return { choices: [{ message: { content } }] };
        },
      },
    },
  };
  return { client, calls };
}

const config: RunModelConfig = {
  models: {
    planner: 'anthropic/claude-opus-4-8',
    judge: 'google/gemini-flash',
    resolution: 'openai/gpt-4o-mini',
  },
  apiKey: 'sk-test',
};

describe('createOpenRouterModelClient', () => {
  it('maps role to the configured model', async () => {
    const { client, calls } = fakeClient('ok');
    const model = createOpenRouterModelClient(config, { client });

    await model.complete('planner', { prompt: 'plan it' });
    await model.complete('judge', { prompt: 'judge it' });

    expect(calls[0]?.model).toBe('anthropic/claude-opus-4-8');
    expect(calls[1]?.model).toBe('google/gemini-flash');
  });

  it('includes a system message only when provided', async () => {
    const { client, calls } = fakeClient('ok');
    const model = createOpenRouterModelClient(config, { client });

    await model.complete('planner', { prompt: 'no system' });
    expect(calls[0]?.messages).toEqual([{ role: 'user', content: 'no system' }]);

    await model.complete('planner', { prompt: 'with system', system: 'you are a planner' });
    expect(calls[1]?.messages).toEqual([
      { role: 'system', content: 'you are a planner' },
      { role: 'user', content: 'with system' },
    ]);
  });

  it('returns the choice content', async () => {
    const { client } = fakeClient('hello world');
    const model = createOpenRouterModelClient(config, { client });

    const res = await model.complete('planner', { prompt: 'hi' });
    expect(res.text).toBe('hello world');
  });

  it('throws on an empty completion (null content) rather than yielding "" [audit 2026-06-27 L8]', async () => {
    const { client } = fakeClient(null);
    const model = createOpenRouterModelClient(config, { client });

    await expect(model.complete('judge', { prompt: 'hi' })).rejects.toThrow(/empty completion/);
  });

  it('throws when no model is configured for the role', async () => {
    const { client } = fakeClient('ok');
    const partial: RunModelConfig = {
      models: { planner: 'anthropic/claude-opus-4-8' } as RunModelConfig['models'],
      apiKey: 'sk-test',
    };
    const model = createOpenRouterModelClient(partial, { client });

    await expect(model.complete('resolution', { prompt: 'hi' })).rejects.toThrow(
      'no model configured for role: resolution',
    );
  });
});
