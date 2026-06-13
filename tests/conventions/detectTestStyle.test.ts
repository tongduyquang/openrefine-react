import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { detectTestFileSuffix } from '../../src/conventions/detectTestStyle.js';

describe('detectTestFileSuffix', () => {
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

  it('returns .test when there are zero of both .test and .spec files', async () => {
    expect(await detectTestFileSuffix(tmpDir)).toBe('.test');
  });

  it('returns .test when .test files are more numerous than .spec files', async () => {
    await writeFile('src/Foo.test.ts');
    await writeFile('src/Bar.test.ts');
    await writeFile('src/Baz.spec.ts');

    expect(await detectTestFileSuffix(tmpDir)).toBe('.test');
  });

  it('returns .test when .test and .spec counts are equal', async () => {
    await writeFile('src/Foo.test.ts');
    await writeFile('src/Foo.spec.ts');

    expect(await detectTestFileSuffix(tmpDir)).toBe('.test');
  });

  it('returns .spec when .spec files outnumber .test files', async () => {
    await writeFile('src/Foo.spec.ts');
    await writeFile('src/Bar.spec.ts');
    await writeFile('src/Baz.test.ts');

    expect(await detectTestFileSuffix(tmpDir)).toBe('.spec');
  });
});
