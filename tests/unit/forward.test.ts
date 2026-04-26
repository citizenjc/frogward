import { describe, expect, it, vi } from 'vitest';

import { forwardMessage } from '../../src/modules/forward.js';

function createConfig(destinationEmail: string | undefined = 'dest@example.com') {
  return {
    mode: 'live' as const,
    sapoUsername: 'user@example.com',
    sapoPassword: 'secret',
    destinationEmail,
    pollIntervalMs: 60000,
    pollErrorBackoffMs: 5000,
    headless: true,
    stateFilePath: 'tmp/sapo/runtime-state.json',
    storageStatePath: 'tmp/sapo/session.auth.json',
    persistStorageState: true,
    artifactDir: 'tmp/live-artifacts',
    captureScreenshotOnFailure: true,
    captureTraceOnFailure: true,
    forwardingEnabled: true,
    forwardAllowSenderPatterns: [],
    forwardBlockSenderPatterns: [],
    forwardAllowSubjectPatterns: [],
    forwardBlockSubjectPatterns: [],
    logLevel: 'info' as const
  };
}

function createLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  };
}

function createPageStub(overrides: Partial<Record<string, unknown>> = {}) {
  const clickFirst = vi.fn().mockImplementation(async (selectors: string[]) => {
    if (selectors.some((selector) => selector.includes('ACEITAR') || selector.includes('Accept'))) {
      return false;
    }

    if (
      selectors.some(
        (selector) => selector.includes('26206') || selector.includes('.list-item.focus')
      )
    ) {
      return true;
    }

    if (
      selectors.some((selector) => selector.includes('Encaminhar') || selector.includes('Forward'))
    ) {
      return true;
    }

    if (selectors.some((selector) => selector.includes('Enviar') || selector.includes('submit'))) {
      return true;
    }

    return false;
  });

  const waitForAnySelector = vi.fn().mockImplementation(async (selectors: string[]) => {
    if (selectors.includes('.clear.button')) {
      return '.clear.button';
    }

    if (selectors.includes('.recipents-list') || selectors.includes('#subject')) {
      return '.recipents-list';
    }

    if (selectors.includes('.recipents-list input[type="text"]')) {
      return '.recipents-list input[type="text"]';
    }

    if (selectors.includes('[role="status"]')) {
      return '[role="status"]';
    }

    return undefined;
  });

  return {
    goto: vi.fn().mockResolvedValue(null),
    reload: vi.fn().mockResolvedValue(null),
    fill: vi.fn().mockResolvedValue(undefined),
    prependText: vi.fn().mockResolvedValue(true),
    pressKey: vi.fn().mockResolvedValue(undefined),
    readFieldValue: vi.fn().mockResolvedValue('dest@example.com'),
    readInnerHtml: vi
      .fn()
      .mockResolvedValue('<span class="recipient valid">dest@example.com</span>'),
    click: vi.fn().mockResolvedValue(undefined),
    clickFirst,
    clickFirstByText: vi.fn().mockResolvedValue(undefined),
    waitForAnySelector,
    waitForSelector: vi.fn().mockResolvedValue(true),
    isVisible: vi.fn().mockResolvedValue(true),
    url: vi.fn().mockReturnValue('https://mail.sapo.pt/v7/#/messages/SU5CT1g'),
    title: vi.fn().mockResolvedValue('Inbox'),
    screenshot: vi.fn().mockResolvedValue('tmp/live-artifacts/forward.png'),
    content: vi.fn().mockResolvedValue('<html></html>'),
    contentIncludesAny: vi.fn().mockResolvedValue(false),
    visibleListHtml: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

const message = {
  id: '26206',
  from: 'Banco BPI',
  subject: 'BPI Bank: Message from your Manager',
  receivedAt: 'Ontem, 15:05',
  source: 'sapo-row-id' as const,
  confidence: 'high' as const
};

describe('forward module', () => {
  it('confirms success only after positive post-submit signal', async () => {
    const page = createPageStub();
    const logger = createLogger();

    const result = await forwardMessage({
      config: createConfig(),
      logger,
      message,
      page
    });

    expect(result).toEqual({
      messageId: '26206',
      status: 'success',
      confirmation: { via: 'selector', signal: '[role="status"]' }
    });
    expect(page.fill).toHaveBeenCalledWith(
      '.recipents-list input[type="text"]',
      'dest@example.com'
    );
    expect(page.prependText).toHaveBeenCalledWith(
      expect.arrayContaining(['[contenteditable="true"]', 'textarea']),
      'Automatically forwarded by Frogward.'
    );
    expect(page.pressKey).toHaveBeenCalledWith('Enter');
  });

  it('returns failure when destination is missing', async () => {
    const result = await forwardMessage({
      config: { ...createConfig(), destinationEmail: undefined },
      logger: createLogger(),
      message,
      page: createPageStub()
    });

    expect(result).toEqual({
      messageId: '26206',
      status: 'failed',
      reason: 'missing_destination',
      stage: 'compose'
    });
  });

  it('returns failure when opening the message fails', async () => {
    const page = createPageStub({
      clickFirst: vi
        .fn()
        .mockImplementation(async (selectors: string[]) =>
          selectors.some((selector) => selector.includes('ACEITAR')) ? false : false
        )
    });

    const result = await forwardMessage({
      config: createConfig(),
      logger: createLogger(),
      message,
      page
    });

    expect(result.reason).toBe('open_message_failed');
    expect(result.stage).toBe('open');
  });

  it('falls back to text-based forward action clicks when selector helpers miss', async () => {
    const page = createPageStub({
      clickFirst: vi.fn().mockImplementation(async (selectors: string[]) => {
        if (selectors.some((selector) => selector.includes('ACEITAR'))) return false;
        if (
          selectors.some(
            (selector) => selector.includes('26206') || selector.includes('.list-item.focus')
          )
        )
          return true;
        if (
          selectors.some(
            (selector) => selector.includes('Encaminhar') || selector.includes('Forward')
          )
        )
          return false;
        if (
          selectors.some((selector) => selector.includes('Enviar') || selector.includes('submit'))
        )
          return true;
        return false;
      }),
      clickFirstByText: vi.fn().mockResolvedValue('Encaminhar')
    });

    const result = await forwardMessage({
      config: createConfig(),
      logger: createLogger(),
      message,
      page
    });

    expect(result.status).toBe('success');
    expect(page.clickFirstByText).toHaveBeenCalledWith(['Encaminhar', 'Reencaminhar', 'Forward']);
  });

  it('returns failure when forward action cannot be found', async () => {
    const page = createPageStub({
      clickFirst: vi.fn().mockImplementation(async (selectors: string[]) => {
        if (selectors.some((selector) => selector.includes('ACEITAR'))) return false;
        if (
          selectors.some(
            (selector) => selector.includes('26206') || selector.includes('.list-item.focus')
          )
        )
          return true;
        return false;
      }),
      clickFirstByText: vi.fn().mockResolvedValue(undefined)
    });

    const result = await forwardMessage({
      config: createConfig(),
      logger: createLogger(),
      message,
      page
    });

    expect(result.reason).toBe('forward_action_not_found');
    expect(result.stage).toBe('compose');
  });

  it('returns failure when compose recipient field never appears', async () => {
    const page = createPageStub({
      waitForAnySelector: vi.fn().mockImplementation(async (selectors: string[]) => {
        if (selectors.includes('.clear.button')) return '.clear.button';
        if (selectors.includes('.recipents-list') || selectors.includes('#subject'))
          return '.recipents-list';
        return undefined;
      })
    });

    const result = await forwardMessage({
      config: createConfig(),
      logger: createLogger(),
      message,
      page
    });

    expect(result.reason).toBe('compose_open_failed');
  });

  it('returns failure when compose recipient verification does not match destination', async () => {
    const page = createPageStub({
      readFieldValue: vi.fn().mockResolvedValue(''),
      readInnerHtml: vi.fn().mockResolvedValue('<span class="recipient">wrong@example.com</span>')
    });

    const result = await forwardMessage({
      config: createConfig(),
      logger: createLogger(),
      message,
      page
    });

    expect(result.reason).toBe('recipient_verification_failed');
  });

  it('returns failure when send button cannot be found', async () => {
    const page = createPageStub({
      clickFirst: vi.fn().mockImplementation(async (selectors: string[]) => {
        if (selectors.some((selector) => selector.includes('ACEITAR'))) return false;
        if (
          selectors.some(
            (selector) => selector.includes('26206') || selector.includes('.list-item.focus')
          )
        )
          return true;
        if (
          selectors.some(
            (selector) => selector.includes('Encaminhar') || selector.includes('Forward')
          )
        )
          return true;
        if (
          selectors.some((selector) => selector.includes('Enviar') || selector.includes('submit'))
        )
          return false;
        return false;
      })
    });

    const result = await forwardMessage({
      config: createConfig(),
      logger: createLogger(),
      message,
      page
    });

    expect(result.reason).toBe('submit_not_found');
    expect(result.stage).toBe('send');
  });

  it('returns failure when an explicit send error signal appears', async () => {
    const page = createPageStub({
      waitForAnySelector: vi.fn().mockImplementation(async (selectors: string[]) => {
        if (selectors.includes('.clear.button')) return '.clear.button';
        if (selectors.includes('.recipents-list') || selectors.includes('#subject'))
          return '.recipents-list';
        if (selectors.includes('.recipents-list input[type="text"]'))
          return '.recipents-list input[type="text"]';
        if (selectors.includes('.toast-error')) return '.toast-error';
        return undefined;
      })
    });

    const result = await forwardMessage({
      config: createConfig(),
      logger: createLogger(),
      message,
      page
    });

    expect(result).toEqual({
      messageId: '26206',
      status: 'failed',
      reason: 'send_failed',
      stage: 'confirm',
      confirmation: { via: 'selector', signal: '.toast-error' }
    });
  });

  it('returns failure when no success or error confirmation appears', async () => {
    const page = createPageStub({
      waitForAnySelector: vi.fn().mockImplementation(async (selectors: string[]) => {
        if (selectors.includes('.clear.button')) return '.clear.button';
        if (selectors.includes('.recipents-list') || selectors.includes('#subject'))
          return '.recipents-list';
        if (selectors.includes('.recipents-list input[type="text"]'))
          return '.recipents-list input[type="text"]';
        return undefined;
      }),
      content: vi.fn().mockResolvedValue('<html></html>')
    });

    const result = await forwardMessage({
      config: createConfig(),
      logger: createLogger(),
      message,
      page
    });

    expect(result.reason).toBe('send_confirmation_missing');
  });

  it('treats matching sent-folder evidence as success fallback', async () => {
    const page = createPageStub({
      contentIncludesAny: vi.fn().mockResolvedValue(false),
      waitForAnySelector: vi.fn().mockImplementation(async (selectors: string[]) => {
        if (selectors.includes('.clear.button')) return '.clear.button';
        if (selectors.includes('.recipents-list') || selectors.includes('#subject'))
          return '.recipents-list';
        if (selectors.includes('.recipents-list input[type="text"]'))
          return '.recipents-list input[type="text"]';
        if (selectors.includes('.messages-list')) return '.messages-list';
        if (selectors.includes('.list-item')) return '.list-item';
        return undefined;
      }),
      content: vi
        .fn()
        .mockResolvedValue(
          '<div class="list-item"><div class="from">Para: dest@example.com</div><div class="subject">BPI Bank: Message from your Manager</div></div>'
        )
    });

    const result = await forwardMessage({
      config: createConfig(),
      logger: createLogger(),
      message,
      page
    });

    expect(result).toEqual({
      messageId: '26206',
      status: 'success',
      confirmation: { via: 'content', signal: 'sent-folder:dest@example.com' }
    });
  });
});
