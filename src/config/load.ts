import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  AI_PROVIDERS,
  CONFIG_FILE_NAME,
  DEFAULT_COVERAGE_THRESHOLD,
  DEFAULT_EXCLUDE,
  DEFAULT_FIX_LOOP_ATTEMPTS,
  DEFAULT_INCLUDE,
  DEFAULT_MODELS,
  DEFAULT_PROVIDER,
  REPORT_DIR_NAME,
  WEAVER_DIR,
  type AiProviderName,
} from './defaults.js';
import { WeaverFileConfigSchema, type CliOptions, type WeaverConfig, type WeaverFileConfig } from './schema.js';
import type { LogLevel } from '../utils/logger.js';

export class ConfigError extends Error {}

async function readWeaverConfigFile(repoRoot: string): Promise<WeaverFileConfig> {
  const configPath = path.join(repoRoot, CONFIG_FILE_NAME);
  let raw: string;
  try {
    raw = await fs.readFile(configPath, 'utf-8');
  } catch {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new ConfigError(
      `Failed to parse ${CONFIG_FILE_NAME}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const result = WeaverFileConfigSchema.safeParse(parsed);
  if (!result.success) {
    throw new ConfigError(`Invalid ${CONFIG_FILE_NAME}: ${result.error.message}`);
  }
  return result.data;
}

function resolveLogLevel(cli: CliOptions): LogLevel {
  if (cli.quiet) return 'quiet';
  if (cli.verbose) return 'verbose';
  return 'normal';
}

/**
 * Merge precedence: CLI flags > .weaverc.json (target repo) > built-in defaults.
 */
export async function loadConfig(cli: CliOptions): Promise<WeaverConfig> {
  const repoRoot = path.resolve(cli.repo ?? '.');

  let repoStat;
  try {
    repoStat = await fs.stat(repoRoot);
  } catch {
    throw new ConfigError(`Repo path does not exist: ${repoRoot}`);
  }
  if (!repoStat.isDirectory()) {
    throw new ConfigError(`Repo path is not a directory: ${repoRoot}`);
  }

  const fileConfig = await readWeaverConfigFile(repoRoot);

  let customPrompt = cli.prompt;
  if (cli.promptFile) {
    const promptFilePath = path.resolve(cli.promptFile);
    try {
      customPrompt = (await fs.readFile(promptFilePath, 'utf-8')).trim();
    } catch (error) {
      throw new ConfigError(
        `Failed to read --prompt-file ${promptFilePath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  let targetFiles: string[] | undefined;
  if (cli.file && cli.file.length > 0) {
    targetFiles = cli.file.map((f) => path.resolve(repoRoot, f));
  }

  let gitDiffBase: string | undefined;
  if (cli.gitDiff !== undefined) {
    gitDiffBase = typeof cli.gitDiff === 'string' ? cli.gitDiff : 'origin/main';
  }

  const reportDir = cli.reportDir
    ? path.resolve(repoRoot, cli.reportDir)
    : path.join(repoRoot, WEAVER_DIR, REPORT_DIR_NAME);

  const providerRaw = cli.provider ?? fileConfig.provider ?? process.env.WEAVER_PROVIDER ?? DEFAULT_PROVIDER;
  if (!AI_PROVIDERS.includes(providerRaw as AiProviderName)) {
    throw new ConfigError(`Unknown provider "${providerRaw}". Valid providers: ${AI_PROVIDERS.join(', ')}.`);
  }
  const provider = providerRaw as AiProviderName;

  return {
    repoRoot,
    include: cli.include ?? fileConfig.include ?? DEFAULT_INCLUDE,
    exclude: [...DEFAULT_EXCLUDE, ...(cli.exclude ?? fileConfig.exclude ?? [])],
    targetFiles,
    gitDiffBase,
    fixExisting: cli.fixExisting ?? false,
    customPrompt: customPrompt?.trim() || undefined,
    coveragePath: cli.coverage ? path.resolve(repoRoot, cli.coverage) : undefined,
    coverageThreshold: cli.coverageThreshold ?? fileConfig.coverageThreshold ?? DEFAULT_COVERAGE_THRESHOLD,
    dryRun: cli.dryRun ?? false,
    planOnly: cli.planOnly ?? false,
    maxFiles: cli.maxFiles,
    fixLoopAttempts: cli.fixLoopAttempts ?? fileConfig.fixLoopAttempts ?? DEFAULT_FIX_LOOP_ATTEMPTS,
    skipValidation: cli.skipValidation ?? fileConfig.skipValidation ?? false,
    resume: cli.resume ?? false,
    provider,
    model: cli.model ?? fileConfig.model ?? process.env.WEAVER_MODEL ?? DEFAULT_MODELS[provider],
    reportDir,
    json: cli.json ?? false,
    logLevel: resolveLogLevel(cli),
    conventionsOverride: fileConfig.conventions,
  };
}
