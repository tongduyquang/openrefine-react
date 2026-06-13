import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

vi.mock('../../src/validate/typecheckRunner.js', () => ({ runTypecheck: vi.fn() }));
vi.mock('../../src/validate/testRunner.js', () => ({ runTestFile: vi.fn() }));

import { runFixLoop } from '../../src/validate/fixLoop.js';
import { runTypecheck } from '../../src/validate/typecheckRunner.js';
import { runTestFile } from '../../src/validate/testRunner.js';
import { Logger } from '../../src/utils/logger.js';
import { FakeAiProvider } from '../fixtures/fakeAiProvider.js';
import type { ProjectConventions } from '../../src/conventions/conventions.types.js';
import type { FileAnalysis } from '../../src/analyzer/analyzer.types.js';
import type { PromptContext } from '../../src/prompt/prompt.types.js';

const conventions: ProjectConventions = {
  framework: 'vitest',
  testCommand: ['npx', 'vitest', 'run'],
  testFileSuffix: '.test',
  testLocation: 'colocated',
  srcRootDir: 'src',
  usesReactTestingLibrary: false,
  usesMsw: false,
  usesJestDom: false,
};

const analysis: FileAnalysis = {
  filePath: '/tmp/x.ts',
  relativePath: 'src/x.ts',
  sourceText: '',
  truncated: false,
  isReactFile: false,
  components: [],
  hooks: [],
  functions: [],
  exportedTypes: [],
  imports: [],
};

function basePromptCtx(): PromptContext {
  return {
    mode: 'generate',
    conventions,
    analysis,
    relativeSourcePath: 'src/x.ts',
    relativeOutputPath: 'src/x.test.ts',
  };
}

describe('runFixLoop', () => {
  let tmpDir: string;
  let outputTestPath: string;
  let logger: Logger;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'weaver-fixloop-'));
    outputTestPath = path.join(tmpDir, 'src', 'x.test.ts');
    logger = new Logger('quiet');
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('skipValidation: true writes the file and returns pass without running validators', async () => {
    const fakeAi = new FakeAiProvider([]);

    const result = await runFixLoop('content', outputTestPath, basePromptCtx(), fakeAi, {
      repoRoot: tmpDir,
      maxAttempts: 3,
      skipValidation: true,
      logger,
    });

    expect(result).toEqual({ status: 'pass', attempts: 1, finalContent: 'content', errors: [] });

    const written = await fs.readFile(outputTestPath, 'utf-8');
    expect(written).toBe('content\n');

    expect(runTypecheck).not.toHaveBeenCalled();
    expect(runTestFile).not.toHaveBeenCalled();
  });

  it('passes on the first attempt when typecheck and test run both succeed', async () => {
    vi.mocked(runTypecheck).mockResolvedValueOnce({ success: true, output: '' });
    vi.mocked(runTestFile).mockResolvedValueOnce({ success: true, output: '' });

    const fakeAi = new FakeAiProvider([]);

    const result = await runFixLoop('content', outputTestPath, basePromptCtx(), fakeAi, {
      repoRoot: tmpDir,
      maxAttempts: 3,
      skipValidation: false,
      logger,
    });

    expect(result.status).toBe('pass');
    expect(result.attempts).toBe(1);
    expect(result.errors).toEqual([]);
    expect(fakeAi.callCount).toBe(0);
  });

  it('repairs after a typecheck failure and passes on the second attempt', async () => {
    vi.mocked(runTypecheck)
      .mockResolvedValueOnce({ success: false, output: 'TS error' })
      .mockResolvedValueOnce({ success: true, output: '' });
    vi.mocked(runTestFile).mockResolvedValue({ success: true, output: '' });

    const fakeAi = new FakeAiProvider(['fixed content']);

    const result = await runFixLoop('content', outputTestPath, basePromptCtx(), fakeAi, {
      repoRoot: tmpDir,
      maxAttempts: 3,
      skipValidation: false,
      logger,
    });

    expect(result.status).toBe('pass');
    expect(result.attempts).toBe(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('TS error');
    expect(result.finalContent).toBe('fixed content');
    expect(fakeAi.callCount).toBe(1);

    const written = await fs.readFile(outputTestPath, 'utf-8');
    expect(written).toContain('fixed content');
  });

  it('repairs after a test run failure and passes on the second attempt', async () => {
    vi.mocked(runTypecheck).mockResolvedValue({ success: true, output: '' });
    vi.mocked(runTestFile)
      .mockResolvedValueOnce({ success: false, output: 'test failed' })
      .mockResolvedValueOnce({ success: true, output: '' });

    const fakeAi = new FakeAiProvider(['fixed content']);

    const result = await runFixLoop('content', outputTestPath, basePromptCtx(), fakeAi, {
      repoRoot: tmpDir,
      maxAttempts: 3,
      skipValidation: false,
      logger,
    });

    expect(result.status).toBe('pass');
    expect(result.attempts).toBe(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('test failed');
    expect(result.finalContent).toBe('fixed content');
    expect(fakeAi.callCount).toBe(1);

    const written = await fs.readFile(outputTestPath, 'utf-8');
    expect(written).toContain('fixed content');
  });

  it('exhausts attempts and returns fail with the last repaired content', async () => {
    vi.mocked(runTypecheck).mockResolvedValue({ success: false, output: 'persistent error' });

    const fakeAi = new FakeAiProvider(['attempt2 content']);

    const result = await runFixLoop('content', outputTestPath, basePromptCtx(), fakeAi, {
      repoRoot: tmpDir,
      maxAttempts: 2,
      skipValidation: false,
      logger,
    });

    expect(result.status).toBe('fail');
    expect(result.attempts).toBe(2);
    expect(result.errors).toHaveLength(2);
    expect(result.finalContent).toBe('attempt2 content');
  });
});
