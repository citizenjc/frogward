import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBrowserManager } from '../../src/lib/browser.js';
import { createLogger } from '../../src/lib/logger.js';

const playwrightMocks = vi.hoisted(() => ({
  launchPersistentContext: vi.fn(),
  use: vi.fn()
}));

vi.mock('playwright-extra', () => ({
  chromium: {
    launchPersistentContext: playwrightMocks.launchPersistentContext,
    use: playwrightMocks.use
  }
}));

vi.mock('puppeteer-extra-plugin-stealth', () => ({
  default: vi.fn(() => ({ name: 'stealth' }))
}));

const createdDirs: string[] = [];

afterEach(async () => {
  vi.clearAllMocks();
  await Promise.all(createdDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'frogward-browser-'));
  createdDirs.push(dir);
  return dir;
}

describe('browser wrapper', () => {
  it('launches live mode with a persistent context and cleans up its profile', async () => {
    const dir = await createTempDir();
    const storagePath = join(dir, 'session.auth.json');
    await writeFile(storagePath, '{"cookies":[],"origins":[]}', 'utf8');

    const close = vi.fn(async () => {});
    const context = {
      newPage: vi.fn(async () => ({})),
      storageState: vi.fn(async () => ({})),
      tracing: {
        start: vi.fn(async () => {}),
        stop: vi.fn(async () => {})
      },
      close
    };
    playwrightMocks.launchPersistentContext.mockResolvedValueOnce(context);

    const browser = createBrowserManager({
      config: {
        mode: 'live',
        sapoEmail: '',
        sapoPassword: '',
        destinationEmail: undefined,
        pollIntervalMs: 60000,
        pollErrorBackoffMs: 5000,
        headless: true,
        stateFilePath: 'tmp/sapo/runtime-state.json',
        storageStatePath: storagePath,
        persistStorageState: true,
        artifactDir: 'tmp/live-artifacts',
        captureScreenshotOnFailure: true,
        captureTraceOnFailure: true,
        forwardingEnabled: false,
        forwardAllowSenderPatterns: [],
        forwardBlockSenderPatterns: [],
        forwardAllowSubjectPatterns: [],
        forwardBlockSubjectPatterns: [],
        logLevel: 'debug'
      },
      logger: createLogger('debug')
    });

    await expect(browser.withSession(async (session) => session.usingStorageState)).resolves.toBe(
      true
    );

    expect(playwrightMocks.launchPersistentContext).toHaveBeenCalledOnce();
    const [userDataDir, options] = playwrightMocks.launchPersistentContext.mock.calls[0];
    expect(userDataDir).toMatch(/frogward-/);
    expect(options).toMatchObject({
      headless: true,
      storageState: storagePath
    });
    expect(options.args).not.toEqual(
      expect.arrayContaining([expect.stringContaining('--user-data-dir')])
    );
    expect(close).toHaveBeenCalledOnce();
    await expect(access(userDataDir)).rejects.toThrow();
  });

  it('saves trace and storage through abstraction in scaffold mode', async () => {
    const dir = await createTempDir();
    const tracePath = join(dir, 'trace.zip');
    const storagePath = join(dir, 'session.auth.json');

    const browser = createBrowserManager({
      config: {
        mode: 'scaffold',
        sapoEmail: '',
        sapoPassword: '',
        destinationEmail: undefined,
        pollIntervalMs: 60000,
        pollErrorBackoffMs: 5000,
        headless: true,
        stateFilePath: 'tmp/sapo/runtime-state.json',
        storageStatePath: storagePath,
        persistStorageState: true,
        artifactDir: 'tmp/live-artifacts',
        captureScreenshotOnFailure: true,
        captureTraceOnFailure: true,
        forwardingEnabled: false,
        forwardAllowSenderPatterns: [],
        forwardBlockSenderPatterns: [],
        forwardAllowSubjectPatterns: [],
        forwardBlockSubjectPatterns: [],
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
        sapoEmail: '',
        sapoPassword: '',
        destinationEmail: undefined,
        pollIntervalMs: 60000,
        pollErrorBackoffMs: 5000,
        headless: true,
        stateFilePath: 'tmp/sapo/runtime-state.json',
        storageStatePath: 'tmp/sapo/session.auth.json',
        persistStorageState: true,
        artifactDir: 'tmp/live-artifacts',
        captureScreenshotOnFailure: true,
        captureTraceOnFailure: true,
        forwardingEnabled: false,
        forwardAllowSenderPatterns: [],
        forwardBlockSenderPatterns: [],
        forwardAllowSubjectPatterns: [],
        forwardBlockSubjectPatterns: [],
        logLevel: 'debug'
      },
      logger: createLogger('debug')
    });

    await expect(browser.withSession(async (session) => session.page.title())).resolves.toBe(
      'frogward-stub'
    );
  });

  it('provides read-only list extraction seam in scaffold mode', async () => {
    const browser = createBrowserManager({
      config: {
        mode: 'scaffold',
        sapoEmail: '',
        sapoPassword: '',
        destinationEmail: undefined,
        pollIntervalMs: 60000,
        pollErrorBackoffMs: 5000,
        headless: true,
        stateFilePath: 'tmp/sapo/runtime-state.json',
        storageStatePath: 'tmp/sapo/session.auth.json',
        persistStorageState: true,
        artifactDir: 'tmp/live-artifacts',
        captureScreenshotOnFailure: true,
        captureTraceOnFailure: true,
        forwardingEnabled: false,
        forwardAllowSenderPatterns: [],
        forwardBlockSenderPatterns: [],
        forwardAllowSubjectPatterns: [],
        forwardBlockSubjectPatterns: [],
        logLevel: 'debug'
      },
      logger: createLogger('debug')
    });

    await expect(
      browser.withSession(async (session) =>
        session.page.visibleListHtml('[data-test="inbox-list"]')
      )
    ).resolves.toContain('mail-item');
  });

  it('supports clickFirst selector fallback helper', async () => {
    const browser = createBrowserManager({
      config: {
        mode: 'scaffold',
        sapoEmail: '',
        sapoPassword: '',
        destinationEmail: undefined,
        pollIntervalMs: 60000,
        pollErrorBackoffMs: 5000,
        headless: true,
        stateFilePath: 'tmp/sapo/runtime-state.json',
        storageStatePath: 'tmp/sapo/session.auth.json',
        persistStorageState: true,
        artifactDir: 'tmp/live-artifacts',
        captureScreenshotOnFailure: true,
        captureTraceOnFailure: true,
        forwardingEnabled: false,
        forwardAllowSenderPatterns: [],
        forwardBlockSenderPatterns: [],
        forwardAllowSubjectPatterns: [],
        forwardBlockSubjectPatterns: [],
        logLevel: 'debug'
      },
      logger: createLogger('debug')
    });

    await expect(
      browser.withSession(async (session) =>
        session.page.clickFirst(['button[data-test="forward"]', 'a[data-action="forward"]'])
      )
    ).resolves.toBe(true);
  });

  it('supports waiting for first matching selector', async () => {
    const browser = createBrowserManager({
      config: {
        mode: 'scaffold',
        sapoEmail: '',
        sapoPassword: '',
        destinationEmail: undefined,
        pollIntervalMs: 60000,
        pollErrorBackoffMs: 5000,
        headless: true,
        stateFilePath: 'tmp/sapo/runtime-state.json',
        storageStatePath: 'tmp/sapo/session.auth.json',
        persistStorageState: true,
        artifactDir: 'tmp/live-artifacts',
        captureScreenshotOnFailure: true,
        captureTraceOnFailure: true,
        forwardingEnabled: false,
        forwardAllowSenderPatterns: [],
        forwardBlockSenderPatterns: [],
        forwardAllowSubjectPatterns: [],
        forwardBlockSubjectPatterns: [],
        logLevel: 'debug'
      },
      logger: createLogger('debug')
    });

    await expect(
      browser.withSession(async (session) =>
        session.page.waitForAnySelector(['button[data-test="send"]', 'button[type="submit"]'])
      )
    ).resolves.toBe('button[data-test="send"]');
  });

  it('supports text-based click fallback helpers', async () => {
    const browser = createBrowserManager({
      config: {
        mode: 'scaffold',
        sapoEmail: '',
        sapoPassword: '',
        destinationEmail: undefined,
        pollIntervalMs: 60000,
        pollErrorBackoffMs: 5000,
        headless: true,
        stateFilePath: 'tmp/sapo/runtime-state.json',
        storageStatePath: 'tmp/sapo/session.auth.json',
        persistStorageState: true,
        artifactDir: 'tmp/live-artifacts',
        captureScreenshotOnFailure: true,
        captureTraceOnFailure: true,
        forwardingEnabled: false,
        forwardAllowSenderPatterns: [],
        forwardBlockSenderPatterns: [],
        forwardAllowSubjectPatterns: [],
        forwardBlockSubjectPatterns: [],
        logLevel: 'debug'
      },
      logger: createLogger('debug')
    });

    await expect(
      browser.withSession(async (session) =>
        session.page.clickFirstByText(['Encaminhar', 'Forward'])
      )
    ).resolves.toBe('Encaminhar');
  });

  it('supports content marker checks without exposing raw page', async () => {
    const browser = createBrowserManager({
      config: {
        mode: 'scaffold',
        sapoEmail: '',
        sapoPassword: '',
        destinationEmail: undefined,
        pollIntervalMs: 60000,
        pollErrorBackoffMs: 5000,
        headless: true,
        stateFilePath: 'tmp/sapo/runtime-state.json',
        storageStatePath: 'tmp/sapo/session.auth.json',
        persistStorageState: true,
        artifactDir: 'tmp/live-artifacts',
        captureScreenshotOnFailure: true,
        captureTraceOnFailure: true,
        forwardingEnabled: false,
        forwardAllowSenderPatterns: [],
        forwardBlockSenderPatterns: [],
        forwardAllowSubjectPatterns: [],
        forwardBlockSubjectPatterns: [],
        logLevel: 'debug'
      },
      logger: createLogger('debug')
    });

    await expect(
      browser.withSession(async (session) =>
        session.page.contentIncludesAny(['stub page', 'Message sent'])
      )
    ).resolves.toBe(true);
  });

  it('supports reading compose field values for recipient verification', async () => {
    const browser = createBrowserManager({
      config: {
        mode: 'scaffold',
        sapoEmail: '',
        sapoPassword: '',
        destinationEmail: undefined,
        pollIntervalMs: 60000,
        pollErrorBackoffMs: 5000,
        headless: true,
        stateFilePath: 'tmp/sapo/runtime-state.json',
        storageStatePath: 'tmp/sapo/session.auth.json',
        persistStorageState: true,
        artifactDir: 'tmp/live-artifacts',
        captureScreenshotOnFailure: true,
        captureTraceOnFailure: true,
        forwardingEnabled: false,
        forwardAllowSenderPatterns: [],
        forwardBlockSenderPatterns: [],
        forwardAllowSubjectPatterns: [],
        forwardBlockSubjectPatterns: [],
        logLevel: 'debug'
      },
      logger: createLogger('debug')
    });

    await expect(
      browser.withSession(async (session) =>
        session.page.readFieldValue('input[data-test="forward-recipient"]')
      )
    ).resolves.toBeUndefined();
  });

  it('supports reading inner html for recipient chip verification', async () => {
    const browser = createBrowserManager({
      config: {
        mode: 'scaffold',
        sapoEmail: '',
        sapoPassword: '',
        destinationEmail: undefined,
        pollIntervalMs: 60000,
        pollErrorBackoffMs: 5000,
        headless: true,
        stateFilePath: 'tmp/sapo/runtime-state.json',
        storageStatePath: 'tmp/sapo/session.auth.json',
        persistStorageState: true,
        artifactDir: 'tmp/live-artifacts',
        captureScreenshotOnFailure: true,
        captureTraceOnFailure: true,
        forwardingEnabled: false,
        forwardAllowSenderPatterns: [],
        forwardBlockSenderPatterns: [],
        forwardAllowSubjectPatterns: [],
        forwardBlockSubjectPatterns: [],
        logLevel: 'debug'
      },
      logger: createLogger('debug')
    });

    await expect(
      browser.withSession(async (session) => session.page.readInnerHtml('.recipents-list'))
    ).resolves.toBeUndefined();
  });

  it('supports keyboard key presses for compose commit flows', async () => {
    const browser = createBrowserManager({
      config: {
        mode: 'scaffold',
        sapoEmail: '',
        sapoPassword: '',
        destinationEmail: undefined,
        pollIntervalMs: 60000,
        pollErrorBackoffMs: 5000,
        headless: true,
        stateFilePath: 'tmp/sapo/runtime-state.json',
        storageStatePath: 'tmp/sapo/session.auth.json',
        persistStorageState: true,
        artifactDir: 'tmp/live-artifacts',
        captureScreenshotOnFailure: true,
        captureTraceOnFailure: true,
        forwardingEnabled: false,
        forwardAllowSenderPatterns: [],
        forwardBlockSenderPatterns: [],
        forwardAllowSubjectPatterns: [],
        forwardBlockSubjectPatterns: [],
        logLevel: 'debug'
      },
      logger: createLogger('debug')
    });

    await expect(
      browser.withSession(async (session) => session.page.pressKey('Enter'))
    ).resolves.toBeUndefined();
  });
});
