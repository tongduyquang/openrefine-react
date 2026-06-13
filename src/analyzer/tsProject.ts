import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Project, ts } from 'ts-morph';

const projectCache = new Map<string, Project>();

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Walk up from `filePath` to `repoRoot` looking for the nearest tsconfig.json. */
export async function findNearestTsConfig(filePath: string, repoRoot: string): Promise<string | undefined> {
  let dir = path.dirname(filePath);
  const root = path.resolve(repoRoot);

  while (true) {
    const candidate = path.join(dir, 'tsconfig.json');
    if (await fileExists(candidate)) return candidate;
    if (dir === root) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  const rootConfig = path.join(root, 'tsconfig.json');
  return (await fileExists(rootConfig)) ? rootConfig : undefined;
}

function createFallbackProject(): Project {
  return new Project({
    useInMemoryFileSystem: false,
    skipFileDependencyResolution: true,
    compilerOptions: {
      allowJs: true,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      esModuleInterop: true,
      strict: false,
      skipLibCheck: true,
    },
  });
}

/**
 * Get (or create + cache) a ts-morph Project for analyzing `filePath`,
 * choosing the nearest enclosing tsconfig.json (monorepo-aware). Falls back
 * to an in-memory project with sane TSX defaults if no tsconfig is found.
 */
export async function getProjectForFile(filePath: string, repoRoot: string): Promise<Project> {
  const tsConfigPath = await findNearestTsConfig(filePath, repoRoot);
  const cacheKey = tsConfigPath ?? `__fallback__:${path.resolve(repoRoot)}`;

  const cached = projectCache.get(cacheKey);
  if (cached) return cached;

  const project = tsConfigPath
    ? new Project({ tsConfigFilePath: tsConfigPath, skipAddingFilesFromTsConfig: true, skipFileDependencyResolution: true })
    : createFallbackProject();

  projectCache.set(cacheKey, project);
  return project;
}

/** Clear cached ts-morph Projects (used between test cases). */
export function clearProjectCache(): void {
  projectCache.clear();
}
