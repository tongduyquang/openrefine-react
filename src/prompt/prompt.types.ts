import type { FileAnalysis } from '../analyzer/analyzer.types.js';
import type { ProjectConventions } from '../conventions/conventions.types.js';
import type { CoverageInfo, TaskMode } from '../planner/planner.types.js';

export interface RepairContext {
  /** The previously-written test file content that failed validation. */
  previousAttempt: string;
  /** Combined tsc / test-runner output describing the failure. */
  errorOutput: string;
  attemptNumber: number;
}

export interface PromptContext {
  mode: TaskMode;
  conventions: ProjectConventions;
  analysis: FileAnalysis;
  relativeSourcePath: string;
  relativeOutputPath: string;
  exampleTest?: { relativePath: string; content: string };
  coverage?: CoverageInfo;
  /** Verbatim developer instructions (Input #2), given precedence. */
  customPrompt?: string;
  /** Only set in 'fix' mode: the existing test file content to update. */
  existingTest?: string;
  /** Only set on repair iterations (validation failed). */
  repair?: RepairContext;
}

export interface AssembledPrompt {
  system: string;
  user: string;
}
