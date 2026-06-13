import { GIT_TIMEOUT_MS } from '../config/defaults.js';
import { runCommand } from '../utils/exec.js';

/**
 * Returns repo-relative paths of files added/changed/modified/renamed
 * between `base` and the current working tree.
 *
 * Tries `git diff base...HEAD` first (merge-base diff, ideal for PR/CI use),
 * then falls back to `git diff base` (direct comparison, works for local
 * branches/refs not reachable via three-dot syntax, including uncommitted changes).
 */
export async function getChangedFiles(repoRoot: string, base: string): Promise<string[]> {
  const tripleDot = await runCommand('git', ['diff', '--name-only', '--diff-filter=ACMR', `${base}...HEAD`], {
    cwd: repoRoot,
    timeoutMs: GIT_TIMEOUT_MS,
  });

  if (tripleDot.exitCode === 0) {
    return tripleDot.stdout.split('\n').filter(Boolean);
  }

  const direct = await runCommand('git', ['diff', '--name-only', '--diff-filter=ACMR', base], {
    cwd: repoRoot,
    timeoutMs: GIT_TIMEOUT_MS,
  });

  if (direct.exitCode !== 0) {
    throw new Error(`git diff against "${base}" failed: ${direct.stderr || tripleDot.stderr}`);
  }

  return direct.stdout.split('\n').filter(Boolean);
}
