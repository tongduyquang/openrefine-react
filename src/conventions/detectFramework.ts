import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { TestFramework } from './conventions.types.js';

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

export async function readPackageJson(repoRoot: string): Promise<PackageJson | undefined> {
  try {
    const raw = await fs.readFile(path.join(repoRoot, 'package.json'), 'utf-8');
    return JSON.parse(raw) as PackageJson;
  } catch {
    return undefined;
  }
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

const VITEST_CONFIG_FILES = ['vitest.config.ts', 'vitest.config.mts', 'vitest.config.js', 'vite.config.ts', 'vite.config.js'];
const JEST_CONFIG_FILES = ['jest.config.ts', 'jest.config.js', 'jest.config.mjs', 'jest.config.cjs', 'jest.config.json'];

/** Detect Jest vs Vitest from package.json deps, config files, and the `test` script. Defaults to vitest. */
export async function detectFramework(repoRoot: string): Promise<TestFramework> {
  const pkg = await readPackageJson(repoRoot);
  const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };

  const [hasVitestConfig, hasJestConfig] = await Promise.all([
    Promise.all(VITEST_CONFIG_FILES.map((f) => fileExists(path.join(repoRoot, f)))).then((r) => r.some(Boolean)),
    Promise.all(JEST_CONFIG_FILES.map((f) => fileExists(path.join(repoRoot, f)))).then((r) => r.some(Boolean)),
  ]);

  if (deps?.vitest || hasVitestConfig) {
    return 'vitest';
  }
  if (deps?.jest || hasJestConfig || pkg?.scripts?.test?.includes('jest')) {
    return 'jest';
  }
  return 'vitest';
}

export function getTestCommand(framework: TestFramework): string[] {
  return framework === 'jest' ? ['npx', 'jest', '--ci'] : ['npx', 'vitest', 'run'];
}
