import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildPlan } from '../../src/planner/planBuilder.js';
import type { ProjectConventions } from '../../src/conventions/conventions.types.js';
import type { FileWithCoverage } from '../../src/coverage/gapPrioritizer.js';
import type { RunManifest } from '../../src/planner/planner.types.js';

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

describe('buildPlan', () => {
  let tmpDir: string;
  let absUtilA: string;
  let absUtilB: string;
  let absUtilBTest: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'weaver-planbuilder-'));

    const srcDir = path.join(tmpDir, 'src');
    await fs.mkdir(srcDir, { recursive: true });

    absUtilA = path.join(srcDir, 'utilA.ts');
    absUtilB = path.join(srcDir, 'utilB.ts');
    absUtilBTest = path.join(srcDir, 'utilB.test.ts');

    await fs.writeFile(absUtilA, 'export function utilA(): string {\n  return "a";\n}\n', 'utf-8');
    await fs.writeFile(absUtilB, 'export function utilB(): string {\n  return "b";\n}\n', 'utf-8');
    await fs.writeFile(absUtilBTest, "// existing test\n", 'utf-8');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  function files(): FileWithCoverage[] {
    return [
      { filePath: absUtilA, coverage: undefined },
      { filePath: absUtilB, coverage: { percent: 50, uncoveredLines: [2, 3] } },
    ];
  }

  it('fixExisting: false -> only the file without an existing test gets a "generate" task', async () => {
    const plan = await buildPlan(files(), {
      repoRoot: tmpDir,
      conventions,
      fixExisting: false,
    });

    expect(plan.tasks).toHaveLength(1);

    const task = plan.tasks[0]!;
    expect(task.mode).toBe('generate');
    expect(task.existingTestPath).toBeUndefined();
    expect(task.outputTestPath.endsWith(path.join('src', 'utilA.test.ts'))).toBe(true);
    expect(task.relativeSourcePath).toBe('src/utilA.ts');
    expect(task.analysis).toBeDefined();
    expect(task.analysis.filePath).toBe(absUtilA);
    expect(task.analysis.functions.length).toBeGreaterThan(0);
  });

  it('fixExisting: true -> the file with an existing test gets a "fix" task targeting that file', async () => {
    const plan = await buildPlan(files(), {
      repoRoot: tmpDir,
      conventions,
      fixExisting: true,
    });

    expect(plan.tasks).toHaveLength(2);

    const utilBTask = plan.tasks.find((t) => t.relativeSourcePath === 'src/utilB.ts');
    expect(utilBTask).toBeDefined();
    expect(utilBTask!.mode).toBe('fix');
    expect(utilBTask!.existingTestPath).toBe(absUtilBTest);
    expect(utilBTask!.outputTestPath).toBe(utilBTask!.existingTestPath);
    expect(utilBTask!.coverage).toEqual({ percent: 50, uncoveredLines: [2, 3] });
  });

  it('resumeManifest: skips files already marked "pass" and files with existing tests when fixExisting is false', async () => {
    const resumeManifest: RunManifest = {
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      results: {
        'src/utilA.ts': {
          id: 'src/utilA.ts',
          mode: 'generate',
          status: 'pass',
          attempts: 1,
          written: true,
          outputPath: 'src/utilA.test.ts',
          errors: [],
        },
      },
    };

    const plan = await buildPlan(files(), {
      repoRoot: tmpDir,
      conventions,
      fixExisting: false,
      resumeManifest,
    });

    expect(plan.tasks).toHaveLength(0);
  });
});
