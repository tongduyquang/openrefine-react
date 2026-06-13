/** "Generate a new test file" task section. */
export function buildGenerateTaskSection(relativeSourcePath: string, relativeOutputPath: string): string {
  return [
    '## Task',
    'Generate a new test file for the source file described below.',
    `- Source file (relative to repo root): ${relativeSourcePath}`,
    `- The test file you write will be saved at: ${relativeOutputPath}`,
    '- Import the subject under test using an import path appropriate for that output location.',
  ].join('\n');
}
