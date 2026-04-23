import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createStateStore } from '../../src/modules/state.js';

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function createTempStatePath(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'frogward-state-'));
  createdDirs.push(dir);
  return join(dir, 'nested', 'runtime-state.json');
}

describe('state store', () => {
  it('bootstraps missing state as empty', async () => {
    const store = createStateStore(await createTempStatePath());

    await expect(store.load()).resolves.toEqual({ processed: [] });
  });

  it('creates directories and saves empty state', async () => {
    const filePath = await createTempStatePath();
    const store = createStateStore(filePath);

    await store.save({ processed: [] });

    await expect(readFile(filePath, 'utf8')).resolves.toContain('"processed": []');
  });

  it('ignores duplicate processed ids', async () => {
    const filePath = await createTempStatePath();
    const store = createStateStore(filePath);

    await store.markProcessed({ id: 'msg-1', processedAt: '2026-04-23T00:00:00.000Z' });
    await store.markProcessed({ id: 'msg-1', processedAt: '2026-04-23T00:01:00.000Z' });

    await expect(store.load()).resolves.toEqual({
      processed: [{ id: 'msg-1', processedAt: '2026-04-23T00:00:00.000Z' }]
    });
  });

  it('quarantines corrupt state files and recovers with empty state', async () => {
    const filePath = await createTempStatePath();
    const store = createStateStore(filePath);

    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, '{not-json', 'utf8');

    await expect(store.load()).resolves.toEqual({ processed: [] });
    await expect(readFile(`${filePath}.corrupt`, 'utf8')).resolves.toBe('{not-json');
  });
});
