import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileIfExists, writeTestFile, buildDiff } from '../../src/writer/fileWriter.js';

describe('readFileIfExists', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'weaver-filewriter-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns the file content when the file exists', async () => {
    const filePath = path.join(tmpDir, 'existing.ts');
    await fs.writeFile(filePath, 'export const x = 1;\n');

    const content = await readFileIfExists(filePath);

    expect(content).toBe('export const x = 1;\n');
  });

  it('returns undefined when the file does not exist', async () => {
    const filePath = path.join(tmpDir, 'missing.ts');

    const content = await readFileIfExists(filePath);

    expect(content).toBeUndefined();
  });
});

describe('writeTestFile', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'weaver-filewriter-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('creates missing parent directories and writes the file content', async () => {
    const filePath = path.join(tmpDir, 'nested', 'deeper', 'Foo.test.ts');

    await writeTestFile(filePath, 'export const x = 1;\n');

    const written = await fs.readFile(filePath, 'utf-8');
    expect(written).toBe('export const x = 1;\n');
  });

  it('appends a trailing newline when the content does not already end with one', async () => {
    const filePath = path.join(tmpDir, 'Foo.test.ts');

    await writeTestFile(filePath, 'export const x = 1;');

    const written = await fs.readFile(filePath, 'utf-8');
    expect(written).toBe('export const x = 1;\n');
  });

  it('does not add an extra trailing newline when the content already ends with one', async () => {
    const filePath = path.join(tmpDir, 'Foo.test.ts');

    await writeTestFile(filePath, 'export const x = 1;\n');

    const written = await fs.readFile(filePath, 'utf-8');
    expect(written).toBe('export const x = 1;\n');
  });
});

describe('buildDiff', () => {
  it('references /dev/null as the "before" side for a new file', () => {
    const diff = buildDiff('src/foo.ts', undefined, 'export const x = 1;\n');

    expect(diff).toContain('--- /dev/null');
    expect(diff).toContain('+++ b/src/foo.ts');
    expect(diff).toContain('+export const x = 1;');
  });

  it('produces a unified diff with old and new content when "before" is defined', () => {
    const before = 'export const x = 1;\n';
    const after = 'export const x = 2;\n';

    const diff = buildDiff('src/foo.ts', before, after);

    expect(diff).toContain('--- a/src/foo.ts');
    expect(diff).toContain('+++ b/src/foo.ts');
    expect(diff).toContain('-export const x = 1;');
    expect(diff).toContain('+export const x = 2;');
  });
});
