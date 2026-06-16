import type { AiProviderName } from '../config/defaults.js';
import type { AiProvider } from './aiProvider.js';
import { AnthropicProvider } from './anthropicProvider.js';
import { GitHubModelsProvider } from './githubModelsProvider.js';

/** Instantiate the AI backend selected by config (provider + model). */
export function createAiProvider(provider: AiProviderName, model: string): AiProvider {
  switch (provider) {
    case 'github':
      return new GitHubModelsProvider(model);
    case 'anthropic':
      return new AnthropicProvider(model);
    default: {
      const exhaustive: never = provider;
      throw new Error(`Unknown AI provider: ${String(exhaustive)}`);
    }
  }
}
