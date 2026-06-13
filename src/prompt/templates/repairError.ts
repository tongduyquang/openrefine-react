/** Repair-iteration section: previous attempt + tsc/test-runner error output. */
export function buildRepairSection(previousAttempt: string, errorOutput: string, attemptNumber: number): string {
  return [
    `## Repair attempt ${attemptNumber}`,
    'The test file you previously generated failed type-checking and/or failed when run. Fix it.',
    '',
    '### Previous test file content',
    '```tsx',
    previousAttempt,
    '```',
    '',
    '### Error output (type checker / test runner)',
    '```',
    errorOutput,
    '```',
    '',
    'Return the complete corrected test file using the same output contract (exactly one fenced code block, no prose).',
  ].join('\n');
}
