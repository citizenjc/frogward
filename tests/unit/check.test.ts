import { describe, expect, it, vi } from 'vitest';

import { ModuleError } from '../../src/lib/errors.js';
import { checkInbox } from '../../src/modules/check.js';

describe('check module', () => {
  it('reports inbox probe summary without message actions', async () => {
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    const page = {
      goto: vi.fn().mockResolvedValue(null),
      fill: vi.fn().mockResolvedValue(undefined),
      pressKey: vi.fn().mockResolvedValue(undefined),
      readFieldValue: vi.fn().mockResolvedValue(undefined),
      readInnerHtml: vi.fn().mockResolvedValue(undefined),
      click: vi.fn().mockResolvedValue(undefined),
      clickFirst: vi.fn().mockResolvedValue(true),
      clickFirstByText: vi.fn().mockResolvedValue(undefined),
      waitForAnySelector: vi.fn().mockResolvedValue('a[href*="inbox"]'),
      waitForSelector: vi.fn().mockResolvedValue(true),
      isVisible: vi.fn().mockResolvedValue(true),
      url: vi.fn().mockReturnValue('https://mail.sapo.pt/inbox'),
      title: vi.fn().mockResolvedValue('Inbox'),
      screenshot: vi.fn().mockResolvedValue('tmp/live-artifacts/check.png'),
      visibleListHtml: vi
        .fn()
        .mockResolvedValue(
          '<div class="mail-item unread" data-message-id="a"><span class="from">Banco BPI</span><span class="subject">Atualização da conta</span><span class="date">10:00</span></div><div class="mail-item" data-message-id="b"><span class="from">NOS</span><span class="subject">Fatura disponível</span><span class="date">10:10</span></div>'
        ),
      contentIncludesAny: vi.fn().mockResolvedValue(false),
      content: vi.fn().mockResolvedValue('<html></html>')
    };

    const state = {
      load: vi
        .fn()
        .mockResolvedValue({ seen: [], forwarded: [], scan: { scanCount: 0, lastNewCount: 0 } }),
      save: vi.fn().mockResolvedValue(undefined),
      hasSeen: vi.fn().mockResolvedValue(false),
      markSeen: vi.fn().mockResolvedValue({
        seen: [],
        forwarded: [],
        scan: { scanCount: 0, lastNewCount: 0 }
      }),
      markForwarded: vi.fn().mockResolvedValue({
        seen: [],
        forwarded: [],
        scan: { scanCount: 0, lastNewCount: 0 }
      }),
      hasForwarded: vi.fn().mockResolvedValue(false)
    };

    const result = await checkInbox({
      config: {
        mode: 'live',
        sapoUsername: 'user@example.com',
        sapoPassword: 'secret',
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
        forwardingAck: false,
        forwardAllowSenderPatterns: [],
        forwardBlockSenderPatterns: [],
        forwardAllowSubjectPatterns: [],
        forwardBlockSubjectPatterns: [],
        logLevel: 'info'
      },
      logger,
      page,
      state
    });

    expect(result.messages).toHaveLength(2);
    expect(result.newMessages).toEqual([]);
    expect(result.probe.bootstrapScan).toBe(true);
    expect(page.click).not.toHaveBeenCalled();
    expect(page.waitForAnySelector).toHaveBeenCalledWith(
      expect.arrayContaining(['.list-item.focus', '.mail-item', '.messages-list']),
      12000
    );
    expect(state.save).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      'sapo.check.probe_summary',
      expect.objectContaining({
        inboxReached: true,
        visibleMessageCount: 2,
        parsedMessageCount: 2,
        skippedAdRowCount: 0,
        newMessageCount: 0,
        alreadySeenCount: 0,
        bootstrapScan: true
      })
    );
  });

  it('fails when inbox is not reachable', async () => {
    await expect(() =>
      checkInbox({
        config: {
          mode: 'live',
          sapoUsername: 'user@example.com',
          sapoPassword: 'secret',
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
          forwardingAck: false,
          forwardAllowSenderPatterns: [],
          forwardBlockSenderPatterns: [],
          forwardAllowSubjectPatterns: [],
          forwardBlockSubjectPatterns: [],
          logLevel: 'info'
        },
        logger: {
          debug: vi.fn(),
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn()
        },
        page: {
          goto: vi.fn().mockResolvedValue(null),
          fill: vi.fn().mockResolvedValue(undefined),
          pressKey: vi.fn().mockResolvedValue(undefined),
          readFieldValue: vi.fn().mockResolvedValue(undefined),
          readInnerHtml: vi.fn().mockResolvedValue(undefined),
          click: vi.fn().mockResolvedValue(undefined),
          clickFirst: vi.fn().mockResolvedValue(true),
          clickFirstByText: vi.fn().mockResolvedValue(undefined),
          waitForAnySelector: vi.fn().mockResolvedValue(undefined),
          waitForSelector: vi.fn().mockResolvedValue(false),
          isVisible: vi.fn().mockResolvedValue(false),
          url: vi.fn().mockReturnValue('https://mail.sapo.pt/login'),
          title: vi.fn().mockResolvedValue('Login'),
          screenshot: vi.fn().mockResolvedValue('tmp/live-artifacts/check.png'),
          contentIncludesAny: vi.fn().mockResolvedValue(false),
          visibleListHtml: vi.fn().mockResolvedValue(undefined),
          content: vi.fn().mockResolvedValue('<html></html>')
        },
        state: {
          load: vi.fn().mockResolvedValue({
            seen: [],
            forwarded: [],
            scan: { scanCount: 0, lastNewCount: 0 }
          }),
          save: vi.fn().mockResolvedValue(undefined),
          hasSeen: vi.fn().mockResolvedValue(false),
          markSeen: vi.fn().mockResolvedValue({
            seen: [],
            forwarded: [],
            scan: { scanCount: 0, lastNewCount: 0 }
          }),
          markForwarded: vi.fn().mockResolvedValue({
            seen: [],
            forwarded: [],
            scan: { scanCount: 0, lastNewCount: 0 }
          }),
          hasForwarded: vi.fn().mockResolvedValue(false)
        }
      })
    ).rejects.toBeInstanceOf(ModuleError);
  });

  it('returns empty parsed list when only ad rows are visible', async () => {
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    const page = {
      goto: vi.fn().mockResolvedValue(null),
      fill: vi.fn().mockResolvedValue(undefined),
      pressKey: vi.fn().mockResolvedValue(undefined),
      readFieldValue: vi.fn().mockResolvedValue(undefined),
      readInnerHtml: vi.fn().mockResolvedValue(undefined),
      click: vi.fn().mockResolvedValue(undefined),
      clickFirst: vi.fn().mockResolvedValue(true),
      clickFirstByText: vi.fn().mockResolvedValue(undefined),
      waitForAnySelector: vi.fn().mockResolvedValue('a[href*="inbox"]'),
      waitForSelector: vi.fn().mockResolvedValue(true),
      isVisible: vi.fn().mockResolvedValue(true),
      url: vi.fn().mockReturnValue('https://mail.sapo.pt/v7/#/messages/SU5CT1g'),
      title: vi.fn().mockResolvedValue('(2) Caixa de Entrada - SAPO MAIL'),
      screenshot: vi.fn().mockResolvedValue('tmp/live-artifacts/check.png'),
      visibleListHtml: vi
        .fn()
        .mockResolvedValue(
          '<div class="mail-item ad"><span class="subject">Publicidade especial</span></div>'
        ),
      contentIncludesAny: vi.fn().mockResolvedValue(true),
      content: vi
        .fn()
        .mockResolvedValue(
          '<div class="mail-item ad"><span class="subject">Publicidade</span></div>'
        )
    };

    const state = {
      load: vi
        .fn()
        .mockResolvedValue({ seen: [], forwarded: [], scan: { scanCount: 0, lastNewCount: 0 } }),
      save: vi.fn().mockResolvedValue(undefined),
      hasSeen: vi.fn().mockResolvedValue(false),
      markSeen: vi.fn().mockResolvedValue({
        seen: [],
        forwarded: [],
        scan: { scanCount: 0, lastNewCount: 0 }
      }),
      markForwarded: vi.fn().mockResolvedValue({
        seen: [],
        forwarded: [],
        scan: { scanCount: 0, lastNewCount: 0 }
      }),
      hasForwarded: vi.fn().mockResolvedValue(false)
    };

    const result = await checkInbox({
      config: {
        mode: 'live',
        sapoUsername: 'user@example.com',
        sapoPassword: 'secret',
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
        forwardingAck: false,
        forwardAllowSenderPatterns: [],
        forwardBlockSenderPatterns: [],
        forwardAllowSubjectPatterns: [],
        forwardBlockSubjectPatterns: [],
        logLevel: 'info'
      },
      logger,
      page,
      state
    });

    expect(result.messages).toEqual([]);
    expect(result.probe.skippedAdRowCount).toBe(1);
    expect(result.probe.bootstrapScan).toBe(true);
    expect(page.waitForAnySelector).toHaveBeenCalled();
    expect(state.save).toHaveBeenCalledTimes(1);
    expect(page.click).not.toHaveBeenCalled();
  });

  it('emits only newly seen messages on non-bootstrap scan', async () => {
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    const page = {
      goto: vi.fn().mockResolvedValue(null),
      fill: vi.fn().mockResolvedValue(undefined),
      pressKey: vi.fn().mockResolvedValue(undefined),
      readFieldValue: vi.fn().mockResolvedValue(undefined),
      readInnerHtml: vi.fn().mockResolvedValue(undefined),
      click: vi.fn().mockResolvedValue(undefined),
      clickFirst: vi.fn().mockResolvedValue(true),
      clickFirstByText: vi.fn().mockResolvedValue(undefined),
      waitForAnySelector: vi.fn().mockResolvedValue('a[href*="inbox"]'),
      waitForSelector: vi.fn().mockResolvedValue(true),
      isVisible: vi.fn().mockResolvedValue(true),
      url: vi.fn().mockReturnValue('https://mail.sapo.pt/v7/#/messages/SU5CT1g'),
      title: vi.fn().mockResolvedValue('(2) Caixa de Entrada - SAPO MAIL'),
      screenshot: vi.fn().mockResolvedValue('tmp/live-artifacts/check.png'),
      visibleListHtml: vi
        .fn()
        .mockResolvedValue(
          '<div class="mail-item" data-message-id="old"><span class="from">Banco BPI</span><span class="subject">Mensagem antiga</span><span class="datetime">Ontem</span></div><div class="mail-item" data-message-id="new"><span class="from">Revolut</span><span class="subject">Pagamento aprovado</span><span class="datetime">Hoje</span></div>'
        ),
      contentIncludesAny: vi.fn().mockResolvedValue(false),
      content: vi.fn().mockResolvedValue('<html></html>')
    };

    const state = {
      load: vi.fn().mockResolvedValue({
        seen: [
          {
            id: 'old',
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
      }),
      save: vi.fn().mockResolvedValue(undefined),
      hasSeen: vi.fn().mockResolvedValue(false),
      markSeen: vi.fn().mockResolvedValue({
        seen: [],
        forwarded: [],
        scan: { scanCount: 0, lastNewCount: 0 }
      }),
      markForwarded: vi.fn().mockResolvedValue({
        seen: [],
        forwarded: [],
        scan: { scanCount: 0, lastNewCount: 0 }
      }),
      hasForwarded: vi.fn().mockResolvedValue(false)
    };

    const result = await checkInbox({
      config: {
        mode: 'live',
        sapoUsername: 'user@example.com',
        sapoPassword: 'secret',
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
        forwardingAck: false,
        forwardAllowSenderPatterns: [],
        forwardBlockSenderPatterns: [],
        forwardAllowSubjectPatterns: [],
        forwardBlockSubjectPatterns: [],
        logLevel: 'info'
      },
      logger,
      page,
      state
    });

    expect(result.newMessages?.map((message) => message.id)).toEqual(['new']);
    expect(result.probe.newMessageCount).toBe(1);
    expect(result.probe.alreadySeenCount).toBe(1);
    expect(result.probe.bootstrapScan).toBe(false);
  });
});
