const FENCE_RE = /```(?:tsx|ts|typescript|jsx|js)?\r?\n([\s\S]*?)```/g;

/**
 * Extract test file source code from an AI response. Picks the largest
 * fenced code block (handles the rare case of multiple/explanatory blocks
 * despite the system prompt's "one block, no prose" instruction). Falls back
 * to the raw trimmed response if no fenced block is found.
 */
export function extractCode(responseText: string): string {
  const matches = [...responseText.matchAll(FENCE_RE)];
  if (matches.length > 0) {
    let best = matches[0]?.[1] ?? '';
    for (const match of matches) {
      const candidate = match[1] ?? '';
      if (candidate.length > best.length) best = candidate;
    }
    return best.trim();
  }
  return responseText.trim();
}
