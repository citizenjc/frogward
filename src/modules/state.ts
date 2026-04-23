import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { MessageState } from '../types/message.js';

export interface StateSnapshot {
  processed: MessageState[];
}

export interface StateStore {
  load(): Promise<StateSnapshot>;
  save(snapshot: StateSnapshot): Promise<void>;
  hasProcessed(id: string): Promise<boolean>;
  markProcessed(entry: MessageState): Promise<StateSnapshot>;
}

export function createStateStore(filePath: string): StateStore {
  const path = filePath;

  return {
    async load(): Promise<StateSnapshot> {
      return readSnapshot(path);
    },
    async save(snapshot: StateSnapshot): Promise<void> {
      await ensureDirectory(path);
      await writeSnapshot(path, normalizeSnapshot(snapshot));
    },
    async hasProcessed(id: string): Promise<boolean> {
      const snapshot = await readSnapshot(path);
      return snapshot.processed.some((entry) => entry.id === id);
    },
    async markProcessed(entry: MessageState): Promise<StateSnapshot> {
      const snapshot = await readSnapshot(path);

      if (snapshot.processed.some((existing) => existing.id === entry.id)) {
        return snapshot;
      }

      const nextSnapshot = {
        processed: [...snapshot.processed, entry]
      };

      await ensureDirectory(path);
      await writeSnapshot(path, nextSnapshot);
      return nextSnapshot;
    }
  };
}

async function readSnapshot(filePath: string): Promise<StateSnapshot> {
  try {
    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<StateSnapshot>;
    return normalizeSnapshot(parsed);
  } catch (error) {
    if (isMissingFile(error)) {
      return { processed: [] };
    }

    if (error instanceof SyntaxError) {
      await quarantineCorruptFile(filePath);
      return { processed: [] };
    }

    throw error;
  }
}

async function ensureDirectory(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
}

async function writeSnapshot(filePath: string, snapshot: StateSnapshot): Promise<void> {
  const temporaryPath = `${filePath}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(snapshot, null, 2), 'utf8');
  await rename(temporaryPath, filePath);
}

function normalizeSnapshot(snapshot: Partial<StateSnapshot> | undefined): StateSnapshot {
  return {
    processed: Array.isArray(snapshot?.processed) ? snapshot.processed : []
  };
}

function isMissingFile(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

async function quarantineCorruptFile(filePath: string): Promise<void> {
  try {
    await stat(filePath);
  } catch (error) {
    if (isMissingFile(error)) {
      return;
    }

    throw error;
  }

  await rm(`${filePath}.corrupt`, { force: true });
  await rename(filePath, `${filePath}.corrupt`);
}
