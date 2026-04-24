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

    await expect(store.load()).resolves.toEqual({
      seen: [],
      forwarded: [],
      scan: {
        scanCount: 0,
        lastNewCount: 0
      }
    });
  });

  it('creates directories and saves empty state', async () => {
    const filePath = await createTempStatePath();
    const store = createStateStore(filePath);

    await store.save({
      seen: [],
      forwarded: [],
      scan: {
        scanCount: 0,
        lastNewCount: 0
      }
    });

    await expect(readFile(filePath, 'utf8')).resolves.toContain('"seen": []');
  });

  it('updates duplicate seen ids without duplicating state', async () => {
    const filePath = await createTempStatePath();
    const store = createStateStore(filePath);

    await store.markSeen({
      id: 'msg-1',
      firstSeenAt: '2026-04-23T00:00:00.000Z',
      lastSeenAt: '2026-04-23T00:00:00.000Z',
      source: 'sapo-row-id',
      confidence: 'high'
    });
    await store.markSeen({
      id: 'msg-1',
      firstSeenAt: '2026-04-23T00:00:00.000Z',
      lastSeenAt: '2026-04-23T00:01:00.000Z',
      source: 'sapo-row-id',
      confidence: 'high'
    });

    await expect(store.load()).resolves.toEqual({
      seen: [
        {
          id: 'msg-1',
          firstSeenAt: '2026-04-23T00:00:00.000Z',
          lastSeenAt: '2026-04-23T00:01:00.000Z',
          source: 'sapo-row-id',
          confidence: 'high'
        }
      ],
      forwarded: [],
      scan: {
        lastScanAt: '2026-04-23T00:01:00.000Z',
        scanCount: 2,
        lastNewCount: 0
      }
    });
  });

  it('migrates legacy processed shape to seen state', async () => {
    const filePath = await createTempStatePath();
    const store = createStateStore(filePath);

    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(
      filePath,
      JSON.stringify(
        {
          processed: [{ id: 'legacy-1', processedAt: '2026-04-23T00:00:00.000Z' }]
        },
        null,
        2
      ),
      'utf8'
    );

    await expect(store.load()).resolves.toEqual({
      seen: [
        {
          id: 'legacy-1',
          firstSeenAt: '2026-04-23T00:00:00.000Z',
          lastSeenAt: '2026-04-23T00:00:00.000Z',
          source: undefined,
          confidence: undefined
        }
      ],
      forwarded: [],
      scan: {
        scanCount: 0,
        lastNewCount: 0
      }
    });
  });

  it('quarantines corrupt state files and recovers with empty state', async () => {
    const filePath = await createTempStatePath();
    const store = createStateStore(filePath);

    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, '{not-json', 'utf8');

    await expect(store.load()).resolves.toEqual({
      seen: [],
      forwarded: [],
      scan: {
        scanCount: 0,
        lastNewCount: 0
      }
    });
    await expect(readFile(`${filePath}.corrupt`, 'utf8')).resolves.toBe('{not-json');
  });

  it('marks forwarded messages only after explicit success', async () => {
    const filePath = await createTempStatePath();
    const store = createStateStore(filePath);

    await store.markForwarded({
      id: 'msg-2',
      forwardedAt: '2026-04-24T00:00:00.000Z',
      destination: 'dest@example.com',
      status: 'failed',
      reason: 'forward_failed',
      attempts: 1
    });

    await expect(store.hasForwarded('msg-2')).resolves.toBe(false);

    await store.markForwarded({
      id: 'msg-2',
      forwardedAt: '2026-04-24T00:01:00.000Z',
      destination: 'dest@example.com',
      status: 'success',
      attempts: 2
    });

    await expect(store.hasForwarded('msg-2')).resolves.toBe(true);
    await expect(store.load()).resolves.toEqual(
      expect.objectContaining({
        forwarded: [
          expect.objectContaining({
            id: 'msg-2',
            status: 'success',
            attempts: 2
          })
        ]
      })
    );
  });

  it('retains failed forward records as retry-visible attempts until success', async () => {
    const filePath = await createTempStatePath();
    const store = createStateStore(filePath);

    await store.markForwarded({
      id: 'msg-3',
      forwardedAt: '2026-04-24T00:00:00.000Z',
      destination: 'dest@example.com',
      status: 'failed',
      reason: 'send_failed',
      attempts: 1
    });

    await store.markForwarded({
      id: 'msg-3',
      forwardedAt: '2026-04-24T00:01:00.000Z',
      destination: 'dest@example.com',
      status: 'failed',
      reason: 'send_confirmation_missing',
      attempts: 2
    });

    await expect(store.hasForwarded('msg-3')).resolves.toBe(false);
    await expect(store.load()).resolves.toEqual(
      expect.objectContaining({
        forwarded: [
          expect.objectContaining({
            id: 'msg-3',
            status: 'failed',
            reason: 'send_confirmation_missing',
            attempts: 2
          })
        ]
      })
    );
  });
});
