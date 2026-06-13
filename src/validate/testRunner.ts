import { VALIDATION_TIMEOUT_MS } from '../config/defaults.js';
import type { ProjectConventions } from '../conventions/conventions.types.js';
import { relativePosix } from '../utils/paths.js';
import { runCommand } from '../utils/exec.js';

export interface TestRunResult {
  success: boolean;
  output: string;
}

/** Run the project's test runner (vitest/jest) scoped to a single test file. */
export async function runTestFile(
  outputTestPath: string,
  repoRoot: string,
  conventions: ProjectConventions,
): Promise<TestRunResult> {
  const relPath = relativePosix(repoRoot, outputTestPath);
  const [command, ...args] = conventions.testCommand;
  if (!command) {
    return { success: true, output: '(no test command configured; skipping)' };
  }

  const result = await runCommand(command, [...args, relPath], {
    cwd: repoRoot,
    timeoutMs: VALIDATION_TIMEOUT_MS,
  });

  return {
    success: result.exitCode === 0,
    output: [result.stdout, result.stderr].filter(Boolean).join('\n'),
  };
}
