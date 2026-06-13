import { promises as fs } from 'node:fs';
import path from 'node:path';
import { MANIFEST_FILE_NAME, WEAVER_DIR } from '../config/defaults.js';
import type { RunManifest, TaskResult } from './planner.types.js';

function manifestPath(repoRoot: string): string {
  return path.join(repoRoot, WEAVER_DIR, MANIFEST_FILE_NAME);
}

export async function loadManifest(repoRoot: string): Promise<RunManifest | undefined> {
  try {
    const raw = await fs.readFile(manifestPath(repoRoot), 'utf-8');
    return JSON.parse(raw) as RunManifest;
  } catch {
    return undefined;
  }
}

export function createManifest(): RunManifest {
  const now = new Date().toISOString();
  return { version: 1, createdAt: now, updatedAt: now, results: {} };
}

/** Persist the manifest, updating `updatedAt`. Safe to call after every task for crash-safe resumability. */
export async function saveManifest(repoRoot: string, manifest: RunManifest): Promise<void> {
  manifest.updatedAt = new Date().toISOString();
  const dir = path.join(repoRoot, WEAVER_DIR);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(manifestPath(repoRoot), JSON.stringify(manifest, null, 2), 'utf-8');
}

export function recordTaskResult(manifest: RunManifest, result: TaskResult): void {
  manifest.results[result.id] = result;
}
