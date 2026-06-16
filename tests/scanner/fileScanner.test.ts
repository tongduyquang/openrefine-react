import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { WeaverConfig } from '../../src/config/schema.js';
import { DEFAULT_INCLUDE, DEFAULT_EXCLUDE } from '../../src/config/defaults.js';

vi.mock('../../src/scanner/gitDiffScanner.js', () => ({
  getChangedFiles: vi.fn(),
}));

import { discoverSourceFiles } from '../../src/scanner/fileScanner.js';
import { getChangedFiles } from '../../src/scanner/gitDiffScanner.js';

function baseConfig(repoRoot: string, overrides: Partial<WeaverConfig> = {}): WeaverConfig {
  return {
    repoRoot,
    include: DEFAULT_INCLUDE,
    exclude: DEFAULT_EXCLUDE,
    fixExisting: false,
    coverageThreshold: 80,
    dryRun: false,
    planOnly: false,
    fixLoopAttempts: 3,
    skipValidation: false,
    resume: false,
    provider: 'anthropic',
    model: 'test-model',
    reportDir: '.weaver/reports',
    json: false,
    logLevel: 'quiet',
    ...overrides,
  };
}

describe('discoverSourceFiles', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'weaver-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  async function writeFile(relPath: string, content = '// content\n'): Promise<void> {
    const full = path.join(tmpDir, relPath);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content, 'utf-8');
  }

  describe('default include/exclude', () => {
    beforeEach(async () => {
      await writeFile('src/components/Foo.tsx');
      await writeFile('src/components/Bar.ts');
      await writeFile('src/components/Foo.test.tsx');
      await writeFile('src/types.d.ts');
      await writeFile('src/utils/helper.ts');
    });

    it('returns only non-test, non-d.ts .ts/.tsx files under src/, as absolute sorted paths', async () => {
      const config = baseConfig(tmpDir);
      const result = await discoverSourceFiles(config);

      const expected = [
        path.resolve(tmpDir, 'src/components/Bar.ts'),
        path.resolve(tmpDir, 'src/components/Foo.tsx'),
        path.resolve(tmpDir, 'src/utils/helper.ts'),
      ].sort();

      expect(result).toEqual(expected);
      for (const f of result) {
        expect(path.isAbsolute(f)).toBe(true);
      }
    });

    it('caps the results when maxFiles is set', async () => {
      const config = baseConfig(tmpDir, { maxFiles: 2 });
      const result = await discoverSourceFiles(config);

      expect(result).toHaveLength(2);

      const full = await discoverSourceFiles(baseConfig(tmpDir));
      expect(result).toEqual(full.slice(0, 2));
    });

    it('does not cap results when maxFiles is 0', async () => {
      const config = baseConfig(tmpDir, { maxFiles: 0 });
      const result = await discoverSourceFiles(config);
      expect(result.length).toBeGreaterThan(2);
    });
  });

  describe('targetFiles', () => {
    it('returns exactly the target files, deduped and sorted, without include/exclude filtering', async () => {
      await writeFile('src/Foo.test.tsx');
      await writeFile('outside/Weird.txt');

      const fileA = path.join(tmpDir, 'src/Foo.test.tsx');
      const fileB = path.join(tmpDir, 'outside/Weird.txt');

      const config = baseConfig(tmpDir, {
        targetFiles: [fileB, fileA, fileA],
      });

      const result = await discoverSourceFiles(config);

      expect(result).toEqual([path.resolve(fileA), path.resolve(fileB)].sort());
    });

    it('caps targetFiles results when maxFiles is set', async () => {
      await writeFile('a.ts');
      await writeFile('b.ts');
      await writeFile('c.ts');

      const files = ['a.ts', 'b.ts', 'c.ts'].map((f) => path.join(tmpDir, f));

      const config = baseConfig(tmpDir, {
        targetFiles: files,
        maxFiles: 1,
      });

      const result = await discoverSourceFiles(config);
      expect(result).toHaveLength(1);
    });
  });

  describe('gitDiffBase', () => {
    it('keeps only non-test .ts/.tsx files from getChangedFiles, resolved to absolute paths', async () => {
      vi.mocked(getChangedFiles).mockResolvedValue([
        'src/components/Foo.tsx',
        'src/components/Foo.test.tsx',
        'README.md',
        'src/utils/helper.ts',
      ]);

      const config = baseConfig(tmpDir, { gitDiffBase: 'main' });
      const result = await discoverSourceFiles(config);

      expect(getChangedFiles).toHaveBeenCalledWith(tmpDir, 'main');

      const expected = [
        path.resolve(tmpDir, 'src/components/Foo.tsx'),
        path.resolve(tmpDir, 'src/utils/helper.ts'),
      ].sort();

      expect(result).toEqual(expected);
    });

    it('dedupes and sorts files returned via gitDiffBase', async () => {
      vi.mocked(getChangedFiles).mockResolvedValue([
        'src/b.ts',
        'src/a.ts',
        'src/a.ts',
        'src/b.test.ts',
      ]);

      const config = baseConfig(tmpDir, { gitDiffBase: 'main' });
      const result = await discoverSourceFiles(config);

      expect(result).toEqual([path.resolve(tmpDir, 'src/a.ts'), path.resolve(tmpDir, 'src/b.ts')].sort());
    });
  });
});
