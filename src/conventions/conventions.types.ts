export type TestFramework = 'vitest' | 'jest';
export type TestFileSuffix = '.test' | '.spec';
export type TestLocation = 'colocated' | '__tests__' | 'mirrored';

export interface ProjectConventions {
  framework: TestFramework;
  /** e.g. "npx vitest run" or "npx jest" — used by the validation runner. */
  testCommand: string[];
  testFileSuffix: TestFileSuffix;
  testLocation: TestLocation;
  /** Only used when testLocation === 'mirrored', e.g. "tests" or "test". */
  testsRootDir?: string;
  /** Root dir under which source files live, e.g. "src". Used for mirroring. */
  srcRootDir: string;
  usesReactTestingLibrary: boolean;
  usesMsw: boolean;
  usesJestDom: boolean;
}
