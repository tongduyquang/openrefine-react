import { describe, it, expect } from 'vitest';
import { renderJsonReport } from '../../src/report/jsonReport.js';
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

describe('renderJsonReport', () => {
  it('returns a pretty-printed JSON.stringify of the summary', () => {
    const summary = buildRunSummary('/repo', false, new Date().toISOString(), [makeResult()]);
    const json = renderJsonReport(summary);

    expect(json).toBe(JSON.stringify(summary, null, 2));
  });

  it('round-trips via JSON.parse to a deeply equal object', () => {
    const summary = buildRunSummary('/repo', true, new Date().toISOString(), [
      makeResult({ id: 'a', status: 'pass' }),
      makeResult({ id: 'b', mode: 'fix', status: 'fail', errors: ['oops'] }),
    ]);
    const json = renderJsonReport(summary);

    expect(JSON.parse(json)).toEqual(summary);
  });

  it('is pretty-printed (contains newlines and indentation)', () => {
    const summary = buildRunSummary('/repo', false, new Date().toISOString(), []);
    const json = renderJsonReport(summary);

    expect(json).toContain('\n');
    expect(json).toContain('  "repoRoot"');
  });
});
