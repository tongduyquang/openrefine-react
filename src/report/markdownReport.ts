import type { RunSummary } from './reportData.js';

export function renderMarkdownReport(summary: RunSummary): string {
  const lines: string[] = [];

  lines.push('# weave-tests run report');
  lines.push('');
  lines.push(`- Repo: \`${summary.repoRoot}\``);
  lines.push(`- Started: ${summary.startedAt}`);
  lines.push(`- Finished: ${summary.finishedAt}`);
  lines.push(`- Dry run: ${summary.dryRun ? 'yes' : 'no'}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Total tasks: ${summary.totals.total}`);
  lines.push(`- Generated (new tests): ${summary.totals.generated}`);
  lines.push(`- Fixed (existing tests updated): ${summary.totals.fixed}`);
  lines.push(`- Passed validation: ${summary.totals.pass}`);
  lines.push(`- Failed validation: ${summary.totals.fail}`);
  lines.push(`- Skipped: ${summary.totals.skipped}`);

  if (summary.results.length > 0) {
    lines.push('');
    lines.push('## Tasks');
    lines.push('');
    lines.push('| Source file | Mode | Status | Attempts | Output |');
    lines.push('| --- | --- | --- | --- | --- |');
    for (const r of summary.results) {
      lines.push(`| ${r.id} | ${r.mode} | ${r.status} | ${r.attempts} | ${r.outputPath} |`);
    }
  }

  const failed = summary.results.filter((r) => r.status === 'fail' && r.errors.length > 0);
  if (failed.length > 0) {
    lines.push('');
    lines.push('## Failures');
    for (const r of failed) {
      const lastError = r.errors[r.errors.length - 1] ?? '';
      lines.push('', `### ${r.id}`, '```', lastError, '```');
    }
  }

  return lines.join('\n');
}
