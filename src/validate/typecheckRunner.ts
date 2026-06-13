import { findNearestTsConfig } from '../analyzer/tsProject.js';
import { VALIDATION_TIMEOUT_MS } from '../config/defaults.js';
import { runCommand } from '../utils/exec.js';

export interface TypecheckResult {
  success: boolean;
  output: string;
}

/** Run `tsc --noEmit` against the tsconfig nearest to `outputTestPath`. */
export async function runTypecheck(outputTestPath: string, repoRoot: string): Promise<TypecheckResult> {
  const tsConfigPath = await findNearestTsConfig(outputTestPath, repoRoot);
  if (!tsConfigPath) {
    return { success: true, output: '(no tsconfig.json found; skipping type check)' };
  }

  const result = await runCommand('npx', ['tsc', '--noEmit', '-p', tsConfigPath], {
    cwd: repoRoot,
    timeoutMs: VALIDATION_TIMEOUT_MS,
  });

  return {
    success: result.exitCode === 0,
    output: [result.stdout, result.stderr].filter(Boolean).join('\n'),
  };
}
