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

/**
 * Run a command in `cwd` with a timeout, never throwing on non-zero exit.
 * Strips ANTHROPIC_API_KEY from the child's env so AI credentials are never
 * passed to a target repo's tooling (tsc/test runner/git).
 */
export async function runCommand(
  command: string,
  args: string[],
  options: RunCommandOptions,
): Promise<ExecResult> {
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;

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
