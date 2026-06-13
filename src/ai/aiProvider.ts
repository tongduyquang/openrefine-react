export interface AiRequest {
  system: string;
  user: string;
}

export interface AiResponse {
  text: string;
}

/**
 * Minimal seam for AI backends. The Anthropic implementation is the only one
 * shipped today; tests inject a fake implementation with canned responses.
 */
export interface AiProvider {
  generate(request: AiRequest): Promise<AiResponse>;
}
