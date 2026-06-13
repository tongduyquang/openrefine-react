import type { AiProvider } from '../ai/aiProvider.js';
import { extractCode } from '../ai/responseParser.js';
import { buildPrompt } from '../prompt/promptBuilder.js';
import type { PromptContext } from '../prompt/prompt.types.js';
import type { Logger } from '../utils/logger.js';
import { writeTestFile } from '../writer/fileWriter.js';
import { runTestFile } from './testRunner.js';
import { runTypecheck } from './typecheckRunner.js';

const MAX_ERROR_CHARS = 4000;

export interface FixLoopOptions {
  repoRoot: string;
  maxAttempts: number;
  skipValidation: boolean;
  logger: Logger;
}

export interface FixLoopResult {
  finalContent: string;
  status: 'pass' | 'fail';
  attempts: number;
  errors: string[];
}

function truncate(text: string, maxChars: number): string {
  return text.length <= maxChars ? text : `${text.slice(0, maxChars)}\n... (truncated)`;
}

async function repair(
  previousAttempt: string,
  errorOutput: string,
  attemptNumber: number,
  promptCtx: PromptContext,
  ai: AiProvider,
): Promise<string> {
  const prompt = buildPrompt({
    ...promptCtx,
    repair: { previousAttempt, errorOutput: truncate(errorOutput, MAX_ERROR_CHARS), attemptNumber },
  });
  const response = await ai.generate(prompt);
  return extractCode(response.text);
}

/**
 * Write `initialContent` to `outputTestPath`, then iteratively:
 * typecheck -> run the single test file -> on failure, ask the AI to repair
 * using the error output, rewrite, and retry — up to `maxAttempts` times.
 *
 * If `skipValidation` is set, writes the file once and reports `pass`
 * without running tsc/the test runner.
 */
export async function runFixLoop(
  initialContent: string,
  outputTestPath: string,
  promptCtx: PromptContext,
  ai: AiProvider,
  options: FixLoopOptions,
): Promise<FixLoopResult> {
  const { repoRoot, maxAttempts, skipValidation, logger } = options;
  const errors: string[] = [];
  let content = initialContent;

  if (skipValidation) {
    await writeTestFile(outputTestPath, content);
    return { finalContent: content, status: 'pass', attempts: 1, errors };
  }

  const attemptsTotal = Math.max(1, maxAttempts);

  for (let attempt = 1; attempt <= attemptsTotal; attempt++) {
    await writeTestFile(outputTestPath, content);

    const typecheck = await runTypecheck(outputTestPath, repoRoot);
    if (!typecheck.success) {
      errors.push(typecheck.output);
      logger.verbose(`[${promptCtx.relativeOutputPath}] typecheck failed (attempt ${attempt}):\n${typecheck.output}`);
      if (attempt >= attemptsTotal) {
        return { finalContent: content, status: 'fail', attempts: attempt, errors };
      }
      content = await repair(content, typecheck.output, attempt, promptCtx, ai);
      continue;
    }

    const testRun = await runTestFile(outputTestPath, repoRoot, promptCtx.conventions);
    if (!testRun.success) {
      errors.push(testRun.output);
      logger.verbose(`[${promptCtx.relativeOutputPath}] test run failed (attempt ${attempt}):\n${testRun.output}`);
      if (attempt >= attemptsTotal) {
        return { finalContent: content, status: 'fail', attempts: attempt, errors };
      }
      content = await repair(content, testRun.output, attempt, promptCtx, ai);
      continue;
    }

    return { finalContent: content, status: 'pass', attempts: attempt, errors };
  }

  return { finalContent: content, status: 'fail', attempts: attemptsTotal, errors };
}
