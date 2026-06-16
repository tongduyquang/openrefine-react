import { promises as fs } from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import type { AiProvider } from '../ai/aiProvider.js';
import { createAiProvider } from '../ai/createProvider.js';
import { extractCode } from '../ai/responseParser.js';
import { loadConfig } from '../config/load.js';
import type { CliOptions, WeaverConfig } from '../config/schema.js';
import { detectConventions } from '../conventions/detectConventions.js';
import type { ProjectConventions } from '../conventions/conventions.types.js';
import { parseCoverageReport } from '../coverage/coverageParser.js';
import { applyCoveragePrioritization, type FileWithCoverage } from '../coverage/gapPrioritizer.js';
import { buildPlan } from '../planner/planBuilder.js';
import { createManifest, loadManifest, recordTaskResult, saveManifest } from '../planner/manifest.js';
import type { PlanTask, TaskResult } from '../planner/planner.types.js';
import { buildPrompt } from '../prompt/promptBuilder.js';
import type { PromptContext } from '../prompt/prompt.types.js';
import { buildRunSummary, type RunSummary } from '../report/reportData.js';
import { renderJsonReport } from '../report/jsonReport.js';
import { renderMarkdownReport } from '../report/markdownReport.js';
import { discoverSourceFiles } from '../scanner/fileScanner.js';
import { Logger } from '../utils/logger.js';
import { runFixLoop } from '../validate/fixLoop.js';
import { buildDiff, readFileIfExists } from '../writer/fileWriter.js';

export async function runGenerate(cliOptions: CliOptions, aiProvider?: AiProvider): Promise<void> {
  const config = await loadConfig(cliOptions);
  const logger = new Logger(config.logLevel);

  logger.step(`Scanning ${config.repoRoot}`);
  const sourceFiles = await discoverSourceFiles(config);
  logger.info(`Found ${sourceFiles.length} candidate source file(s).`);
  if (sourceFiles.length === 0) {
    logger.info('Nothing to do.');
    return;
  }

  const conventions = await detectConventions(config.repoRoot, config.conventionsOverride);
  logger.verbose(`Detected conventions: ${JSON.stringify(conventions)}`);

  let filesWithCoverage: FileWithCoverage[] = sourceFiles.map((filePath) => ({ filePath, coverage: undefined }));
  if (config.coveragePath) {
    const coverageMap = await parseCoverageReport(config.coveragePath, config.repoRoot);
    filesWithCoverage = applyCoveragePrioritization(sourceFiles, coverageMap, config.coverageThreshold, config.fixExisting);
    logger.verbose(`Coverage-prioritized ${filesWithCoverage.length} of ${sourceFiles.length} file(s).`);
  }

  const manifest = config.resume ? (await loadManifest(config.repoRoot)) ?? createManifest() : createManifest();

  const plan = await buildPlan(filesWithCoverage, {
    repoRoot: config.repoRoot,
    conventions,
    fixExisting: config.fixExisting,
    resumeManifest: config.resume ? manifest : undefined,
  });

  const generateCount = plan.tasks.filter((t) => t.mode === 'generate').length;
  const fixCount = plan.tasks.filter((t) => t.mode === 'fix').length;
  logger.info(`Plan: ${plan.tasks.length} task(s) — ${generateCount} new test file(s), ${fixCount} existing test fix(es).`);
  for (const task of plan.tasks) {
    const verb = task.mode === 'generate' ? 'generate' : 'fix';
    logger.step(`${verb} ${task.relativeSourcePath} -> ${task.relativeOutputPath}`);
  }

  if (config.planOnly) {
    if (config.json) {
      console.log(
        JSON.stringify(
          plan.tasks.map((t) => ({
            id: t.id,
            mode: t.mode,
            source: t.relativeSourcePath,
            output: t.relativeOutputPath,
            coverage: t.coverage,
          })),
          null,
          2,
        ),
      );
    }
    return;
  }

  if (plan.tasks.length === 0) {
    logger.info('Nothing to generate or fix.');
    return;
  }

  const ai = aiProvider ?? createAiProvider(config.provider, config.model);
  const startedAt = new Date().toISOString();
  const results: TaskResult[] = [];

  for (const task of plan.tasks) {
    const result = await processTask(task, config, conventions, ai, logger);
    results.push(result);
    recordTaskResult(manifest, result);
    if (!config.dryRun) {
      await saveManifest(config.repoRoot, manifest);
    }
  }

  const summary = buildRunSummary(config.repoRoot, config.dryRun, startedAt, results);

  if (!config.dryRun) {
    await fs.mkdir(config.reportDir, { recursive: true });
    const stamp = startedAt.replace(/[:.]/g, '-');
    await fs.writeFile(path.join(config.reportDir, `run-${stamp}.md`), renderMarkdownReport(summary), 'utf-8');
    await fs.writeFile(path.join(config.reportDir, `run-${stamp}.json`), renderJsonReport(summary), 'utf-8');
  }

  if (config.json) {
    console.log(renderJsonReport(summary));
  } else {
    printSummary(summary, logger);
  }
}

