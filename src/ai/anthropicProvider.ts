import Anthropic from '@anthropic-ai/sdk';
import type { AiProvider, AiRequest, AiResponse } from './aiProvider.js';

const MAX_OUTPUT_TOKENS = 8192;

export class AnthropicProvider implements AiProvider {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(model: string, apiKey?: string) {
    const key = apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error(
        'ANTHROPIC_API_KEY environment variable is not set. Export it before running `weave-tests generate`.',
      );
    }
    this.client = new Anthropic({ apiKey: key });
    this.model = model;
  }

  async generate(request: AiRequest): Promise<AiResponse> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: request.system,
      messages: [{ role: 'user', content: request.user }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    return { text };
  }
}
