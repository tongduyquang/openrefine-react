import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import { describe, it, expect, afterEach } from 'vitest';
import {
  findNearestTsConfig,
  getProjectForFile,
  clearProjectCache,
} from '../../src/analyzer/tsProject.js';

const sampleAppRoot = path.resolve('examples/sample-app');

async function makeTmpDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

describe('findNearestTsConfig', () => {
  afterEach(() => {
    clearProjectCache();
  });

  it('finds the repo-root tsconfig.json for a file in the sample-app fixture', async () => {
    const filePath = path.join(sampleAppRoot, 'src/components/Counter.tsx');
    const result = await findNearestTsConfig(filePath, sampleAppRoot);

    expect(result).toBe(path.join(sampleAppRoot, 'tsconfig.json'));
  });

  it('returns undefined when no tsconfig.json exists anywhere in the tree', async () => {
    const tmpRoot = await makeTmpDir('weaver-no-tsconfig-');
    try {
      const nestedDir = path.join(tmpRoot, 'src');
      await fs.mkdir(nestedDir, { recursive: true });
      const filePath = path.join(nestedDir, 'foo.ts');
      await fs.writeFile(filePath, 'export const foo = 1;\n');

      const result = await findNearestTsConfig(filePath, tmpRoot);

      expect(result).toBeUndefined();
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });

  it('finds the nearer nested tsconfig.json over the repo-root one', async () => {
    const tmpRoot = await makeTmpDir('weaver-nested-tsconfig-');
    try {
      await fs.writeFile(path.join(tmpRoot, 'tsconfig.json'), JSON.stringify({ compilerOptions: {} }));

      const pkgDir = path.join(tmpRoot, 'pkg');
      const pkgSrcDir = path.join(pkgDir, 'src');
      await fs.mkdir(pkgSrcDir, { recursive: true });
      await fs.writeFile(path.join(pkgDir, 'tsconfig.json'), JSON.stringify({ compilerOptions: {} }));

      const filePath = path.join(pkgSrcDir, 'foo.ts');
      await fs.writeFile(filePath, 'export const foo = 1;\n');

      const result = await findNearestTsConfig(filePath, tmpRoot);

      expect(result).toBe(path.join(pkgDir, 'tsconfig.json'));
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });
});

describe('getProjectForFile', () => {
  afterEach(() => {
    clearProjectCache();
  });

  it('returns the same cached Project instance for repeated calls, and a new one after clearProjectCache', async () => {
    const filePath = path.join(sampleAppRoot, 'src/components/Counter.tsx');

    const first = await getProjectForFile(filePath, sampleAppRoot);
    const second = await getProjectForFile(filePath, sampleAppRoot);

    expect(second).toBe(first);

    clearProjectCache();

    const third = await getProjectForFile(filePath, sampleAppRoot);

    expect(third).not.toBe(first);
  });

  it('falls back to an in-memory ReactJSX project when no tsconfig.json exists', async () => {
    const tmpRoot = await makeTmpDir('weaver-fallback-project-');
    try {
      const filePath = path.join(tmpRoot, 'foo.ts');
      await fs.writeFile(filePath, 'export const foo = 1;\n');

      const project = await getProjectForFile(filePath, tmpRoot);

      // ts.JsxEmit.ReactJSX === 4
      expect(project.getCompilerOptions().jsx).toBeTruthy();
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });
});
