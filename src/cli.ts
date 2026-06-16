#!/usr/bin/env node
import { Command } from 'commander';
import pc from 'picocolors';
import { runGenerate } from './commands/generate.js';
import { runInit } from './commands/init.js';
import { ConfigError } from './config/load.js';
import type { CliOptions } from './config/schema.js';

function parseInteger(value: string): number {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) throw new Error(`Invalid integer: ${value}`);
  return n;
}

function parseNumber(value: string): number {
  const n = Number.parseFloat(value);
  if (Number.isNaN(n)) throw new Error(`Invalid number: ${value}`);
  return n;
}

function handleError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(pc.red(`Error: ${message}`));
  process.exitCode = error instanceof ConfigError ? 2 : 1;
}

const program = new Command();

program
  .name('weave-tests')
  .description('AI-powered test generator and fixer for TypeScript/React codebases')
  .version('0.1.0');

program
  .command('generate')
  .description('Scan a repo, detect testing conventions, and generate/fix test files using AI')
  .option('-r, --repo <path>', 'Path to the target repo', '.')
  .option('-p, --prompt <text>', 'Inline custom instructions for the AI (test structure/style)')
  .option('-P, --prompt-file <path>', 'Path to a file containing custom AI instructions (overrides --prompt)')
  .option('-i, --include <globs...>', 'Include globs (default: src/**/*.{ts,tsx})')
  .option('-e, --exclude <globs...>', 'Additional exclude globs')
  .option('-f, --file <paths...>', 'Target specific file(s) only')
  .option('--git-diff [base]', 'Only target files changed vs <base> (default: origin/main)')
  .option('--fix-existing', 'Also re-check/update existing test files for changed sources')
  .option('--coverage <path>', 'Path to an istanbul/v8 coverage JSON for gap prioritization')
  .option('--coverage-threshold <n>', 'Skip files already >= this %% covered (default: 80)', parseNumber)
  .option('--dry-run', 'Compute AI output and show diffs without writing files')
  .option('--plan-only', 'Show the plan (files/order) without calling the AI')
  .option('--max-files <n>', 'Cap the number of files processed', parseInteger)
  .option('--fix-loop-attempts <n>', 'Max AI repair iterations per file (default: 3)', parseInteger)
  .option('--skip-validation', 'Skip the tsc/test-runner validation loop')
  .option('--resume', 'Resume from .weaver/manifest.json, skipping already-passed files')
  .option('--provider <name>', 'AI backend: anthropic (default) or github (GitHub Models API)')
  .option('--model <name>', 'Model id (provider-specific; e.g. claude-sonnet-4-6 or openai/gpt-4o)')
  .option('--report-dir <path>', 'Directory for run reports (default: .weaver/reports)')
  .option('--json', 'Emit a machine-readable JSON summary to stdout')
  .option('-v, --verbose', 'Verbose logging (includes prompt/response previews)')
  .option('--quiet', 'Minimal output')
  .action(async (options: CliOptions) => {
    try {
      await runGenerate(options);
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('init')
  .description('Detect testing conventions in a repo and scaffold a .weaverc.json config file')
  .option('-r, --repo <path>', 'Path to the target repo', '.')
  .option('--yes', 'Overwrite an existing .weaverc.json')
  .action(async (options: { repo: string; yes?: boolean }) => {
    try {
      await runInit(options);
    } catch (error) {
      handleError(error);
    }
  });

await program.parseAsync(process.argv);
