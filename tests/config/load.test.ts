import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ConfigError, loadConfig } from '../../src/config/load.js';
import { CONFIG_FILE_NAME } from '../../src/config/defaults.js';
import type { CliOptions } from '../../src/config/schema.js';

describe('loadConfig provider/model resolution', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'weaver-config-'));
    // Make resolution deterministic regardless of the host environment.
    vi.stubEnv('WEAVER_PROVIDER', undefined as unknown as string);
    vi.stubEnv('WEAVER_MODEL', undefined as unknown as string);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('defaults to the anthropic provider and its default model', async () => {
    const config = await loadConfig({ repo: tmpDir } as CliOptions);
    expect(config.provider).toBe('anthropic');
    expect(config.model).toBe('claude-sonnet-4-6');
  });

  it('selects the github provider and its default model via --provider', async () => {
    const config = await loadConfig({ repo: tmpDir, provider: 'github' } as CliOptions);
    expect(config.provider).toBe('github');
    expect(config.model).toBe('openai/gpt-4o');
  });

  it('keeps an explicit --model over the provider default', async () => {
    const config = await loadConfig({
      repo: tmpDir,
      provider: 'github',
      model: 'meta/Llama-3.3-70B-Instruct',
    } as CliOptions);
    expect(config.provider).toBe('github');
    expect(config.model).toBe('meta/Llama-3.3-70B-Instruct');
  });

  it('reads provider from .weaverc.json when no CLI flag is given', async () => {
    await fs.writeFile(
      path.join(tmpDir, CONFIG_FILE_NAME),
      JSON.stringify({ provider: 'github' }),
      'utf-8',
    );
    const config = await loadConfig({ repo: tmpDir } as CliOptions);
    expect(config.provider).toBe('github');
    expect(config.model).toBe('openai/gpt-4o');
  });

  it('lets --provider override .weaverc.json', async () => {
    await fs.writeFile(
      path.join(tmpDir, CONFIG_FILE_NAME),
      JSON.stringify({ provider: 'github' }),
      'utf-8',
    );
    const config = await loadConfig({ repo: tmpDir, provider: 'anthropic' } as CliOptions);
    expect(config.provider).toBe('anthropic');
  });

  it('throws a ConfigError for an unknown provider', async () => {
    await expect(loadConfig({ repo: tmpDir, provider: 'openai' } as CliOptions)).rejects.toBeInstanceOf(
      ConfigError,
    );
  });

  it('reads provider from the WEAVER_PROVIDER env var', async () => {
    vi.stubEnv('WEAVER_PROVIDER', 'github');
    const config = await loadConfig({ repo: tmpDir } as CliOptions);
    expect(config.provider).toBe('github');
  });
});
