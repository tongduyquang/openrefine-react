import { z } from 'zod';
import type { LogLevel } from '../utils/logger.js';

export const ConventionsOverrideSchema = z.object({
  framework: z.enum(['vitest', 'jest']).optional(),
  testFileSuffix: z.enum(['.test', '.spec']).optional(),
  testLocation: z.enum(['colocated', '__tests__', 'mirrored']).optional(),
  testsRootDir: z.string().optional(),
  srcRootDir: z.string().optional(),
  usesReactTestingLibrary: z.boolean().optional(),
  usesMsw: z.boolean().optional(),
  usesJestDom: z.boolean().optional(),
});

export type ConventionsOverride = z.infer<typeof ConventionsOverrideSchema>;

/** Shape of `.weaverc.json` in the target repo. */
export const WeaverFileConfigSchema = z.object({
  include: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),
  conventions: ConventionsOverrideSchema.optional(),
  model: z.string().optional(),
  fixLoopAttempts: z.number().int().min(0).optional(),
  coverageThreshold: z.number().min(0).max(100).optional(),
  skipValidation: z.boolean().optional(),
});

export type WeaverFileConfig = z.infer<typeof WeaverFileConfigSchema>;

/** Raw options as parsed from the CLI by commander. */
export interface CliOptions {
  repo: string;
  prompt?: string;
  promptFile?: string;
  include?: string[];
  exclude?: string[];
  file?: string[];
  gitDiff?: string | boolean;
  fixExisting?: boolean;
  coverage?: string;
  coverageThreshold?: number;
  dryRun?: boolean;
  planOnly?: boolean;
  maxFiles?: number;
  fixLoopAttempts?: number;
  skipValidation?: boolean;
  resume?: boolean;
  fresh?: boolean;
  model?: string;
  reportDir?: string;
  json?: boolean;
  verbose?: boolean;
  quiet?: boolean;
}

/** Fully merged & resolved configuration used to drive a run. */
export interface WeaverConfig {
  repoRoot: string;
  include: string[];
  exclude: string[];
  targetFiles?: string[];
  gitDiffBase?: string;
  fixExisting: boolean;
  customPrompt?: string;
  coveragePath?: string;
  coverageThreshold: number;
  dryRun: boolean;
  planOnly: boolean;
  maxFiles?: number;
  fixLoopAttempts: number;
  skipValidation: boolean;
  resume: boolean;
  model: string;
  reportDir: string;
  json: boolean;
  logLevel: LogLevel;
  conventionsOverride?: ConventionsOverride;
}
