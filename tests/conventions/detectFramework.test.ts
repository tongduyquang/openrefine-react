import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { detectFramework, getTestCommand } from '../../src/conventions/detectFramework.js';

describe('detectFramework', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'weaver-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function writePackageJson(content: unknown): Promise<void> {
    await fs.writeFile(path.join(tmpDir, 'package.json'), JSON.stringify(content, null, 2), 'utf-8');
  }

  it('detects vitest when "vitest" is a dependency', async () => {
    await writePackageJson({ devDependencies: { vitest: '^4.0.0' } });
    expect(await detectFramework(tmpDir)).toBe('vitest');
  });

  it('detects jest when "jest" is a dependency and vitest is absent', async () => {
    await writePackageJson({ devDependencies: { jest: '^29.0.0' } });
    expect(await detectFramework(tmpDir)).toBe('jest');
  });

  it('detects jest from scripts.test containing "jest" with no relevant deps or configs', async () => {
    await writePackageJson({ scripts: { test: 'jest --runInBand' } });
    expect(await detectFramework(tmpDir)).toBe('jest');
  });

  it('detects vitest when a vitest.config.ts file is present with no relevant deps', async () => {
    await writePackageJson({});
    await fs.writeFile(path.join(tmpDir, 'vitest.config.ts'), 'export default {}\n', 'utf-8');
    expect(await detectFramework(tmpDir)).toBe('vitest');
  });

  it('detects jest when a jest.config.js file is present', async () => {
    await writePackageJson({});
    await fs.writeFile(path.join(tmpDir, 'jest.config.js'), 'module.exports = {}\n', 'utf-8');
    expect(await detectFramework(tmpDir)).toBe('jest');
  });

  it('defaults to vitest when nothing is present', async () => {
    expect(await detectFramework(tmpDir)).toBe('vitest');
  });

  it('prefers vitest when both vitest and jest deps are present', async () => {
    await writePackageJson({ devDependencies: { vitest: '^4.0.0', jest: '^29.0.0' } });
    expect(await detectFramework(tmpDir)).toBe('vitest');
  });
});

describe('getTestCommand', () => {
  it('returns the jest CI command for jest', () => {
    expect(getTestCommand('jest')).toEqual(['npx', 'jest', '--ci']);
  });

  it('returns the vitest run command for vitest', () => {
    expect(getTestCommand('vitest')).toEqual(['npx', 'vitest', 'run']);
  });
});
