import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('logger', () => {
  let tmpDir: string;
  let logPath: string;

  beforeEach(() => {
    vi.resetModules();
    tmpDir = mkdtempSync(join(tmpdir(), 'supplierio-test-'));
    logPath = join(tmpDir, 'usage.log');
    vi.stubEnv('LOG_PATH', logPath);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('appends a JSON line per log() call', async () => {
    const { log, readLastN } = await import('../logger.js');
    await log({
      timestamp: '2026-01-01T00:00:00Z',
      username: 'alice',
      tool: 'search_suppliers',
      params: { state: 'TX' },
      resultCount: 5,
      latencyMs: 200,
    });
    const entries = await readLastN(10);
    expect(entries).toHaveLength(1);
    expect(entries[0].username).toBe('alice');
    expect(entries[0].resultCount).toBe(5);
    expect(entries[0].params).toEqual({ state: 'TX' });
  });

  it('readLastN returns only the last N entries in order', async () => {
    const { log, readLastN } = await import('../logger.js');
    for (let i = 0; i < 5; i++) {
      await log({
        timestamp: `2026-01-0${i + 1}T00:00:00Z`,
        username: 'bob',
        tool: 'search_suppliers',
        params: {},
        resultCount: i,
        latencyMs: 100,
      });
    }
    const entries = await readLastN(3);
    expect(entries).toHaveLength(3);
    expect(entries[0].resultCount).toBe(2);
    expect(entries[2].resultCount).toBe(4);
  });

  it('readLastN returns empty array when log file does not exist', async () => {
    const { readLastN } = await import('../logger.js');
    const entries = await readLastN(10);
    expect(entries).toEqual([]);
  });

  it('log() does not throw when the log directory does not exist', async () => {
    const { log } = await import('../logger.js');
    await expect(
      log({ timestamp: 'ts', username: 'u', tool: 't', params: {}, resultCount: 0, latencyMs: 0 })
    ).resolves.not.toThrow();
  });
});
