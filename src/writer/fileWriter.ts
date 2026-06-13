import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createTwoFilesPatch } from 'diff';

export async function readFileIfExists(filePath: string): Promise<string | undefined> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return undefined;
  }
}

/** Write `content` to `filePath`, creating parent directories as needed. */
export async function writeTestFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const normalized = content.endsWith('\n') ? content : `${content}\n`;
  await fs.writeFile(filePath, normalized, 'utf-8');
}

/** Build a unified diff for `--dry-run` previews. `before === undefined` means "new file". */
export function buildDiff(relativePath: string, before: string | undefined, after: string): string {
  return createTwoFilesPatch(
    before === undefined ? '/dev/null' : `a/${relativePath}`,
    `b/${relativePath}`,
    before ?? '',
    after.endsWith('\n') ? after : `${after}\n`,
    '',
    '',
    { context: 3 },
  );
}
