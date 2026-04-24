import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../../src/app.js';
import type { AppConfig } from '../../src/config/schema.js';

function createLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  };
}

function createConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    mode: 'scaffold',
    sapoUsername: '',
    sapoPassword: '',
    destinationEmail: 'dest@example.com',
    pollIntervalMs: 60000,
    pollErrorBackoffMs: 5000,
    headless: true,
    stateFilePath: 'src/state/runtime-state.json',
    storageStatePath: undefined,
    persistStorageState: false,
    artifactDir: 'tmp/live-artifacts',
    captureScreenshotOnFailure: true,
    captureTraceOnFailure: true,
    forwardingEnabled: true,
    forwardingAck: true,
    forwardingWarpToken: 'warp-ok',
    forwardAllowSenderPatterns: [],
    forwardBlockSenderPatterns: [],
    forwardAllowSubjectPatterns: [],
    forwardBlockSubjectPatterns: [],
    logLevel: 'info',
    ...overrides
  };
}

function createPage(overrides: Record<string, unknown> = {}) {
  return {
    goto: vi.fn().mockResolvedValue(null),
    fill: vi.fn().mockResolvedValue(undefined),
    pressKey: vi.fn().mockResolvedValue(undefined),
    readFieldValue: vi.fn().mockResolvedValue('dest@example.com'),
    readInnerHtml: vi.fn().mockResolvedValue(undefined),
    click: vi.fn().mockResolvedValue(undefined),
    clickFirst: vi.fn().mockResolvedValue(true),
    clickFirstByText: vi.fn().mockResolvedValue(undefined),
    waitForAnySelector: vi.fn().mockImplementation(async (selectors: string[]) => {
      if (selectors.includes('input[data-test="forward-recipient"]')) {
        return 'input[data-test="forward-recipient"]';
      }

      if (selectors.includes('[role="status"]')) {
        return '[role="status"]';
      }

      return selectors[0];
    }),
    waitForSelector: vi.fn().mockResolvedValue(true),
    isVisible: vi.fn().mockResolvedValue(true),
    url: vi.fn().mockReturnValue('https://mail.sapo.pt/v7/#/messages/SU5CT1g'),
    title: vi.fn().mockResolvedValue('Inbox'),
    screenshot: vi.fn().mockResolvedValue('tmp/live-artifacts/app.png'),
    content: vi.fn().mockResolvedValue('<html></html>'),
    contentIncludesAny: vi.fn().mockResolvedValue(false),
    visibleListHtml: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

function createBrowser(page: Record<string, unknown>) {
  return {
    withSession: vi.fn(async (callback) =>
      callback({
        usingStorageState: false,
        startTrace: vi.fn().mockResolvedValue(undefined),
        stopTrace: vi.fn().mockResolvedValue(undefined),
        saveStorageState: vi.fn().mockResolvedValue(undefined),
        page
      })
    )
  };
}

function createState(overrides: Record<string, unknown> = {}) {
  return {
    load: vi.fn().mockResolvedValue({
      seen: [],
      forwarded: [],
      scan: { scanCount: 0, lastNewCount: 0 }
    }),
    save: vi.fn().mockResolvedValue(undefined),
    hasSeen: vi.fn().mockResolvedValue(false),
    markSeen: vi
      .fn()
      .mockResolvedValue({ seen: [], forwarded: [], scan: { scanCount: 0, lastNewCount: 0 } }),
    markForwarded: vi
      .fn()
      .mockResolvedValue({ seen: [], forwarded: [], scan: { scanCount: 0, lastNewCount: 0 } }),
    hasForwarded: vi.fn().mockResolvedValue(false),
    ...overrides
  };
}

describe('app forwarding orchestration', () => {
  it('keeps once mode read-only and never calls forward persistence', async () => {
    const logger = createLogger();
    const browser = createBrowser(createPage());
    const state = createState();

    const app = createApp({
      config: createConfig(),
      logger,
      browser,
      state
    });

    await app.run({ mode: 'once', safetyLevel: 'probe' });

    expect(state.markForwarded).not.toHaveBeenCalled();
  });

  it('records filtered forward outcomes without forwarding success', async () => {
    const logger = createLogger();
    const page = createPage({
      visibleListHtml: vi
        .fn()
        .mockResolvedValue(
          '<div class="mail-item" data-message-id="m-1"><span class="from">Banco BPI</span><span class="subject">Mensagem importante</span><span class="datetime">Hoje</span></div>'
        )
    });
    const browser = createBrowser(page);
    const state = createState({
      load: vi.fn().mockResolvedValue({
        seen: [
          {
            id: 'old-seen',
            firstSeenAt: '2026-04-24T00:00:00.000Z',
            lastSeenAt: '2026-04-24T00:00:00.000Z',
            source: 'sapo-row-id',
            confidence: 'high'
          }
        ],
        forwarded: [],
        scan: {
          scanCount: 1,
          lastNewCount: 0,
          lastScanAt: '2026-04-24T00:00:00.000Z',
          bootstrapCompletedAt: '2026-04-24T00:00:00.000Z'
        }
      })
    });

    const app = createApp({
      config: createConfig({ forwardAllowSenderPatterns: ['revolut'] }),
      logger,
      browser,
      state
    });

    await app.run({ mode: 'forward-new', safetyLevel: 'forward' });

    expect(state.markForwarded).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'm-1', status: 'filtered', reason: 'sender_not_allowed' })
    );
    expect(page.fill).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      'app.forward.complete',
      expect.objectContaining({
        candidateCount: 1,
        filteredCount: 1,
        successCount: 0,
        failedCount: 0
      })
    );
  });

  it('persists successful forward outcomes with incremented attempts', async () => {
    const logger = createLogger();
    const page = createPage({
      visibleListHtml: vi
        .fn()
        .mockResolvedValue(
          '<div class="mail-item" data-message-id="m-2"><span class="from">Revolut</span><span class="subject">Pagamento aprovado</span><span class="datetime">Hoje</span></div>'
        )
    });
    const browser = createBrowser(page);
    const state = createState({
      load: vi.fn().mockResolvedValue({
        seen: [
          {
            id: 'old-seen',
            firstSeenAt: '2026-04-24T00:00:00.000Z',
            lastSeenAt: '2026-04-24T00:00:00.000Z',
            source: 'sapo-row-id',
            confidence: 'high'
          }
        ],
        forwarded: [
          {
            id: 'm-2',
            forwardedAt: '2026-04-24T00:00:00.000Z',
            destination: 'dest@example.com',
            status: 'failed',
            reason: 'send_failed',
            attempts: 1
          }
        ],
        scan: {
          scanCount: 1,
          lastNewCount: 0,
          lastScanAt: '2026-04-24T00:00:00.000Z',
          bootstrapCompletedAt: '2026-04-24T00:00:00.000Z'
        }
      })
    });

    const app = createApp({
      config: createConfig({ forwardAllowSenderPatterns: ['revolut'] }),
      logger,
      browser,
      state
    });

    await app.run({ mode: 'forward-new', safetyLevel: 'forward' });

    expect(state.markForwarded).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'm-2', status: 'success', attempts: 2 })
    );
    expect(logger.info).toHaveBeenCalledWith(
      'app.forward.complete',
      expect.objectContaining({
        candidateCount: 1,
        filteredCount: 0,
        successCount: 1,
        failedCount: 0
      })
    );
  });

  it('persists failed forward outcomes while keeping them retry-visible', async () => {
    const logger = createLogger();
    const page = createPage({
      visibleListHtml: vi
        .fn()
        .mockResolvedValue(
          '<div class="mail-item" data-message-id="m-3"><span class="from">Revolut</span><span class="subject">Pagamento aprovado</span><span class="datetime">Hoje</span></div>'
        ),
      waitForAnySelector: vi.fn().mockImplementation(async (selectors: string[]) => {
        if (selectors.includes('input[data-test="forward-recipient"]')) {
          return 'input[data-test="forward-recipient"]';
        }

        if (selectors.includes('[role="status"]')) {
          return undefined;
        }

        if (selectors.includes('.toast-error')) {
          return '.toast-error';
        }

        return selectors[0];
      }),
      contentIncludesAny: vi.fn().mockResolvedValue(false)
    });
    const browser = createBrowser(page);
    const state = createState({
      load: vi.fn().mockResolvedValue({
        seen: [
          {
            id: 'old-seen',
            firstSeenAt: '2026-04-24T00:00:00.000Z',
            lastSeenAt: '2026-04-24T00:00:00.000Z',
            source: 'sapo-row-id',
            confidence: 'high'
          }
        ],
        forwarded: [
          {
            id: 'm-3',
            forwardedAt: '2026-04-24T00:00:00.000Z',
            destination: 'dest@example.com',
            status: 'failed',
            reason: 'submit_not_found',
            attempts: 1
          }
        ],
        scan: {
          scanCount: 1,
          lastNewCount: 0,
          lastScanAt: '2026-04-24T00:00:00.000Z',
          bootstrapCompletedAt: '2026-04-24T00:00:00.000Z'
        }
      })
    });

    const app = createApp({
      config: createConfig({ forwardAllowSenderPatterns: ['revolut'] }),
      logger,
      browser,
      state
    });

    await app.run({ mode: 'forward-new', safetyLevel: 'forward' });

    expect(state.markForwarded).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'm-3', status: 'failed', reason: 'send_failed', attempts: 2 })
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'app.forward.failed',
      expect.objectContaining({ messageId: 'm-3', reason: 'send_failed', stage: 'confirm' })
    );
    expect(logger.info).toHaveBeenCalledWith(
      'app.forward.complete',
      expect.objectContaining({
        candidateCount: 1,
        filteredCount: 0,
        successCount: 0,
        failedCount: 1
      })
    );
  });
});
