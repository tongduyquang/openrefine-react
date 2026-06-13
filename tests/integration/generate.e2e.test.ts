import { describe, it, expect, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runGenerate } from '../../src/commands/generate.js';
import { FakeAiProvider } from '../fixtures/fakeAiProvider.js';
import type { CliOptions } from '../../src/config/schema.js';
import type { RunManifest } from '../../src/planner/planner.types.js';
import type { RunSummary } from '../../src/report/reportData.js';
import { WEAVER_DIR, MANIFEST_FILE_NAME, REPORT_DIR_NAME } from '../../src/config/defaults.js';

const SAMPLE_APP_DIR = path.join(__dirname, '..', '..', 'examples', 'sample-app');

async function copySampleApp(): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'weaver-e2e-'));
  await fs.cp(SAMPLE_APP_DIR, tempDir, {
    recursive: true,
    filter: (src) => !src.includes('node_modules'),
  });
  return tempDir;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

describe('runGenerate (e2e)', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) {
        await fs.rm(dir, { recursive: true, force: true });
      }
    }
  });

  it(
    'writes generated test files, a manifest, and reports with skipValidation: true',
    async () => {
      const tempDir = await copySampleApp();
      tempDirs.push(tempDir);

      const fakeAi = new FakeAiProvider([
        '```tsx\nexport const placeholder = true;\n```',
        '```ts\nexport const placeholder2 = true;\n```',
        '```ts\nexport const placeholder3 = true;\n```',
      ]);

      await runGenerate(
        { repo: tempDir, skipValidation: true, json: true, quiet: true } as CliOptions,
        fakeAi,
      );

      const counterTestPath = path.join(tempDir, 'src', 'components', 'Counter.test.tsx');
      const useToggleTestPath = path.join(tempDir, 'src', 'hooks', 'useToggle.test.ts');
      const formatCurrencyTestPath = path.join(tempDir, 'src', 'utils', 'formatCurrency.test.ts');

      expect(await fileExists(counterTestPath)).toBe(true);
      expect(await fileExists(useToggleTestPath)).toBe(true);
      expect(await fileExists(formatCurrencyTestPath)).toBe(true);

      const counterContent = await fs.readFile(counterTestPath, 'utf-8');
      const useToggleContent = await fs.readFile(useToggleTestPath, 'utf-8');
      const formatCurrencyContent = await fs.readFile(formatCurrencyTestPath, 'utf-8');

      expect(counterContent).toContain('export const placeholder = true;');
      expect(useToggleContent).toContain('export const placeholder2 = true;');
      expect(formatCurrencyContent).toContain('export const placeholder3 = true;');

      // Greeting.tsx already has a colocated test and fixExisting defaults to false,
      // so it should not get a new/modified test file written.
      const greetingTestPath = path.join(tempDir, 'src', 'components', 'Greeting.test.tsx');
      const greetingContent = await fs.readFile(greetingTestPath, 'utf-8');
      expect(greetingContent).not.toContain('placeholder');

      const manifestPath = path.join(tempDir, WEAVER_DIR, MANIFEST_FILE_NAME);
      expect(await fileExists(manifestPath)).toBe(true);

      const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8')) as RunManifest;
      const resultKeys = Object.keys(manifest.results);
      expect(resultKeys).toHaveLength(3);
      expect(resultKeys).toEqual(
        expect.arrayContaining(['src/components/Counter.tsx', 'src/hooks/useToggle.ts', 'src/utils/formatCurrency.ts']),
      );

      for (const key of resultKeys) {
        const result = manifest.results[key]!;
        expect(result.status).toBe('pass');
        expect(result.attempts).toBe(1);
        expect(result.mode).toBe('generate');
        expect(result.written).toBe(true);
      }

      const reportsDir = path.join(tempDir, WEAVER_DIR, REPORT_DIR_NAME);
      const reportFiles = await fs.readdir(reportsDir);

      const mdReports = reportFiles.filter((f) => f.startsWith('run-') && f.endsWith('.md'));
      const jsonReports = reportFiles.filter((f) => f.startsWith('run-') && f.endsWith('.json'));

      expect(mdReports.length).toBeGreaterThanOrEqual(1);
      expect(jsonReports.length).toBeGreaterThanOrEqual(1);

      const summary = JSON.parse(await fs.readFile(path.join(reportsDir, jsonReports[0]!), 'utf-8')) as RunSummary;

      expect(summary.totals.total).toBe(3);
      expect(summary.totals.pass).toBe(3);
      expect(summary.totals.generated).toBe(3);
      expect(summary.totals.fixed).toBe(0);
      expect(summary.totals.fail).toBe(0);
    },
    30_000,
  );

  it(
    'dryRun: true does not write any test files or .weaver directory',
    async () => {
      const tempDir2 = await copySampleApp();
      tempDirs.push(tempDir2);

      const fakeAi2 = new FakeAiProvider([
        '```tsx\nexport const placeholder = true;\n```',
        '```ts\nexport const placeholder2 = true;\n```',
        '```ts\nexport const placeholder3 = true;\n```',
      ]);

      await runGenerate({ repo: tempDir2, dryRun: true, quiet: true } as CliOptions, fakeAi2);

      const counterTestPath = path.join(tempDir2, 'src', 'components', 'Counter.test.tsx');
      const useToggleTestPath = path.join(tempDir2, 'src', 'hooks', 'useToggle.test.ts');
      const formatCurrencyTestPath = path.join(tempDir2, 'src', 'utils', 'formatCurrency.test.ts');
      const weaverDir = path.join(tempDir2, WEAVER_DIR);

      expect(await fileExists(counterTestPath)).toBe(false);
      expect(await fileExists(useToggleTestPath)).toBe(false);
      expect(await fileExists(formatCurrencyTestPath)).toBe(false);
      expect(await fileExists(weaverDir)).toBe(false);
    },
    30_000,
  );

  it(
    'planOnly: true never calls the AI and writes no files',
    async () => {
      const tempDir3 = await copySampleApp();
      tempDirs.push(tempDir3);

      const fakeAi3 = new FakeAiProvider([]);

      await runGenerate({ repo: tempDir3, planOnly: true, json: true, quiet: true } as CliOptions, fakeAi3);

      expect(fakeAi3.callCount).toBe(0);

      const counterTestPath = path.join(tempDir3, 'src', 'components', 'Counter.test.tsx');
      const useToggleTestPath = path.join(tempDir3, 'src', 'hooks', 'useToggle.test.ts');
      const formatCurrencyTestPath = path.join(tempDir3, 'src', 'utils', 'formatCurrency.test.ts');
      const weaverDir = path.join(tempDir3, WEAVER_DIR);

      expect(await fileExists(counterTestPath)).toBe(false);
      expect(await fileExists(useToggleTestPath)).toBe(false);
      expect(await fileExists(formatCurrencyTestPath)).toBe(false);
      expect(await fileExists(weaverDir)).toBe(false);
    },
    30_000,
  );
});
