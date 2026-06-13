import { promises as fs } from 'node:fs';
import fg from 'fast-glob';
import path from 'node:path';
import type { TestLocation } from './conventions.types.js';

/** Pick the directory under which application source code lives (default "src"). */
export async function detectSrcRootDir(repoRoot: string): Promise<string> {
  for (const candidate of ['src', 'app']) {
    try {
      const stat = await fs.stat(path.join(repoRoot, candidate));
      if (stat.isDirectory()) return candidate;
    } catch {
      // try next candidate
    }
  }
  return '.';
}

/**
 * Inspect existing test files to determine whether tests are co-located next
 * to source, grouped in `__tests__` folders, or live in a mirrored top-level
 * `tests/`/`test/` tree. Falls back to "colocated" when no tests exist yet.
 */
export async function detectTestLocation(
  repoRoot: string,
): Promise<{ testLocation: TestLocation; testsRootDir?: string }> {
  const allTestFiles = await fg(['**/*.{test,spec}.{ts,tsx}'], {
    cwd: repoRoot,
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
    onlyFiles: true,
  });

  if (allTestFiles.length === 0) {
    return { testLocation: 'colocated' };
  }

  let dunderCount = 0;
  let mirroredCount = 0;
  let colocatedCount = 0;
  let mirroredRoot: string | undefined;

  for (const file of allTestFiles) {
    const segments = file.split('/');
    if (segments.includes('__tests__')) {
      dunderCount++;
    } else if (segments[0] === 'tests' || segments[0] === 'test') {
      mirroredCount++;
      mirroredRoot = mirroredRoot ?? segments[0];
    } else {
      colocatedCount++;
    }
  }

  if (mirroredRoot && mirroredCount >= dunderCount && mirroredCount >= colocatedCount) {
    return { testLocation: 'mirrored', testsRootDir: mirroredRoot };
  }
  if (dunderCount >= colocatedCount) {
    return { testLocation: '__tests__' };
  }
  return { testLocation: 'colocated' };
}
