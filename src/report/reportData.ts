import type { TaskResult } from '../planner/planner.types.js';

export interface RunSummary {
  startedAt: string;
  finishedAt: string;
  repoRoot: string;
  dryRun: boolean;
  results: TaskResult[];
  totals: {
    total: number;
    pass: number;
    fail: number;
    skipped: number;
    generated: number;
    fixed: number;
  };
}

export function buildRunSummary(repoRoot: string, dryRun: boolean, startedAt: string, results: TaskResult[]): RunSummary {
  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    repoRoot,
    dryRun,
    results,
    totals: {
      total: results.length,
      pass: results.filter((r) => r.status === 'pass').length,
      fail: results.filter((r) => r.status === 'fail').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      generated: results.filter((r) => r.mode === 'generate').length,
      fixed: results.filter((r) => r.mode === 'fix').length,
    },
  };
}
