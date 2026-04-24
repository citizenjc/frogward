import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { SeenMailboxState } from '../types/runtime.js';
import type { ForwardedMessageRecord, SeenMessageRecord } from '../types/message.js';

export interface StateSnapshot {
  seen: SeenMessageRecord[];
  forwarded: SeenMailboxState['forwarded'];
  scan: SeenMailboxState['scan'];
}

export interface StateStore {
  load(): Promise<StateSnapshot>;
  save(snapshot: StateSnapshot): Promise<void>;
  hasSeen(id: string): Promise<boolean>;
  markSeen(entry: SeenMessageRecord): Promise<StateSnapshot>;
  markForwarded(entry: ForwardedMessageRecord): Promise<StateSnapshot>;
  hasForwarded(id: string): Promise<boolean>;
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
    async hasSeen(id: string): Promise<boolean> {
      const snapshot = await readSnapshot(path);
      return snapshot.seen.some((entry) => entry.id === id);
    },
    async markSeen(entry: SeenMessageRecord): Promise<StateSnapshot> {
      const snapshot = await readSnapshot(path);

      const existing = snapshot.seen.find((seen) => seen.id === entry.id);
      const nextSeen = existing
        ? snapshot.seen.map((seen) =>
            seen.id === entry.id
              ? {
                  ...seen,
                  lastSeenAt: entry.lastSeenAt,
                  source: entry.source ?? seen.source,
                  confidence: entry.confidence ?? seen.confidence
                }
              : seen
          )
        : [...snapshot.seen, entry];

      const nextSnapshot = {
        ...snapshot,
        seen: nextSeen,
        scan: {
          ...snapshot.scan,
          lastScanAt: entry.lastSeenAt,
          scanCount: snapshot.scan.scanCount + 1
        }
      };

      await ensureDirectory(path);
      await writeSnapshot(path, nextSnapshot);
      return nextSnapshot;
    },
    async markForwarded(entry: ForwardedMessageRecord): Promise<StateSnapshot> {
      const snapshot = await readSnapshot(path);

      const existing = snapshot.forwarded.find((forwarded) => forwarded.id === entry.id);
      const nextForwarded = existing
        ? snapshot.forwarded.map((forwarded) =>
            forwarded.id === entry.id
              ? {
                  ...forwarded,
                  forwardedAt: entry.forwardedAt,
                  destination: entry.destination,
                  status: entry.status,
                  reason: entry.reason ?? forwarded.reason,
                  attempts: Math.max(forwarded.attempts, entry.attempts)
                }
              : forwarded
          )
        : [...snapshot.forwarded, entry];

      const nextSnapshot = {
        ...snapshot,
        forwarded: nextForwarded
      };

      await ensureDirectory(path);
      await writeSnapshot(path, nextSnapshot);
      return nextSnapshot;
    },
    async hasForwarded(id: string): Promise<boolean> {
      const snapshot = await readSnapshot(path);
      return snapshot.forwarded.some(
        (forwarded) => forwarded.id === id && forwarded.status === 'success'
      );
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
      return createEmptySnapshot();
    }

    if (error instanceof SyntaxError) {
      await quarantineCorruptFile(filePath);
      return createEmptySnapshot();
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
  if (Array.isArray(snapshot?.seen) || snapshot?.scan || Array.isArray(snapshot?.forwarded)) {
    return {
      seen: Array.isArray(snapshot?.seen) ? snapshot.seen : [],
      forwarded: Array.isArray(snapshot?.forwarded) ? snapshot.forwarded : [],
      scan: {
        lastScanAt: snapshot?.scan?.lastScanAt,
        bootstrapCompletedAt: snapshot?.scan?.bootstrapCompletedAt,
        scanCount: snapshot?.scan?.scanCount ?? 0,
        lastNewCount: snapshot?.scan?.lastNewCount ?? 0
      }
    };
  }

  if (Array.isArray((snapshot as { processed?: SeenMessageRecord[] } | undefined)?.processed)) {
    const processed = (snapshot as { processed: SeenMessageRecord[] }).processed;
    return {
      seen: processed.map((entry) => ({
        id: entry.id,
        firstSeenAt: (entry as { processedAt?: string }).processedAt ?? new Date(0).toISOString(),
        lastSeenAt: (entry as { processedAt?: string }).processedAt ?? new Date(0).toISOString(),
        source: entry.source,
        confidence: entry.confidence
      })),
      forwarded: [],
      scan: {
        scanCount: 0,
        lastNewCount: 0
      }
    };
  }

  return createEmptySnapshot();
}

function createEmptySnapshot(): StateSnapshot {
  return {
    seen: [],
    forwarded: [],
    scan: {
      scanCount: 0,
      lastNewCount: 0
    }
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
