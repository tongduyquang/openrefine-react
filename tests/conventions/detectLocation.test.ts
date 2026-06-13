import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { detectSrcRootDir, detectTestLocation } from '../../src/conventions/detectLocation.js';

describe('detectSrcRootDir', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'weaver-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns "src" when a src directory exists', async () => {
    await fs.mkdir(path.join(tmpDir, 'src'), { recursive: true });
    expect(await detectSrcRootDir(tmpDir)).toBe('src');
  });

  it('returns "app" when only an app directory exists', async () => {
    await fs.mkdir(path.join(tmpDir, 'app'), { recursive: true });
    expect(await detectSrcRootDir(tmpDir)).toBe('app');
  });

  it('returns "." when neither src nor app exists', async () => {
    expect(await detectSrcRootDir(tmpDir)).toBe('.');
  });

  it('prefers "src" over "app" when both exist', async () => {
    await fs.mkdir(path.join(tmpDir, 'src'), { recursive: true });
    await fs.mkdir(path.join(tmpDir, 'app'), { recursive: true });
    expect(await detectSrcRootDir(tmpDir)).toBe('src');
  });
});

describe('detectTestLocation', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'weaver-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function writeFile(relPath: string): Promise<void> {
    const full = path.join(tmpDir, relPath);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, '// content\n', 'utf-8');
  }

  it('returns colocated when there are no test files', async () => {
    expect(await detectTestLocation(tmpDir)).toEqual({ testLocation: 'colocated' });
  });

  it('returns __tests__ when test files live under __tests__ directories', async () => {
    await writeFile('src/components/__tests__/Foo.test.tsx');
    await writeFile('src/components/__tests__/Bar.test.tsx');

    expect(await detectTestLocation(tmpDir)).toEqual({ testLocation: '__tests__' });
  });

  it('returns mirrored with testsRootDir "tests" when test files live under a top-level tests/ dir', async () => {
    await writeFile('tests/components/Foo.test.tsx');
    await writeFile('tests/utils/helper.test.ts');

    expect(await detectTestLocation(tmpDir)).toEqual({ testLocation: 'mirrored', testsRootDir: 'tests' });
  });

  it('returns colocated when *.test.ts files sit next to their source files', async () => {
    await writeFile('src/components/Foo.test.tsx');
    await writeFile('src/utils/helper.test.ts');

    expect(await detectTestLocation(tmpDir)).toEqual({ testLocation: 'colocated' });
  });
});
