export const DEFAULT_INCLUDE = ['src/**/*.{ts,tsx}'];

export const DEFAULT_EXCLUDE = [
  '**/*.test.{ts,tsx}',
  '**/*.spec.{ts,tsx}',
  '**/*.d.ts',
  '**/__tests__/**',
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/*.stories.{ts,tsx}',
  '**/*.config.{ts,tsx}',
  '**/setupTests.{ts,tsx}',
  '**/setup.{ts,tsx}',
  '**/main.{ts,tsx}',
];

/** Supported AI backends. */
export const AI_PROVIDERS = ['anthropic', 'github'] as const;
export type AiProviderName = (typeof AI_PROVIDERS)[number];

/** Default provider when none is specified (preserves prior behavior). */
export const DEFAULT_PROVIDER: AiProviderName = 'anthropic';

/**
 * Default model id per provider, used when neither --model nor WEAVER_MODEL
 * nor a `.weaverc.json` model is set. GitHub Models uses `publisher/model`
 * names; override with --model (e.g. `openai/gpt-4o-mini`, `meta/Llama-3.3-70B-Instruct`).
 */
export const DEFAULT_MODELS: Record<AiProviderName, string> = {
  anthropic: 'claude-sonnet-4-6',
  github: 'openai/gpt-4o',
};

export const DEFAULT_FIX_LOOP_ATTEMPTS = 3;

export const DEFAULT_COVERAGE_THRESHOLD = 80;

/**
 * Source files larger than this are sent to the AI as extracted
 * signatures/JSDoc only, instead of the full source text.
 */
export const MAX_SOURCE_CHARS_FOR_FULL_INCLUSION = 12_000;

export const WEAVER_DIR = '.weaver';
export const MANIFEST_FILE_NAME = 'manifest.json';
export const REPORT_DIR_NAME = 'reports';
export const CONFIG_FILE_NAME = '.weaverc.json';

export const VALIDATION_TIMEOUT_MS = 120_000;
export const GIT_TIMEOUT_MS = 30_000;
