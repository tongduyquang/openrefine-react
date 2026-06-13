import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { detectLibraries } from '../../src/conventions/detectLibraries.js';

describe('detectLibraries', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'weaver-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function writePackageJson(content: unknown): Promise<void> {
    await fs.writeFile(path.join(tmpDir, 'package.json'), JSON.stringify(content, null, 2), 'utf-8');
  }

  it('detects all libraries when present in dependencies', async () => {
    await writePackageJson({
      dependencies: {
        '@testing-library/react': '^16.0.0',
        msw: '^2.0.0',
      },
      devDependencies: {
        '@testing-library/jest-dom': '^6.0.0',
      },
    });

    expect(await detectLibraries(tmpDir)).toEqual({
      usesReactTestingLibrary: true,
      usesMsw: true,
      usesJestDom: true,
    });
  });

  it('returns false for libraries not present in dependencies', async () => {
    await writePackageJson({
      dependencies: {
        react: '^18.0.0',
      },
    });

    expect(await detectLibraries(tmpDir)).toEqual({
      usesReactTestingLibrary: false,
      usesMsw: false,
      usesJestDom: false,
    });
  });

  it('returns all false when package.json is missing', async () => {
    expect(await detectLibraries(tmpDir)).toEqual({
      usesReactTestingLibrary: false,
      usesMsw: false,
      usesJestDom: false,
    });
  });
});
