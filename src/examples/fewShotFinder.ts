import { promises as fs } from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';
import type { FileAnalysis } from '../analyzer/analyzer.types.js';
import type { ProjectConventions } from '../conventions/conventions.types.js';
import { relativePosix, stripExt } from '../utils/paths.js';

type Category = 'component' | 'hook' | 'util';

function categorizeByPath(filePath: string): Category {
  const base = stripExt(path.basename(filePath));
  if (/^use[A-Z0-9]/.test(base)) return 'hook';
  if (/^[A-Z]/.test(base) && filePath.endsWith('.tsx')) return 'component';
  return 'util';
}

function categorizeAnalysis(analysis: FileAnalysis): Category {
  if (analysis.components.length > 0) return 'component';
  if (analysis.hooks.length > 0) return 'hook';
  return 'util';
}

/** Best-effort: derive the source file a test file is testing, given the detected conventions. */
function inferSourceFileForTest(testFile: string, repoRoot: string, conventions: ProjectConventions): string {
  const ext = path.extname(testFile);
  const base = stripExt(path.basename(testFile)).replace(/\.(test|spec)$/, '');
  let dir = path.dirname(testFile);

  if (path.basename(dir) === '__tests__') {
    dir = path.dirname(dir);
  } else if (conventions.testsRootDir) {
    const testsRoot = path.join(repoRoot, conventions.testsRootDir);
    const rel = path.relative(testsRoot, dir);
    if (!rel.startsWith('..')) {
      dir = path.join(repoRoot, conventions.srcRootDir, rel);
    }
  }

  return path.join(dir, `${base}${ext}`);
}

export interface FewShotExample {
  relativePath: string;
  content: string;
}

/**
 * Find an existing test file whose subject (component/hook/util, same
 * extension, ideally same directory) is most similar to `analysis`, to give
 * the AI a concrete style reference matching this repo's conventions.
 */
export async function findFewShotExample(
  analysis: FileAnalysis,
  repoRoot: string,
  conventions: ProjectConventions,
): Promise<FewShotExample | undefined> {
  const testFiles = await fg(['**/*.{test,spec}.{ts,tsx}'], {
    cwd: repoRoot,
    absolute: true,
    onlyFiles: true,
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
  });

  if (testFiles.length === 0) return undefined;

  const targetExt = path.extname(analysis.filePath);
  const targetCategory = categorizeAnalysis(analysis);
  const targetDir = path.dirname(analysis.filePath);

  const scored = testFiles
    .map((testFile) => {
      const sourceCandidate = inferSourceFileForTest(testFile, repoRoot, conventions);
      let score = 0;
      if (path.extname(sourceCandidate) === targetExt) score += 3;
      if (categorizeByPath(sourceCandidate) === targetCategory) score += 3;
      if (path.dirname(sourceCandidate) === targetDir) score += 1;
      return { testFile, score };
    })
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best) return undefined;

  try {
    const content = await fs.readFile(best.testFile, 'utf-8');
    return { relativePath: relativePosix(repoRoot, best.testFile), content };
  } catch {
    return undefined;
  }
}
