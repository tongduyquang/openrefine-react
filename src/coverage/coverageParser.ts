import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { CoverageInfo } from '../planner/planner.types.js';

interface SummaryEntry {
  lines?: { total: number; covered: number; pct: number };
}

interface FinalEntry {
  statementMap: Record<string, { start: { line: number }; end: { line: number } }>;
  s: Record<string, number>;
}

/** Map of absolute file path -> coverage info. */
export type CoverageMap = Map<string, CoverageInfo>;

function isSummaryEntry(value: unknown): value is SummaryEntry {
  return typeof value === 'object' && value !== null && 'lines' in value && !('statementMap' in value);
}

function isFinalEntry(value: unknown): value is FinalEntry {
  return typeof value === 'object' && value !== null && 'statementMap' in value && 's' in value;
}

/**
 * Parse an Istanbul/v8 `coverage-summary.json` or `coverage-final.json` (as
 * produced by `vitest run --coverage` / `jest --coverage`) into a map of
 * absolute file path -> { percent, uncoveredLines }.
 */
export async function parseCoverageReport(coveragePath: string, repoRoot: string): Promise<CoverageMap> {
  const raw = await fs.readFile(coveragePath, 'utf-8');
  const data = JSON.parse(raw) as Record<string, unknown>;

  const result: CoverageMap = new Map();

  for (const [key, value] of Object.entries(data)) {
    if (key === 'total') continue;
    const absPath = path.isAbsolute(key) ? key : path.resolve(repoRoot, key);

    if (isSummaryEntry(value)) {
      result.set(absPath, {
        percent: value.lines?.pct ?? 0,
        uncoveredLines: [],
      });
      continue;
    }

    if (isFinalEntry(value)) {
      const uncoveredLines: number[] = [];
      let total = 0;
      let covered = 0;
      for (const [stmtId, hits] of Object.entries(value.s)) {
        total++;
        if (hits > 0) {
          covered++;
        } else {
          const stmt = value.statementMap[stmtId];
          if (stmt) uncoveredLines.push(stmt.start.line);
        }
      }
      result.set(absPath, {
        percent: total === 0 ? 100 : Math.round((covered / total) * 10000) / 100,
        uncoveredLines: Array.from(new Set(uncoveredLines)).sort((a, b) => a - b),
      });
    }
  }

  return result;
}
