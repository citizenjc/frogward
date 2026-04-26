import { describe, expect, it, vi } from 'vitest';

import { AuthError } from '../../src/lib/errors.js';
import { loginToSapo } from '../../src/modules/login.js';

describe('login module', () => {
  it('returns reused-session when inbox is already reachable', async () => {
    const result = await loginToSapo({
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
      usingStorageState: true,
      page: {
        goto: vi.fn().mockResolvedValue(null),
        reload: vi.fn().mockResolvedValue(null),
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
        screenshot: vi.fn().mockResolvedValue('tmp/live-artifacts/auth/failure.png'),
        contentIncludesAny: vi.fn().mockResolvedValue(false),
        visibleListHtml: vi.fn().mockResolvedValue(undefined),
        content: vi.fn().mockResolvedValue('<html></html>')
      }
    });

    expect(result.status).toBe('reused-session');
  });

  it('throws auth error when live credentials are missing', async () => {
    await expect(() =>
      loginToSapo({
        config: {
          mode: 'live',
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
          logLevel: 'info'
        },
        logger: {
          debug: vi.fn(),
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn()
        },
        usingStorageState: false,
        page: {
          goto: vi.fn().mockResolvedValue(null),
          reload: vi.fn().mockResolvedValue(null),
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
          screenshot: vi.fn().mockResolvedValue('tmp/live-artifacts/auth/failure.png'),
          contentIncludesAny: vi.fn().mockResolvedValue(false),
          visibleListHtml: vi.fn().mockResolvedValue(undefined),
          content: vi.fn().mockResolvedValue('<html></html>')
        }
      })
    ).rejects.toBeInstanceOf(AuthError);
  });
});
