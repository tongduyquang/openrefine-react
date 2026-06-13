import type { ConventionsOverride } from '../config/schema.js';
import type { ProjectConventions } from './conventions.types.js';
import { detectFramework, getTestCommand } from './detectFramework.js';
import { detectLibraries } from './detectLibraries.js';
import { detectSrcRootDir, detectTestLocation } from './detectLocation.js';
import { detectTestFileSuffix } from './detectTestStyle.js';

/**
 * Detect the target repo's existing testing conventions so generated files
 * land in the right place with the right naming/style. Any field present in
 * `override` (from `.weaverc.json`) wins over detection.
 */
export async function detectConventions(repoRoot: string, override?: ConventionsOverride): Promise<ProjectConventions> {
  const [framework, testFileSuffix, location, libraries, srcRootDir] = await Promise.all([
    detectFramework(repoRoot),
    detectTestFileSuffix(repoRoot),
    detectTestLocation(repoRoot),
    detectLibraries(repoRoot),
    detectSrcRootDir(repoRoot),
  ]);

  const resolvedFramework = override?.framework ?? framework;

  return {
    framework: resolvedFramework,
    testCommand: getTestCommand(resolvedFramework),
    testFileSuffix: override?.testFileSuffix ?? testFileSuffix,
    testLocation: override?.testLocation ?? location.testLocation,
    testsRootDir: override?.testsRootDir ?? location.testsRootDir,
    srcRootDir: override?.srcRootDir ?? srcRootDir,
    usesReactTestingLibrary: override?.usesReactTestingLibrary ?? libraries.usesReactTestingLibrary,
    usesMsw: override?.usesMsw ?? libraries.usesMsw,
    usesJestDom: override?.usesJestDom ?? libraries.usesJestDom,
  };
}
