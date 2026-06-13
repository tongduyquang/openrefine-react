import type { FileAnalysis } from '../analyzer/analyzer.types.js';

export type TaskMode = 'generate' | 'fix';
export type TaskStatus = 'pending' | 'pass' | 'fail' | 'skipped';

export interface CoverageInfo {
  percent: number;
  uncoveredLines: number[];
}

export interface PlanTask {
  /** Stable id = relative source path, used as the manifest key. */
  id: string;
  sourceFile: string;
  relativeSourcePath: string;
  outputTestPath: string;
  relativeOutputPath: string;
  mode: TaskMode;
  existingTestPath?: string;
  analysis: FileAnalysis;
  coverage?: CoverageInfo;
  exampleTest?: { relativePath: string; content: string };
}

export interface Plan {
  tasks: PlanTask[];
}

export interface TaskResult {
  id: string;
  mode: TaskMode;
  status: TaskStatus;
  attempts: number;
  written: boolean;
  outputPath: string;
  errors: string[];
}

export interface RunManifest {
  version: 1;
  createdAt: string;
  updatedAt: string;
  results: Record<string, TaskResult>;
}
