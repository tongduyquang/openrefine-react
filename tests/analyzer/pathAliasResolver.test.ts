import path from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';
import { getConfiguredAliases, getRelativeImportPath } from '../../src/analyzer/pathAliasResolver.js';
import { clearProjectCache } from '../../src/analyzer/tsProject.js';

const repoRoot = path.resolve('examples/sample-app');

describe('getConfiguredAliases', () => {
  afterEach(() => {
    clearProjectCache();
  });

  it('returns the path aliases configured in the governing tsconfig.json', async () => {
    const filePath = path.join(repoRoot, 'src/components/Counter.tsx');
    const aliases = await getConfiguredAliases(filePath, repoRoot);

    expect(aliases).toEqual(
      expect.arrayContaining([{ alias: '@/*', targets: ['src/*'] }]),
    );
  });
});

describe('getRelativeImportPath', () => {
  it('returns a same-directory specifier for a colocated test file', () => {
    const sourceFilePath = path.join('/repo', 'src', 'components', 'Foo.tsx');
    const outputTestPath = path.join('/repo', 'src', 'components', 'Foo.test.tsx');

    expect(getRelativeImportPath(outputTestPath, sourceFilePath)).toBe('./Foo');
  });

  it('returns a parent-relative specifier when the test file is one directory deeper (__tests__)', () => {
    const sourceFilePath = path.join('/repo', 'src', 'components', 'Foo.tsx');
    const outputTestPath = path.join('/repo', 'src', 'components', '__tests__', 'Foo.test.tsx');

    expect(getRelativeImportPath(outputTestPath, sourceFilePath)).toBe('../Foo');
  });
});
