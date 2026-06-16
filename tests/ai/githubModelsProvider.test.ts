import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHubModelsProvider } from '../../src/ai/githubModelsProvider.js';

function okResponse(content: string | null): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({ choices: [{ message: { content } }] }),
  } as unknown as Response;
}

describe('GitHubModelsProvider', () => {
  beforeEach(() => {
    // Ensure ambient GitHub tokens/base-url in the environment don't leak into tests.
    vi.stubEnv('GITHUB_MODELS_TOKEN', undefined as unknown as string);
    vi.stubEnv('GITHUB_TOKEN', undefined as unknown as string);
    vi.stubEnv('GITHUB_MODELS_BASE_URL', undefined as unknown as string);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('throws if no token is available', () => {
    expect(() => new GitHubModelsProvider('openai/gpt-4o')).toThrowError(/GITHUB_MODELS_TOKEN|GITHUB_TOKEN/);
  });

  it('sends an OpenAI-compatible chat completion request and parses the reply', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse('generated test'));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new GitHubModelsProvider('openai/gpt-4o', { token: 'test-token' });
    const result = await provider.generate({ system: 'SYSTEM', user: 'USER' });

    expect(result.text).toBe('generated test');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://models.github.ai/inference/chat/completions');
    expect(init.method).toBe('POST');

    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-token');
    expect(headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('openai/gpt-4o');
    expect(body.messages).toEqual([
      { role: 'system', content: 'SYSTEM' },
      { role: 'user', content: 'USER' },
    ]);
    expect(typeof body.max_tokens).toBe('number');
  });

  it('reads the token from GITHUB_MODELS_TOKEN, then GITHUB_TOKEN', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse('ok'));
    vi.stubGlobal('fetch', fetchMock);

    vi.stubEnv('GITHUB_TOKEN', 'from-github-token');
    const provider = new GitHubModelsProvider('openai/gpt-4o');
    await provider.generate({ system: 's', user: 'u' });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer from-github-token');
  });

  it('honors a custom base URL and strips trailing slashes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse('ok'));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new GitHubModelsProvider('openai/gpt-4o', {
      token: 'test-token',
      baseUrl: 'https://models.inference.ai.azure.com/',
    });
    await provider.generate({ system: 's', user: 'u' });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('https://models.inference.ai.azure.com/chat/completions');
  });

  it('returns an empty string when the response has no content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(null)));
    const provider = new GitHubModelsProvider('openai/gpt-4o', { token: 'test-token' });
    const result = await provider.generate({ system: 's', user: 'u' });
    expect(result.text).toBe('');
  });

  it('throws with status and error detail on a non-ok response', async () => {
    const errorResponse = {
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => JSON.stringify({ error: { message: 'Bad credentials' } }),
    } as unknown as Response;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errorResponse));

    const provider = new GitHubModelsProvider('openai/gpt-4o', { token: 'test-token' });
    await expect(provider.generate({ system: 's', user: 'u' })).rejects.toThrowError(/401.*Bad credentials/s);
  });
});
