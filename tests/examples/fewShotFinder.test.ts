import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import { describe, it, expect, afterEach } from 'vitest';
import { analyzeFile } from '../../src/analyzer/astAnalyzer.js';
import { findFewShotExample } from '../../src/examples/fewShotFinder.js';
import { clearProjectCache } from '../../src/analyzer/tsProject.js';
import type { ProjectConventions } from '../../src/conventions/conventions.types.js';

const sampleAppRoot = path.resolve('examples/sample-app');

const conventions: ProjectConventions = {
  framework: 'vitest',
  testCommand: ['npx', 'vitest', 'run'],
  testFileSuffix: '.test',
  testLocation: 'colocated',
  srcRootDir: 'src',
  testsRootDir: undefined,
  usesReactTestingLibrary: true,
  usesMsw: false,
  usesJestDom: true,
};

describe('findFewShotExample', () => {
  afterEach(() => {
    clearProjectCache();
  });

  it('finds the colocated same-category test file as the best few-shot example', async () => {
    const filePath = path.join(sampleAppRoot, 'src/components/Counter.tsx');
    const analysis = await analyzeFile(filePath, sampleAppRoot);

    const example = await findFewShotExample(analysis, sampleAppRoot, conventions);

    expect(example).toBeDefined();
    expect(example?.relativePath).toBe('src/components/Greeting.test.tsx');

    const expectedContent = await fs.readFile(
      path.join(sampleAppRoot, 'src/components/Greeting.test.tsx'),
      'utf-8',
    );
    expect(example?.content).toBe(expectedContent);
  });

  it('returns undefined when there are no test files anywhere in the repo', async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'weaver-no-tests-'));
    try {
      const filePath = path.join(sampleAppRoot, 'src/components/Counter.tsx');
      const analysis = await analyzeFile(filePath, sampleAppRoot);

      const example = await findFewShotExample(analysis, tmpRoot, conventions);

      expect(example).toBeUndefined();
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });
});
