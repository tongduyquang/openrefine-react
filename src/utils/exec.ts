import { execa } from 'execa';

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export interface RunCommandOptions {
  cwd: string;
  timeoutMs?: number;
  args?: string[];
}

/** AI-provider credentials that must never reach a target repo's tooling. */
const SENSITIVE_ENV_KEYS = ['ANTHROPIC_API_KEY', 'GITHUB_MODELS_TOKEN', 'GITHUB_TOKEN'];

/**
 * Run a command in `cwd` with a timeout, never throwing on non-zero exit.
 * Strips AI-provider credentials from the child's env so they are never
 * passed to a target repo's tooling (tsc/test runner/git).
 */
export async function runCommand(
  command: string,
  args: string[],
  options: RunCommandOptions,
): Promise<ExecResult> {
  const env = { ...process.env };
  for (const key of SENSITIVE_ENV_KEYS) {
    delete env[key];
  }

  try {
    const result = await execa(command, args, {
      cwd: options.cwd,
      timeout: options.timeoutMs ?? 60_000,
      reject: false,
      env,
    });

    return {
      exitCode: result.exitCode ?? (result.failed ? 1 : 0),
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
      timedOut: result.timedOut ?? false,
    };
  } catch (error) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: error instanceof Error ? error.message : String(error),
      timedOut: false,
    };
  }
}
