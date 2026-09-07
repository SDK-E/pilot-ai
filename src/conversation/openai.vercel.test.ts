import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const generate = vi.fn();
  const close = vi.fn();
  const verifyRequest = vi.fn();

  return {
    generate,
    close,
    verifyRequest,
    createRuntime: vi.fn(() => ({ generate, close })),
  };
});

vi.mock('./pilot-conversation.js', () => ({
  createPilotConversationRuntime: mocks.createRuntime,
}));

vi.mock('../runtime/auth/vercel-oidc.js', () => ({
  verifyPilotRuntimeRequest: mocks.verifyRequest,
}));

import handler from '../../api/v1/chat/completions';

const headers = {
  'content-type': 'application/json',
  'x-pilot-organization-id': 'org-preview',
  'x-pilot-worker-id': '6f96e48d-c27a-4b4b-ab63-e406f69132ce',
  'x-pilot-conversation-id': '2e61a6d9-0b48-4e17-8e0e-97075112953d',
};

describe('OpenAI-compatible Pilot Conversation function', () => {
  beforeEach(() => {
    vi.stubEnv('PILOT_MASTRA_DATABASE_URL', 'libsql://runtime.turso.io');
    vi.stubEnv('TURSO_AUTH_TOKEN', 'runtime-token');
    mocks.generate.mockReset();
    mocks.close.mockReset();
    mocks.createRuntime.mockClear();
    mocks.verifyRequest.mockReset();
    mocks.verifyRequest.mockResolvedValue(true);
  });

  afterEach(() => vi.unstubAllEnvs());

  it('returns an OpenAI chat completion for a verified Pilot request', async () => {
    mocks.generate.mockResolvedValue({
      text: 'Hello.',
      finishReason: 'stop',
      modelId: 'kilo/kilo-auto/free',
      runId: 'run-123',
      usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 },
    });

    const response = await handler.fetch(new Request('https://ai.pilot.test/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'kilo/kilo-auto/free',
        messages: [
          { role: 'system', content: 'Be helpful.' },
          { role: 'user', content: 'Hello.' },
        ],
        stream: false,
      }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: 'chatcmpl_run-123',
      object: 'chat.completion',
      model: 'kilo/kilo-auto/free',
      choices: [{
        index: 0,
        message: { role: 'assistant', content: 'Hello.', refusal: null },
        finish_reason: 'stop',
      }],
      usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
    });
    expect(mocks.generate).toHaveBeenCalledWith({
      organizationId: 'org-preview',
      worker: {
        id: '6f96e48d-c27a-4b4b-ab63-e406f69132ce',
        instructions: 'Be helpful.',
        modelId: 'kilo/kilo-auto/free',
      },
      conversationId: '2e61a6d9-0b48-4e17-8e0e-97075112953d',
      message: 'Hello.',
      allowedToolIds: [],
    });
  });

  it('rejects requests without a valid Vercel OIDC token before initialization', async () => {
    mocks.verifyRequest.mockResolvedValue(false);

    const response = await handler.fetch(new Request('https://ai.pilot.test/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'kilo/kilo-auto/free',
        messages: [{ role: 'user', content: 'Hello.' }],
      }),
    }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: { message: 'Unauthorized.', type: 'authentication_error' },
    });
    expect(mocks.createRuntime).not.toHaveBeenCalled();
  });
});
