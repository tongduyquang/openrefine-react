import pc from 'picocolors';

export type LogLevel = 'quiet' | 'normal' | 'verbose';

export class Logger {
  constructor(private readonly level: LogLevel = 'normal') {}

  step(message: string): void {
    if (this.level === 'quiet') return;
    console.log(`${pc.cyan('->')} ${message}`);
  }

  info(message: string): void {
    if (this.level === 'quiet') return;
    console.log(message);
  }

  success(message: string): void {
    if (this.level === 'quiet') return;
    console.log(`${pc.green('OK')} ${message}`);
  }

  warn(message: string): void {
    console.warn(`${pc.yellow('!!')} ${message}`);
  }

  error(message: string): void {
    console.error(`${pc.red('XX')} ${message}`);
  }

  verbose(message: string): void {
    if (this.level !== 'verbose') return;
    console.log(pc.dim(message));
  }

  isVerbose(): boolean {
    return this.level === 'verbose';
  }
}