async function processTask(
  task: PlanTask,
  config: WeaverConfig,
  conventions: ProjectConventions,
  ai: AiProvider,
  logger: Logger,
): Promise<TaskResult> {
  const existingContent = task.existingTestPath ? await readFileIfExists(task.existingTestPath) : undefined;

  const promptCtx: PromptContext = {
    mode: task.mode,
    conventions,
    analysis: task.analysis,
    relativeSourcePath: task.relativeSourcePath,
    relativeOutputPath: task.relativeOutputPath,
    exampleTest: task.exampleTest,
    coverage: task.coverage,
    customPrompt: config.customPrompt,
    existingTest: existingContent,
  };

  logger.step(`Generating ${task.relativeOutputPath} ...`);
  const response = await ai.generate(buildPrompt(promptCtx));
  const generatedCode = extractCode(response.text);

  if (!generatedCode) {
    return {
      id: task.id,
      mode: task.mode,
      status: 'fail',
      attempts: 0,
      written: false,
      outputPath: task.relativeOutputPath,
      errors: ['AI response did not contain any code.'],
    };
  }

  if (config.dryRun) {
    logger.info(buildDiff(task.relativeOutputPath, existingContent, generatedCode));
    return {
      id: task.id,
      mode: task.mode,
      status: 'skipped',
      attempts: 0,
      written: false,
      outputPath: task.relativeOutputPath,
      errors: [],
    };
  }

  const fixResult = await runFixLoop(generatedCode, task.outputTestPath, promptCtx, ai, {
    repoRoot: config.repoRoot,
    maxAttempts: config.fixLoopAttempts,
    skipValidation: config.skipValidation,
    logger,
  });

  if (fixResult.status === 'pass') {
    logger.success(`${task.relativeOutputPath} (${fixResult.attempts} attempt${fixResult.attempts > 1 ? 's' : ''})`);
  } else {
    logger.error(`${task.relativeOutputPath} failed validation after ${fixResult.attempts} attempt(s)`);
  }

  return {
    id: task.id,
    mode: task.mode,
    status: fixResult.status,
    attempts: fixResult.attempts,
    written: true,
    outputPath: task.relativeOutputPath,
    errors: fixResult.errors,
  };
}

function printSummary(summary: RunSummary, logger: Logger): void {
  logger.info('');
  if (summary.dryRun) {
    logger.info(pc.bold('Dry run complete — no files were written.'));
    return;
  }
  logger.info(
    `${pc.bold('Summary:')} ${pc.green(`${summary.totals.pass} passed`)}, ${pc.red(`${summary.totals.fail} failed`)}, ${summary.totals.skipped} skipped (${summary.totals.total} total)`,
  );
}
