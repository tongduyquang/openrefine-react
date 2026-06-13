import { readPackageJson } from './detectFramework.js';

export interface DetectedLibraries {
  usesReactTestingLibrary: boolean;
  usesMsw: boolean;
  usesJestDom: boolean;
}

/** Detect React Testing Library / MSW / jest-dom usage from package.json deps. */
export async function detectLibraries(repoRoot: string): Promise<DetectedLibraries> {
  const pkg = await readPackageJson(repoRoot);
  const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };

  return {
    usesReactTestingLibrary: '@testing-library/react' in deps,
    usesMsw: 'msw' in deps,
    usesJestDom: '@testing-library/jest-dom' in deps,
  };
}
