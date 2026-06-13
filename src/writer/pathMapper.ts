import path from 'node:path';
import type { ProjectConventions } from '../conventions/conventions.types.js';
import { stripExt } from '../utils/paths.js';

/**
 * Compute the absolute output path for a generated/updated test file,
 * mirroring `sourceFile`'s location according to the detected/configured
 * conventions:
 *  - colocated: next to the source file
 *  - __tests__: in a sibling `__tests__/` directory
 *  - mirrored:  same relative path under a top-level `tests/`-style root
 */
export function computeOutputTestPath(sourceFile: string, repoRoot: string, conventions: ProjectConventions): string {
  const dir = path.dirname(sourceFile);
  const base = stripExt(path.basename(sourceFile));
  const ext = path.extname(sourceFile);
  const suffix = conventions.testFileSuffix;

  switch (conventions.testLocation) {
    case '__tests__':
      return path.join(dir, '__tests__', `${base}${suffix}${ext}`);
    case 'mirrored': {
      const srcRoot = path.join(repoRoot, conventions.srcRootDir);
      const relFromSrcRoot = path.relative(srcRoot, dir);
      const testsRoot = conventions.testsRootDir ?? 'tests';
      return path.join(repoRoot, testsRoot, relFromSrcRoot, `${base}${suffix}${ext}`);
    }
    case 'colocated':
    default:
      return path.join(dir, `${base}${suffix}${ext}`);
  }
}
