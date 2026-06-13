import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execa } from 'execa';
import { getChangedFiles } from '../../src/scanner/gitDiffScanner.js';

async function git(cwd: string, args: string[]): Promise<void> {
  await execa('git', args, { cwd });
}

describe('getChangedFiles', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'weaver-test-'));

    await git(tmpDir, ['init']);
    await fs.writeFile(path.join(tmpDir, 'README.md'), '# init\n', 'utf-8');
    await git(tmpDir, ['add', '.']);
    await git(tmpDir, [
      '-c',
      'user.email=test@example.com',
      '-c',
      'user.name=Test',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '-m',
      'init',
    ]);

    // Mark current HEAD as 'base' without switching off it.
    await git(tmpDir, ['branch', 'base']);
    await git(tmpDir, ['checkout', '-b', 'feature']);

    // Add and commit a new file on the feature branch.
    await fs.mkdir(path.join(tmpDir, 'src'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'src', 'NewFile.ts'), 'export const x = 1;\n', 'utf-8');
    await git(tmpDir, ['add', '.']);
    await git(tmpDir, [
      '-c',
      'user.email=test@example.com',
      '-c',
      'user.name=Test',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '-m',
      'add NewFile',
    ]);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns the repo-relative path of a changed file compared to base', async () => {
    const result = await getChangedFiles(tmpDir, 'base');
    expect(result).toContain('src/NewFile.ts');
  });

  it('rejects when the base ref does not exist', async () => {
    await expect(getChangedFiles(tmpDir, 'nonexistent-ref')).rejects.toThrow();
  });
});
