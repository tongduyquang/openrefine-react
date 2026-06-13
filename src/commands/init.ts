import { promises as fs } from 'node:fs';
import path from 'node:path';
import { CONFIG_FILE_NAME, DEFAULT_INCLUDE } from '../config/defaults.js';
import { detectConventions } from '../conventions/detectConventions.js';
import { Logger } from '../utils/logger.js';

export interface InitOptions {
  repo: string;
  yes?: boolean;
}

/** Detect conventions and write `.weaverc.json` (+ add `.weaver/` to .gitignore) in the target repo. */
export async function runInit(options: InitOptions): Promise<void> {
  const repoRoot = path.resolve(options.repo ?? '.');
  const logger = new Logger('normal');

  const configPath = path.join(repoRoot, CONFIG_FILE_NAME);
  const alreadyExists = await fs
    .access(configPath)
    .then(() => true)
    .catch(() => false);

  if (alreadyExists && !options.yes) {
    logger.warn(`${CONFIG_FILE_NAME} already exists at ${configPath}; not overwriting (pass --yes to overwrite).`);
    return;
  }

  const conventions = await detectConventions(repoRoot);

  const config = {
    include: DEFAULT_INCLUDE,
    conventions: {
      framework: conventions.framework,
      testFileSuffix: conventions.testFileSuffix,
      testLocation: conventions.testLocation,
      ...(conventions.testsRootDir ? { testsRootDir: conventions.testsRootDir } : {}),
      srcRootDir: conventions.srcRootDir,
      usesReactTestingLibrary: conventions.usesReactTestingLibrary,
      usesMsw: conventions.usesMsw,
      usesJestDom: conventions.usesJestDom,
    },
  };

  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf-8');
  logger.success(`Wrote ${CONFIG_FILE_NAME}`);

  const gitignorePath = path.join(repoRoot, '.gitignore');
  const entry = '.weaver/';
  try {
    const content = await fs.readFile(gitignorePath, 'utf-8');
    if (!content.split('\n').some((line) => line.trim() === entry)) {
      await fs.appendFile(gitignorePath, `${content.endsWith('\n') ? '' : '\n'}${entry}\n`, 'utf-8');
      logger.success(`Added "${entry}" to .gitignore`);
    }
  } catch {
    await fs.writeFile(gitignorePath, `${entry}\n`, 'utf-8');
    logger.success(`Created .gitignore with "${entry}"`);
  }
}
