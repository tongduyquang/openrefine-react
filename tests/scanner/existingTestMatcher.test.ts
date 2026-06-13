import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ProjectConventions } from '../../src/conventions/conventions.types.js';
import { findExistingTestFile } from '../../src/scanner/existingTestMatcher.js';

function baseConventions(overrides: Partial<ProjectConventions> = {}): ProjectConventions {
  return {
    framework: 'vitest',
    testCommand: ['npx', 'vitest', 'run'],
    testFileSuffix: '.test',
    testLocation: 'colocated',
    srcRootDir: 'src',
    usesReactTestingLibrary: false,
    usesMsw: false,
    usesJestDom: false,
    ...overrides,
  };
}

describe('findExistingTestFile', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'weaver-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function writeFile(relPath: string, content = '// content\n'): Promise<void> {
    const full = path.join(tmpDir, relPath);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content, 'utf-8');
  }

  it('finds a colocated Foo.test.tsx next to Foo.tsx', async () => {
    await writeFile('src/components/Foo.tsx');
    await writeFile('src/components/Foo.test.tsx');

    const conventions = baseConventions({ testLocation: 'colocated', testFileSuffix: '.test' });
    const sourceFile = path.join(tmpDir, 'src/components/Foo.tsx');

    const result = await findExistingTestFile(sourceFile, conventions, tmpDir);
    expect(result).toBe(path.join(tmpDir, 'src/components/Foo.test.tsx'));
  });

  it('falls back to .spec when .test does not exist but .spec does', async () => {
    await writeFile('src/components/Foo.tsx');
    await writeFile('src/components/Foo.spec.tsx');

    const conventions = baseConventions({ testLocation: 'colocated', testFileSuffix: '.test' });
    const sourceFile = path.join(tmpDir, 'src/components/Foo.tsx');

    const result = await findExistingTestFile(sourceFile, conventions, tmpDir);
    expect(result).toBe(path.join(tmpDir, 'src/components/Foo.spec.tsx'));
  });

  it('falls back to .test when .spec does not exist but .test does (suffix=.spec)', async () => {
    await writeFile('src/components/Foo.tsx');
    await writeFile('src/components/Foo.test.tsx');

    const conventions = baseConventions({ testLocation: 'colocated', testFileSuffix: '.spec' });
    const sourceFile = path.join(tmpDir, 'src/components/Foo.tsx');

    const result = await findExistingTestFile(sourceFile, conventions, tmpDir);
    expect(result).toBe(path.join(tmpDir, 'src/components/Foo.test.tsx'));
  });

  it('finds a test file inside a __tests__ directory', async () => {
    await writeFile('src/components/Foo.tsx');
    await writeFile('src/components/__tests__/Foo.test.tsx');

    const conventions = baseConventions({ testLocation: '__tests__', testFileSuffix: '.test' });
    const sourceFile = path.join(tmpDir, 'src/components/Foo.tsx');

    const result = await findExistingTestFile(sourceFile, conventions, tmpDir);
    expect(result).toBe(path.join(tmpDir, 'src/components/__tests__/Foo.test.tsx'));
  });

  it('finds a mirrored test file under testsRootDir', async () => {
    await writeFile('src/components/Foo.tsx');
    await writeFile('tests/components/Foo.test.tsx');

    const conventions = baseConventions({
      testLocation: 'mirrored',
      testFileSuffix: '.test',
      testsRootDir: 'tests',
      srcRootDir: 'src',
    });
    const sourceFile = path.join(tmpDir, 'src/components/Foo.tsx');

    const result = await findExistingTestFile(sourceFile, conventions, tmpDir);
    expect(result).toBe(path.join(tmpDir, 'tests/components/Foo.test.tsx'));
  });

  it('returns undefined when no candidate test file exists', async () => {
    await writeFile('src/components/Foo.tsx');

    const conventions = baseConventions({ testLocation: 'colocated', testFileSuffix: '.test' });
    const sourceFile = path.join(tmpDir, 'src/components/Foo.tsx');

    const result = await findExistingTestFile(sourceFile, conventions, tmpDir);
    expect(result).toBeUndefined();
  });
});
