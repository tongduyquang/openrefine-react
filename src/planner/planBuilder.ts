import { analyzeFile } from '../analyzer/astAnalyzer.js';
import type { ProjectConventions } from '../conventions/conventions.types.js';
import type { FileWithCoverage } from '../coverage/gapPrioritizer.js';
import { findFewShotExample } from '../examples/fewShotFinder.js';
import { findExistingTestFile } from '../scanner/existingTestMatcher.js';
import { relativePosix } from '../utils/paths.js';
import { computeOutputTestPath } from '../writer/pathMapper.js';
import type { Plan, PlanTask, RunManifest } from './planner.types.js';

export interface PlanBuilderOptions {
  repoRoot: string;
  conventions: ProjectConventions;
  fixExisting: boolean;
  resumeManifest?: RunManifest;
}

/**
 * Build the ordered list of generation/fix tasks for a run.
 *
 * - Files with no existing test -> mode "generate", output path computed
 *   from conventions (mirrored location).
 * - Files with an existing test:
 *     - `fixExisting` false -> skipped entirely (already has a test).
 *     - `fixExisting` true  -> mode "fix", output path = existing test path.
 * - If resuming, tasks already marked "pass" in the manifest are skipped.
 *
 * `files` should already be ordered by priority (e.g. coverage-gap first) —
 * this function preserves that order.
 */
export async function buildPlan(files: FileWithCoverage[], options: PlanBuilderOptions): Promise<Plan> {
  const { repoRoot, conventions, fixExisting, resumeManifest } = options;
  const tasks: PlanTask[] = [];

  for (const file of files) {
    const existingTestPath = await findExistingTestFile(file.filePath, conventions, repoRoot);

    if (existingTestPath && !fixExisting) {
      continue;
    }

    const relativeSourcePath = relativePosix(repoRoot, file.filePath);
    if (resumeManifest?.results[relativeSourcePath]?.status === 'pass') {
      continue;
    }

    const analysis = await analyzeFile(file.filePath, repoRoot);
    const mode = existingTestPath ? 'fix' : 'generate';
    const outputTestPath = existingTestPath ?? computeOutputTestPath(file.filePath, repoRoot, conventions);
    const exampleTest = await findFewShotExample(analysis, repoRoot, conventions);

    tasks.push({
      id: relativeSourcePath,
      sourceFile: file.filePath,
      relativeSourcePath,
      outputTestPath,
      relativeOutputPath: relativePosix(repoRoot, outputTestPath),
      mode,
      existingTestPath,
      analysis,
      coverage: file.coverage,
      exampleTest,
    });
  }

  return { tasks };
}
