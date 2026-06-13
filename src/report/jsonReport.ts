import type { RunSummary } from './reportData.js';

export function renderJsonReport(summary: RunSummary): string {
  return JSON.stringify(summary, null, 2);
}
