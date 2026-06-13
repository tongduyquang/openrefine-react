import { describe, it, expect } from 'vitest';
import { renderMarkdownReport } from '../../src/report/markdownReport.js';
import { buildRunSummary } from '../../src/report/reportData.js';
import type { RunSummary } from '../../src/report/reportData.js';
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

describe('renderMarkdownReport', () => {
  it('contains the header, repo path, dry-run status, and summary counts', () => {
    const summary = buildRunSummary('/repo/root', true, new Date().toISOString(), []);
    const md = renderMarkdownReport(summary);

    expect(md).toContain('# weave-tests run report');
    expect(md).toContain('/repo/root');
    expect(md).toContain('Dry run: yes');
    expect(md).toContain('## Summary');
    expect(md).toContain(`- Total tasks: ${summary.totals.total}`);
    expect(md).toContain(`- Generated (new tests): ${summary.totals.generated}`);
    expect(md).toContain(`- Fixed (existing tests updated): ${summary.totals.fixed}`);
    expect(md).toContain(`- Passed validation: ${summary.totals.pass}`);
    expect(md).toContain(`- Failed validation: ${summary.totals.fail}`);
    expect(md).toContain(`- Skipped: ${summary.totals.skipped}`);
  });

  it('shows "Dry run: no" when dryRun is false', () => {
    const summary = buildRunSummary('/repo/root', false, new Date().toISOString(), []);
    const md = renderMarkdownReport(summary);

    expect(md).toContain('Dry run: no');
  });

  it('includes the "## Tasks" table with a row for each result', () => {
    const result = makeResult({ id: 'src/components/Foo.tsx', mode: 'generate', status: 'pass', attempts: 2, outputPath: 'src/components/Foo.test.tsx' });
    const summary = buildRunSummary('/repo', false, new Date().toISOString(), [result]);
    const md = renderMarkdownReport(summary);

    expect(md).toContain('## Tasks');
    expect(md).toContain('| Source file | Mode | Status | Attempts | Output |');
    expect(md).toContain(`| ${result.id} | ${result.mode} | ${result.status} | ${result.attempts} | ${result.outputPath} |`);
  });

  it('includes a "## Failures" section with the LAST error for failed results', () => {
    const result = makeResult({
      id: 'src/components/Bar.tsx',
      mode: 'fix',
      status: 'fail',
      attempts: 3,
      outputPath: 'src/components/Bar.test.tsx',
      errors: ['first error', 'second error', 'last error'],
    });
    const summary = buildRunSummary('/repo', false, new Date().toISOString(), [result]);
    const md = renderMarkdownReport(summary);

    expect(md).toContain('## Failures');
    expect(md).toContain(`### ${result.id}`);
    expect(md).toContain('last error');
    expect(md).not.toContain('first error');
    expect(md).not.toContain('second error');

    // Ensure it's inside a fenced code block.
    const failuresIdx = md.indexOf('## Failures');
    const failuresSection = md.slice(failuresIdx);
    expect(failuresSection).toMatch(/```\nlast error\n```/);
  });

  it('omits "## Tasks" and "## Failures" sections with zero results', () => {
    const summary = buildRunSummary('/repo', false, new Date().toISOString(), []);
    const md = renderMarkdownReport(summary);

    expect(md).not.toContain('## Tasks');
    expect(md).not.toContain('## Failures');
  });

  it('omits "## Failures" when a result fails but has no errors', () => {
    const result = makeResult({ status: 'fail', errors: [] });
    const summary = buildRunSummary('/repo', false, new Date().toISOString(), [result]);
    const md = renderMarkdownReport(summary);

    expect(md).toContain('## Tasks');
    expect(md).not.toContain('## Failures');
  });
});
