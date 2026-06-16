import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAiProvider } from '../../src/ai/createProvider.js';
import { AnthropicProvider } from '../../src/ai/anthropicProvider.js';
import { GitHubModelsProvider } from '../../src/ai/githubModelsProvider.js';

describe('createAiProvider', () => {
  beforeEach(() => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-anthropic-key');
    vi.stubEnv('GITHUB_MODELS_TOKEN', 'test-github-token');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('creates an AnthropicProvider for the "anthropic" provider', () => {
    const provider = createAiProvider('anthropic', 'claude-sonnet-4-6');
    expect(provider).toBeInstanceOf(AnthropicProvider);
  });

  it('creates a GitHubModelsProvider for the "github" provider', () => {
    const provider = createAiProvider('github', 'openai/gpt-4o');
    expect(provider).toBeInstanceOf(GitHubModelsProvider);
  });
});
