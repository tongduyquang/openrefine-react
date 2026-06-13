import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseCoverageReport } from '../../src/coverage/coverageParser.js';

describe('parseCoverageReport', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'weaver-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function writeCoverageJson(content: unknown): Promise<string> {
    const file = path.join(tmpDir, 'coverage.json');
    await fs.writeFile(file, JSON.stringify(content), 'utf-8');
    return file;
  }

  it('parses a "summary" format report, resolving relative keys and skipping "total"', async () => {
    const absPath = path.join(tmpDir, 'src', 'Foo.ts');
    const coveragePath = await writeCoverageJson({
      total: {
        lines: { total: 100, covered: 50, pct: 50 },
      },
      'src/Foo.ts': {
        lines: { total: 10, covered: 8, pct: 80 },
      },
    });

    const result = await parseCoverageReport(coveragePath, tmpDir);

    expect(result.has('total')).toBe(false);
    expect(result.size).toBe(1);
    expect(result.get(absPath)).toEqual({ percent: 80, uncoveredLines: [] });
  });

  it('resolves an absolute-path key as-is', async () => {
    const absPath = path.join(tmpDir, 'src', 'Bar.ts');
    const coveragePath = await writeCoverageJson({
      [absPath]: {
        lines: { total: 4, covered: 4, pct: 100 },
      },
    });

    const result = await parseCoverageReport(coveragePath, tmpDir);

    expect(result.get(absPath)).toEqual({ percent: 100, uncoveredLines: [] });
  });

  it('parses a "final" format entry, computing percent and uncovered lines', async () => {
    const relPath = 'src/Baz.ts';
    const absPath = path.resolve(tmpDir, relPath);

    const coveragePath = await writeCoverageJson({
      [relPath]: {
        statementMap: {
          '0': { start: { line: 1 }, end: { line: 1 } },
          '1': { start: { line: 2 }, end: { line: 2 } },
          '2': { start: { line: 3 }, end: { line: 3 } },
          '3': { start: { line: 5 }, end: { line: 5 } },
        },
        s: {
          '0': 5,
          '1': 0,
          '2': 0,
          '3': 1,
        },
      },
    });

    const result = await parseCoverageReport(coveragePath, tmpDir);

    // 2 of 4 statements covered -> 50%
    expect(result.get(absPath)?.percent).toBe(50);
    expect(result.get(absPath)?.uncoveredLines).toEqual([2, 3]);
  });

  it('dedupes and sorts uncovered lines, and rounds percent to 2 decimals', async () => {
    const relPath = 'src/Qux.ts';
    const absPath = path.resolve(tmpDir, relPath);

    // 3 statements, 1 covered -> 1/3 = 33.33333...% -> rounded to 33.33
    // Two zero-hit statements map to the same line (5), should dedupe.
    const coveragePath = await writeCoverageJson({
      [relPath]: {
        statementMap: {
          '0': { start: { line: 1 }, end: { line: 1 } },
          '1': { start: { line: 5 }, end: { line: 5 } },
          '2': { start: { line: 5 }, end: { line: 6 } },
        },
        s: {
          '0': 1,
          '1': 0,
          '2': 0,
        },
      },
    });

    const result = await parseCoverageReport(coveragePath, tmpDir);

    expect(result.get(absPath)?.percent).toBe(33.33);
    expect(result.get(absPath)?.uncoveredLines).toEqual([5]);
  });

  it('returns 100 percent when a final-format entry has zero statements', async () => {
    const relPath = 'src/Empty.ts';
    const absPath = path.resolve(tmpDir, relPath);

    const coveragePath = await writeCoverageJson({
      [relPath]: {
        statementMap: {},
        s: {},
      },
    });

    const result = await parseCoverageReport(coveragePath, tmpDir);

    expect(result.get(absPath)).toEqual({ percent: 100, uncoveredLines: [] });
  });
});
