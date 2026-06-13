import fg from 'fast-glob';
import type { TestFileSuffix } from './conventions.types.js';

/** Detect whether existing tests use `.test.tsx` or `.spec.tsx`. Defaults to `.test`. */
export async function detectTestFileSuffix(repoRoot: string): Promise<TestFileSuffix> {
  const [testFiles, specFiles] = await Promise.all([
    fg(['**/*.test.{ts,tsx}'], { cwd: repoRoot, ignore: ['**/node_modules/**', '**/dist/**'], onlyFiles: true }),
    fg(['**/*.spec.{ts,tsx}'], { cwd: repoRoot, ignore: ['**/node_modules/**', '**/dist/**'], onlyFiles: true }),
  ]);

  return specFiles.length > testFiles.length ? '.spec' : '.test';
}
