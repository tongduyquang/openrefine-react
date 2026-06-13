import { describe, it, expect } from 'vitest';
import { buildRunSummary } from '../../src/report/reportData.js';
import type { TaskResult } from '../../src/planner/planner.types.js';

function makeResult(overrides: Partial<TaskResult> = {}): TaskResult {
  return {
    id: 'src/components/Foo.tsx',
    mode: 'generate',
    status: 'pass',
    attempts: 1,
    written: true,
    outputPath: 'src/components/Foo.test.tsx',
    errors: [],
    ...overrides,
  };
}

describe('buildRunSummary', () => {
  it('computes totals correctly for a mix of modes and statuses', () => {
    const results: TaskResult[] = [
      makeResult({ id: 'a', mode: 'generate', status: 'pass' }),
      makeResult({ id: 'b', mode: 'generate', status: 'fail', errors: ['boom'] }),
      makeResult({ id: 'c', mode: 'fix', status: 'pass' }),
      makeResult({ id: 'd', mode: 'fix', status: 'skipped' }),
      makeResult({ id: 'e', mode: 'fix', status: 'fail', errors: ['oops'] }),
      makeResult({ id: 'f', mode: 'generate', status: 'skipped' }),
    ];

    const repoRoot = '/repo';
    const dryRun = false;
    const startedAt = new Date('2026-06-13T00:00:00.000Z').toISOString();

    const summary = buildRunSummary(repoRoot, dryRun, startedAt, results);

    expect(summary.totals.total).toBe(6);
    expect(summary.totals.pass).toBe(2);
    expect(summary.totals.fail).toBe(2);
    expect(summary.totals.skipped).toBe(2);
    expect(summary.totals.generated).toBe(3);
    expect(summary.totals.fixed).toBe(3);
  });

  it('passes through repoRoot, dryRun, startedAt, and results', () => {
    const results: TaskResult[] = [makeResult()];
    const repoRoot = '/some/repo/root';
    const dryRun = true;
    const startedAt = new Date('2026-01-01T12:00:00.000Z').toISOString();

    const summary = buildRunSummary(repoRoot, dryRun, startedAt, results);

    expect(summary.repoRoot).toBe(repoRoot);
    expect(summary.dryRun).toBe(dryRun);
    expect(summary.startedAt).toBe(startedAt);
    expect(summary.results).toBe(results);
  });

  it('produces a valid ISO finishedAt timestamp', () => {
    const summary = buildRunSummary('/repo', false, new Date().toISOString(), []);

    expect(new Date(summary.finishedAt).toString()).not.toBe('Invalid Date');
    expect(summary.finishedAt).toBe(new Date(summary.finishedAt).toISOString());
  });

  it('handles an empty results array', () => {
    const summary = buildRunSummary('/repo', false, new Date().toISOString(), []);

    expect(summary.totals).toEqual({
      total: 0,
      pass: 0,
      fail: 0,
      skipped: 0,
      generated: 0,
      fixed: 0,
    });
    expect(summary.results).toEqual([]);
  });
});
