import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ProjectConventions } from '../conventions/conventions.types.js';
import { stripExt } from '../utils/paths.js';

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Locate an existing test file for `sourceFile`, checking the detected
 * suffix/location convention first, then falling back to the other common
 * suffix (.test/.spec) and locations — covers repos with mixed conventions.
 */
export async function findExistingTestFile(
  sourceFile: string,
  conventions: ProjectConventions,
  repoRoot: string,
): Promise<string | undefined> {
  const dir = path.dirname(sourceFile);
  const base = stripExt(path.basename(sourceFile));
  const ext = path.extname(sourceFile);
  const suffixes: Array<'.test' | '.spec'> =
    conventions.testFileSuffix === '.test' ? ['.test', '.spec'] : ['.spec', '.test'];

  const candidates: string[] = [];

  for (const suffix of suffixes) {
    candidates.push(path.join(dir, `${base}${suffix}${ext}`));
    candidates.push(path.join(dir, '__tests__', `${base}${suffix}${ext}`));
  }

  if (conventions.testsRootDir) {
    const srcRoot = path.join(repoRoot, conventions.srcRootDir);
    const relFromSrcRoot = path.relative(srcRoot, dir);
    for (const suffix of suffixes) {
      candidates.push(path.join(repoRoot, conventions.testsRootDir, relFromSrcRoot, `${base}${suffix}${ext}`));
    }
  }

  for (const candidate of candidates) {
    if (await exists(candidate)) {
      return candidate;
    }
  }
  return undefined;
}
