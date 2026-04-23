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
      click: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockResolvedValue(true),
      isVisible: vi.fn().mockResolvedValue(true),
      url: vi.fn().mockReturnValue('https://mail.sapo.pt/inbox'),
      title: vi.fn().mockResolvedValue('Inbox'),
      screenshot: vi.fn().mockResolvedValue('tmp/live-artifacts/check.png'),
      content: vi
        .fn()
        .mockResolvedValue('<div data-message-id="a"></div><div data-message-id="b"></div>')
    };

    const state = {
      load: vi.fn().mockResolvedValue({ processed: [] }),
      save: vi.fn().mockResolvedValue(undefined),
      hasProcessed: vi.fn().mockResolvedValue(false),
      markProcessed: vi.fn().mockResolvedValue({ processed: [] })
    };

    const result = await checkInbox({
      config: {
        mode: 'live',
        sapoUsername: 'user@example.com',
        sapoPassword: 'secret',
        destinationEmail: undefined,
        pollIntervalMs: 60000,
        headless: true,
        stateFilePath: 'src/state/runtime-state.json',
        storageStatePath: 'tmp/sapo/session.auth.json',
        persistStorageState: true,
        artifactDir: 'tmp/live-artifacts',
        captureScreenshotOnFailure: true,
        captureTraceOnFailure: true,
        logLevel: 'info'
      },
      logger,
      page,
      state
    });

    expect(result).toEqual([]);
    expect(page.click).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      'sapo.check.probe_summary',
      expect.objectContaining({ inboxReached: true, visibleMessageCount: 2 })
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
          headless: true,
          stateFilePath: 'src/state/runtime-state.json',
          storageStatePath: 'tmp/sapo/session.auth.json',
          persistStorageState: true,
          artifactDir: 'tmp/live-artifacts',
          captureScreenshotOnFailure: true,
          captureTraceOnFailure: true,
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
          click: vi.fn().mockResolvedValue(undefined),
          waitForSelector: vi.fn().mockResolvedValue(false),
          isVisible: vi.fn().mockResolvedValue(false),
          url: vi.fn().mockReturnValue('https://mail.sapo.pt/login'),
          title: vi.fn().mockResolvedValue('Login'),
          screenshot: vi.fn().mockResolvedValue('tmp/live-artifacts/check.png'),
          content: vi.fn().mockResolvedValue('<html></html>')
        },
        state: {
          load: vi.fn().mockResolvedValue({ processed: [] }),
          save: vi.fn().mockResolvedValue(undefined),
          hasProcessed: vi.fn().mockResolvedValue(false),
          markProcessed: vi.fn().mockResolvedValue({ processed: [] })
        }
      })
    ).rejects.toBeInstanceOf(ModuleError);
  });
});
