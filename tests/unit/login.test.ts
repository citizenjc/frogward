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
      usingStorageState: true,
      page: {
        goto: vi.fn().mockResolvedValue(null),
        fill: vi.fn().mockResolvedValue(undefined),
        click: vi.fn().mockResolvedValue(undefined),
        waitForSelector: vi.fn().mockResolvedValue(true),
        isVisible: vi.fn().mockResolvedValue(true),
        url: vi.fn().mockReturnValue('https://mail.sapo.pt/inbox'),
        title: vi.fn().mockResolvedValue('Inbox'),
        screenshot: vi.fn().mockResolvedValue('tmp/live-artifacts/auth/failure.png'),
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
        usingStorageState: false,
        page: {
          goto: vi.fn().mockResolvedValue(null),
          fill: vi.fn().mockResolvedValue(undefined),
          click: vi.fn().mockResolvedValue(undefined),
          waitForSelector: vi.fn().mockResolvedValue(false),
          isVisible: vi.fn().mockResolvedValue(false),
          url: vi.fn().mockReturnValue('https://mail.sapo.pt/login'),
          title: vi.fn().mockResolvedValue('Login'),
          screenshot: vi.fn().mockResolvedValue('tmp/live-artifacts/auth/failure.png'),
          visibleListHtml: vi.fn().mockResolvedValue(undefined),
          content: vi.fn().mockResolvedValue('<html></html>')
        }
      })
    ).rejects.toBeInstanceOf(AuthError);
  });
});
