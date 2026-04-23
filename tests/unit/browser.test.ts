import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createBrowserManager } from '../../src/lib/browser.js';
import { createLogger } from '../../src/lib/logger.js';

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'frogward-browser-'));
  createdDirs.push(dir);
  return dir;
}

describe('browser wrapper', () => {
  it('saves trace and storage through abstraction in scaffold mode', async () => {
    const dir = await createTempDir();
    const tracePath = join(dir, 'trace.zip');
    const storagePath = join(dir, 'session.auth.json');

    const browser = createBrowserManager({
      config: {
        mode: 'scaffold',
        sapoUsername: '',
        sapoPassword: '',
        destinationEmail: undefined,
        pollIntervalMs: 60000,
        headless: true,
        stateFilePath: 'src/state/runtime-state.json',
        storageStatePath: storagePath,
        persistStorageState: true,
        artifactDir: 'tmp/live-artifacts',
        captureScreenshotOnFailure: true,
        captureTraceOnFailure: true,
        logLevel: 'debug'
      },
      logger: createLogger('debug')
    });

    await browser.withSession(async (session) => {
      await session.startTrace('probe-run');
      await session.stopTrace(tracePath);
      await session.saveStorageState(storagePath);
    });

    await expect(readFile(tracePath, 'utf8')).resolves.toContain('stub trace');
    await expect(readFile(storagePath, 'utf8')).resolves.toContain('cookies');
  });

  it('keeps scaffold mode independent from stealth runtime deps', async () => {
    const browser = createBrowserManager({
      config: {
        mode: 'scaffold',
        sapoUsername: '',
        sapoPassword: '',
        destinationEmail: undefined,
        pollIntervalMs: 60000,
        headless: true,
        stateFilePath: 'src/state/runtime-state.json',
        storageStatePath: 'tmp/sapo/session.auth.json',
        persistStorageState: true,
        artifactDir: 'tmp/live-artifacts',
        captureScreenshotOnFailure: true,
        captureTraceOnFailure: true,
        logLevel: 'debug'
      },
      logger: createLogger('debug')
    });

    await expect(browser.withSession(async (session) => session.page.title())).resolves.toBe(
      'frogward-stub'
    );
  });
});
