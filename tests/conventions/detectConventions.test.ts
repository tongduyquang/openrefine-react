import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { detectConventions } from '../../src/conventions/detectConventions.js';

describe('detectConventions', () => {
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

  async function writePackageJson(content: unknown): Promise<void> {
    await fs.writeFile(path.join(tmpDir, 'package.json'), JSON.stringify(content, null, 2), 'utf-8');
  }

  async function setupRepo(): Promise<void> {
    await writePackageJson({
      devDependencies: {
        vitest: '^4.0.0',
      },
      dependencies: {
        '@testing-library/react': '^16.0.0',
        '@testing-library/jest-dom': '^6.0.0',
      },
    });
    await writeFile('src/components/Foo.tsx');
    await writeFile('src/components/Foo.test.tsx');
  }

  it('aggregates detected conventions when no override is provided', async () => {
    await setupRepo();

    const result = await detectConventions(tmpDir);

    expect(result).toEqual({
      framework: 'vitest',
      testCommand: ['npx', 'vitest', 'run'],
      testFileSuffix: '.test',
      testLocation: 'colocated',
      testsRootDir: undefined,
      srcRootDir: 'src',
      usesReactTestingLibrary: true,
      usesMsw: false,
      usesJestDom: true,
    });
  });

  it('lets override fields win while non-overridden fields are still detected', async () => {
    await setupRepo();

    const result = await detectConventions(tmpDir, {
      framework: 'jest',
      testFileSuffix: '.spec',
    });

    expect(result.framework).toBe('jest');
    expect(result.testFileSuffix).toBe('.spec');
    expect(result.testCommand).toEqual(['npx', 'jest', '--ci']);

    // Non-overridden fields remain as detected from the repo.
    expect(result.testLocation).toBe('colocated');
    expect(result.srcRootDir).toBe('src');
    expect(result.usesReactTestingLibrary).toBe(true);
    expect(result.usesJestDom).toBe(true);
    expect(result.usesMsw).toBe(false);
  });
});
