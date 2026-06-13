import type { AiProvider, AiRequest, AiResponse } from '../../src/ai/aiProvider.js';

/**
 * Deterministic AiProvider for tests. Returns entries from `responses` in
 * order, repeating the last entry if `generate` is called more times than
 * there are responses. Records every request it receives for inspection.
 */
export class FakeAiProvider implements AiProvider {
  readonly requests: AiRequest[] = [];

  constructor(private readonly responses: string[]) {}

  async generate(request: AiRequest): Promise<AiResponse> {
    const index = Math.min(this.requests.length, this.responses.length - 1);
    this.requests.push(request);
    return { text: this.responses[index] ?? '' };
  }

  get callCount(): number {
    return this.requests.length;
  }
}
