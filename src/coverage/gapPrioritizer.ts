import type { CoverageInfo } from '../planner/planner.types.js';
import type { CoverageMap } from './coverageParser.js';

export interface FileWithCoverage {
  filePath: string;
  coverage?: CoverageInfo;
}

/**
 * Annotate files with coverage info, drop files already at/above
 * `threshold` (unless `fixExisting` is set, in which case nothing is
 * dropped), and order the rest by ascending coverage % — files with no
 * coverage data (untested) sort first.
 */
export function applyCoveragePrioritization(
  files: string[],
  coverageMap: CoverageMap,
  threshold: number,
  fixExisting: boolean,
): FileWithCoverage[] {
  const annotated: FileWithCoverage[] = files.map((filePath) => ({
    filePath,
    coverage: coverageMap.get(filePath),
  }));

  const filtered = fixExisting
    ? annotated
    : annotated.filter((f) => !f.coverage || f.coverage.percent < threshold);

  return filtered.sort((a, b) => {
    const pa = a.coverage?.percent ?? -1;
    const pb = b.coverage?.percent ?? -1;
    return pa - pb;
  });
}
