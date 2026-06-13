import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { computeOutputTestPath } from '../../src/writer/pathMapper.js';
import type { ProjectConventions } from '../../src/conventions/conventions.types.js';

const repoRoot = path.join('/repo');

function baseConventions(overrides: Partial<ProjectConventions> = {}): ProjectConventions {
  return {
    framework: 'vitest',
    testCommand: ['npx', 'vitest', 'run'],
    testFileSuffix: '.test',
    testLocation: 'colocated',
    srcRootDir: 'src',
    testsRootDir: undefined,
    usesReactTestingLibrary: true,
    usesMsw: false,
    usesJestDom: true,
    ...overrides,
  };
}

describe('computeOutputTestPath', () => {
  it('colocates the test file next to the source file with the configured suffix', () => {
    const sourceFile = path.join(repoRoot, 'src', 'components', 'Foo.tsx');
    const conventions = baseConventions({ testLocation: 'colocated', testFileSuffix: '.test' });

    const result = computeOutputTestPath(sourceFile, repoRoot, conventions);

    expect(result).toBe(path.join(repoRoot, 'src', 'components', 'Foo.test.tsx'));
  });

  it('places the test file in a sibling __tests__ directory with the configured suffix', () => {
    const sourceFile = path.join(repoRoot, 'src', 'components', 'Foo.tsx');
    const conventions = baseConventions({ testLocation: '__tests__', testFileSuffix: '.spec' });

    const result = computeOutputTestPath(sourceFile, repoRoot, conventions);

    expect(result).toBe(path.join(repoRoot, 'src', 'components', '__tests__', 'Foo.spec.tsx'));
  });

  it('mirrors the source path under the configured testsRootDir', () => {
    const sourceFile = path.join(repoRoot, 'src', 'components', 'Foo.tsx');
    const conventions = baseConventions({
      testLocation: 'mirrored',
      srcRootDir: 'src',
      testsRootDir: 'tests',
      testFileSuffix: '.test',
    });

    const result = computeOutputTestPath(sourceFile, repoRoot, conventions);

    expect(result).toBe(path.join(repoRoot, 'tests', 'components', 'Foo.test.tsx'));
  });

  it('defaults to a "tests" root when mirrored and testsRootDir is undefined', () => {
    const sourceFile = path.join(repoRoot, 'src', 'components', 'Foo.tsx');
    const conventions = baseConventions({
      testLocation: 'mirrored',
      srcRootDir: 'src',
      testsRootDir: undefined,
      testFileSuffix: '.test',
    });

    const result = computeOutputTestPath(sourceFile, repoRoot, conventions);

    expect(result).toBe(path.join(repoRoot, 'tests', 'components', 'Foo.test.tsx'));
  });
});
