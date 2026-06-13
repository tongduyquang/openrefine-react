import path from 'node:path';
import { toImportSpecifier } from '../utils/paths.js';
import { getProjectForFile } from './tsProject.js';

export interface PathAlias {
  alias: string;
  targets: string[];
}

/**
 * Read `compilerOptions.paths` from the tsconfig governing `filePath`, for
 * informational use in prompts (e.g. "this project also has `@/` configured
 * as an alias for `src/`").
 */
export async function getConfiguredAliases(filePath: string, repoRoot: string): Promise<PathAlias[]> {
  const project = await getProjectForFile(filePath, repoRoot);
  const paths = project.getCompilerOptions().paths ?? {};
  return Object.entries(paths).map(([alias, targets]) => ({ alias, targets: [...(targets ?? [])] }));
}

/**
 * Compute the relative import specifier (posix, no extension) a test file at
 * `outputTestPath` should use to import `sourceFilePath` — accounts for the
 * test living in a different directory (e.g. `__tests__/` or a mirrored
 * `tests/` tree) than the source.
 */
export function getRelativeImportPath(outputTestPath: string, sourceFilePath: string): string {
  return toImportSpecifier(path.dirname(outputTestPath), sourceFilePath);
}
