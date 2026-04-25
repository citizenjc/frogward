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
        sapoUsername: '',
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
        sapoUsername: '',
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
        sapoUsername: '',
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
        sapoUsername: '',
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
        sapoUsername: '',
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
        sapoUsername: '',
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
        sapoUsername: '',
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
        sapoUsername: '',
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
        sapoUsername: '',
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
