import { describe, it, expect } from 'vitest';
import type { CoverageMap } from '../../src/coverage/coverageParser.js';
import { applyCoveragePrioritization } from '../../src/coverage/gapPrioritizer.js';

describe('applyCoveragePrioritization', () => {
  it('treats files with no coverage entry as -1% and sorts them first', () => {
    const files = ['/repo/src/Covered.ts', '/repo/src/Untested.ts'];
    const coverageMap: CoverageMap = new Map([
      ['/repo/src/Covered.ts', { percent: 50, uncoveredLines: [1, 2] }],
    ]);

    const result = applyCoveragePrioritization(files, coverageMap, 80, false);

    expect(result.map((f) => f.filePath)).toEqual(['/repo/src/Untested.ts', '/repo/src/Covered.ts']);
    expect(result[0]?.coverage).toBeUndefined();
    expect(result[1]?.coverage).toEqual({ percent: 50, uncoveredLines: [1, 2] });
  });

  it('drops files at/above threshold and keeps files below it when fixExisting is false', () => {
    const files = ['/repo/src/Low.ts', '/repo/src/High.ts', '/repo/src/Exact.ts'];
    const coverageMap: CoverageMap = new Map([
      ['/repo/src/Low.ts', { percent: 50, uncoveredLines: [] }],
      ['/repo/src/High.ts', { percent: 90, uncoveredLines: [] }],
      ['/repo/src/Exact.ts', { percent: 80, uncoveredLines: [] }],
    ]);

    const result = applyCoveragePrioritization(files, coverageMap, 80, false);

    expect(result.map((f) => f.filePath)).toEqual(['/repo/src/Low.ts']);
  });

  it('keeps every file (drops nothing) when fixExisting is true', () => {
    const files = ['/repo/src/Low.ts', '/repo/src/High.ts', '/repo/src/Untested.ts'];
    const coverageMap: CoverageMap = new Map([
      ['/repo/src/Low.ts', { percent: 50, uncoveredLines: [] }],
      ['/repo/src/High.ts', { percent: 90, uncoveredLines: [] }],
    ]);

    const result = applyCoveragePrioritization(files, coverageMap, 80, true);

    expect(result).toHaveLength(3);
    expect(result.map((f) => f.filePath)).toEqual(['/repo/src/Untested.ts', '/repo/src/Low.ts', '/repo/src/High.ts']);
  });

  it('sorts results ascending by coverage percent', () => {
    const files = ['/repo/src/A.ts', '/repo/src/B.ts', '/repo/src/C.ts', '/repo/src/D.ts'];
    const coverageMap: CoverageMap = new Map([
      ['/repo/src/A.ts', { percent: 70, uncoveredLines: [] }],
      ['/repo/src/B.ts', { percent: 10, uncoveredLines: [] }],
      ['/repo/src/C.ts', { percent: 40, uncoveredLines: [] }],
      // D.ts has no entry -> treated as -1, sorts first.
    ]);

    const result = applyCoveragePrioritization(files, coverageMap, 80, true);

    expect(result.map((f) => f.filePath)).toEqual([
      '/repo/src/D.ts',
      '/repo/src/B.ts',
      '/repo/src/C.ts',
      '/repo/src/A.ts',
    ]);
  });
});
