import path from 'node:path';
import fg from 'fast-glob';
import type { WeaverConfig } from '../config/schema.js';
import { getChangedFiles } from './gitDiffScanner.js';

const TS_SOURCE_RE = /\.tsx?$/;
const TEST_FILE_RE = /\.(test|spec)\.tsx?$/;

/**
 * Discover candidate source files (absolute paths) for a run, in this
 * priority order:
 *  1. Explicit `--file` targets
 *  2. `--git-diff <base>` changed files (filtered to non-test .ts/.tsx)
 *  3. include/exclude glob scan from the repo root
 *
 * Results are deduplicated, sorted for stable ordering, and capped by
 * `config.maxFiles` if set.
 */
export async function discoverSourceFiles(config: WeaverConfig): Promise<string[]> {
  let files: string[];

  if (config.targetFiles && config.targetFiles.length > 0) {
    files = config.targetFiles;
  } else if (config.gitDiffBase) {
    const changed = await getChangedFiles(config.repoRoot, config.gitDiffBase);
    files = changed
      .filter((f) => TS_SOURCE_RE.test(f) && !TEST_FILE_RE.test(f))
      .map((f) => path.join(config.repoRoot, f));
  } else {
    files = await fg(config.include, {
      cwd: config.repoRoot,
      ignore: config.exclude,
      absolute: true,
      onlyFiles: true,
      dot: false,
    });
  }

  const unique = Array.from(new Set(files.map((f) => path.resolve(f)))).sort();

  if (config.maxFiles && config.maxFiles > 0 && unique.length > config.maxFiles) {
    return unique.slice(0, config.maxFiles);
  }
  return unique;
}
