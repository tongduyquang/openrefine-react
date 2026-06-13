/** "Update an existing test file to match a changed source file" task section. */
export function buildFixTaskSection(relativeSourcePath: string, relativeOutputPath: string, existingTest: string): string {
  return [
    '## Task',
    'The source file below has changed and its existing test file needs to be updated to match.',
    `- Source file (relative to repo root): ${relativeSourcePath}`,
    `- Existing test file (to update, same path): ${relativeOutputPath}`,
    '',
    '### Existing test file',
    '```tsx',
    existingTest,
    '```',
    '',
    'Update the existing test file: fix any imports/usages that no longer match the current source,',
    'add tests for new behavior, and remove or update tests for removed/changed behavior. Preserve the',
    'existing structure and style where it still applies.',
  ].join('\n');
}
