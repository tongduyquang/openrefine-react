import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createManifest, loadManifest, recordTaskResult, saveManifest } from '../../src/planner/manifest.js';
import { WEAVER_DIR, MANIFEST_FILE_NAME } from '../../src/config/defaults.js';
import type { RunManifest, TaskResult } from '../../src/planner/planner.types.js';

function makeResult(overrides: Partial<TaskResult> = {}): TaskResult {
  return {
    id: 'src/components/Foo.tsx',
    mode: 'generate',
    status: 'pass',
    attempts: 1,
    written: true,
    outputPath: 'src/components/Foo.test.tsx',
    errors: [],
    ...overrides,
  };
}

describe('manifest', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'weaver-manifest-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('createManifest', () => {
    it('returns a fresh manifest with empty results and matching createdAt/updatedAt', () => {
      const manifest = createManifest();

      expect(manifest.version).toBe(1);
      expect(manifest.results).toEqual({});
      expect(manifest.createdAt).toBe(manifest.updatedAt);
      expect(new Date(manifest.createdAt).toString()).not.toBe('Invalid Date');
      expect(new Date(manifest.updatedAt).toString()).not.toBe('Invalid Date');
    });
  });

  describe('loadManifest', () => {
    it('returns undefined when .weaver/manifest.json does not exist', async () => {
      const result = await loadManifest(tmpDir);
      expect(result).toBeUndefined();
    });
  });

  describe('recordTaskResult', () => {
    it('adds a new result to manifest.results keyed by id', () => {
      const manifest = createManifest();
      const result = makeResult({ id: 'src/a.ts' });

      recordTaskResult(manifest, result);

      expect(manifest.results['src/a.ts']).toEqual(result);
    });

    it('overwrites an existing result with the same id', () => {
      const manifest = createManifest();
      const first = makeResult({ id: 'src/a.ts', status: 'fail', attempts: 1 });
      const second = makeResult({ id: 'src/a.ts', status: 'pass', attempts: 2 });

      recordTaskResult(manifest, first);
      recordTaskResult(manifest, second);

      expect(manifest.results['src/a.ts']).toEqual(second);
      expect(Object.keys(manifest.results)).toHaveLength(1);
    });
  });

  describe('saveManifest', () => {
    it('creates the .weaver directory if needed and writes manifest.json as pretty JSON', async () => {
      const manifest = createManifest();
      recordTaskResult(manifest, makeResult());

      await saveManifest(tmpDir, manifest);

      const filePath = path.join(tmpDir, WEAVER_DIR, MANIFEST_FILE_NAME);
      const raw = await fs.readFile(filePath, 'utf-8');

      expect(raw).toContain('\n');
      expect(raw).toContain('  "version"');

      const parsed = JSON.parse(raw) as RunManifest;
      expect(parsed.version).toBe(1);
      expect(parsed.results).toEqual(manifest.results);
    });

    it('updates manifest.updatedAt to a new timestamp >= createdAt', async () => {
      const manifest = createManifest();
      const originalCreatedAt = manifest.createdAt;

      // Ensure some time passes so updatedAt can differ.
      await new Promise((resolve) => setTimeout(resolve, 5));

      await saveManifest(tmpDir, manifest);

      expect(manifest.createdAt).toBe(originalCreatedAt);
      expect(new Date(manifest.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(originalCreatedAt).getTime());

      const filePath = path.join(tmpDir, WEAVER_DIR, MANIFEST_FILE_NAME);
      const raw = await fs.readFile(filePath, 'utf-8');
      const written = JSON.parse(raw) as RunManifest;

      expect(written.updatedAt).toBe(manifest.updatedAt);
    });
  });

  describe('round-trip', () => {
    it('saveManifest then loadManifest returns an equivalent manifest', async () => {
      const manifest = createManifest();
      recordTaskResult(manifest, makeResult({ id: 'src/a.ts', status: 'pass' }));
      recordTaskResult(manifest, makeResult({ id: 'src/b.ts', mode: 'fix', status: 'fail', errors: ['boom'] }));

      await saveManifest(tmpDir, manifest);
      const loaded = await loadManifest(tmpDir);

      expect(loaded).toBeDefined();
      expect(loaded!.version).toBe(manifest.version);
      expect(loaded!.results).toEqual(manifest.results);
      expect(typeof loaded!.createdAt).toBe('string');
      expect(typeof loaded!.updatedAt).toBe('string');
      expect(new Date(loaded!.createdAt).toString()).not.toBe('Invalid Date');
      expect(new Date(loaded!.updatedAt).toString()).not.toBe('Invalid Date');
    });
  });
});
