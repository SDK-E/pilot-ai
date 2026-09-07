import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const generate = vi.fn();
  const close = vi.fn();

  return {
    generate,
    close,
    createRuntime: vi.fn(() => ({ generate, close })),
  };
});

vi.mock('../pilot-conversation', () => ({
  createPilotConversationRuntime: mocks.createRuntime,
}));

import handler from '../../../api/pilot/conversations/generate';

describe('Pilot Conversation Vercel function', () => {
  beforeEach(() => {
    vi.stubEnv('PILOT_MASTRA_DATABASE_URL', 'postgres://runtime');
    mocks.generate.mockReset();
    mocks.close.mockReset();
    mocks.createRuntime.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('accepts a valid POST command and closes its runtime', async () => {
    mocks.generate.mockResolvedValue({ text: 'Hello.' });
    const request = new Request('https://pilot.example/pilot/conversations/generate', {
      method: 'POST',
      body: JSON.stringify({ message: 'Hello.' }),
    });

    const response = await handler.fetch(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ text: 'Hello.' });
    expect(mocks.createRuntime).toHaveBeenCalledWith('postgres://runtime');
    expect(mocks.generate).toHaveBeenCalledWith({ message: 'Hello.' });
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it('rejects non-POST requests', async () => {
    const response = await handler.fetch(
      new Request('https://pilot.example/pilot/conversations/generate'),
    );

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
    expect(mocks.createRuntime).not.toHaveBeenCalled();
  });

  it('does not initialize without configured storage', async () => {
    vi.stubEnv('PILOT_MASTRA_DATABASE_URL', '');

    const response = await handler.fetch(
      new Request('https://pilot.example/pilot/conversations/generate', {
        method: 'POST',
        body: JSON.stringify({ message: 'Hello.' }),
      }),
    );

    expect(response.status).toBe(503);
    expect(mocks.createRuntime).not.toHaveBeenCalled();
  });
});
