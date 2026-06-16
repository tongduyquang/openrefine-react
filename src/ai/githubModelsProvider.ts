import type { AiProvider, AiRequest, AiResponse } from './aiProvider.js';

/** OpenAI-compatible chat completions endpoint for the GitHub Models API. */
const DEFAULT_BASE_URL = 'https://models.github.ai/inference';
const MAX_OUTPUT_TOKENS = 8192;

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string; code?: string };
}

export interface GitHubModelsOptions {
  /** Token override; defaults to GITHUB_MODELS_TOKEN, then GITHUB_TOKEN, from env. */
  token?: string;
  /** Base URL override; defaults to GITHUB_MODELS_BASE_URL env, then the public endpoint. */
  baseUrl?: string;
  maxOutputTokens?: number;
}

/**
 * AiProvider backed by the GitHub Models API (https://models.github.ai), an
 * OpenAI-compatible chat completions endpoint. Authenticated with a GitHub
 * token that has the `models: read` permission. Uses Node's global `fetch`
 * (Node >= 20), so no extra SDK dependency is needed.
 */
export class GitHubModelsProvider implements AiProvider {
  private readonly token: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly maxOutputTokens: number;

  constructor(model: string, options: GitHubModelsOptions = {}) {
    const token = options.token ?? process.env.GITHUB_MODELS_TOKEN ?? process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error(
        'No GitHub token found. Set GITHUB_MODELS_TOKEN (or GITHUB_TOKEN) to a token with the ' +
          '`models: read` permission before running `weave-tests generate --provider github`.',
      );
    }
    this.token = token;
    this.model = model;
    this.baseUrl = (options.baseUrl ?? process.env.GITHUB_MODELS_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.maxOutputTokens = options.maxOutputTokens ?? MAX_OUTPUT_TOKENS;
  }

  async generate(request: AiRequest): Promise<AiResponse> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: request.system },
          { role: 'user', content: request.user },
        ],
        temperature: 0.2,
        max_tokens: this.maxOutputTokens,
      }),
    });

    if (!response.ok) {
      const detail = await readErrorDetail(response);
      throw new Error(
        `GitHub Models API request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ''}`,
      );
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const text = data.choices?.[0]?.message?.content ?? '';
    return { text };
  }
}

async function readErrorDetail(response: Response): Promise<string> {
  try {
    const body = await response.text();
    try {
      const json = JSON.parse(body) as ChatCompletionResponse;
      return json.error?.message ?? body.slice(0, 500);
    } catch {
      return body.slice(0, 500);
    }
  } catch {
    return '';
  }
}
