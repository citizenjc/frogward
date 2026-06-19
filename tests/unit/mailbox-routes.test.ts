import { describe, expect, it, vi } from 'vitest';

import type { BrowserPage } from '../../src/lib/browser.js';
import { resolveInboxUrl, resolveSentUrl } from '../../src/modules/mailbox-routes.js';

describe('mailbox routes', () => {
  it('normalizes inbox message-detail urls back to inbox root', async () => {
    const page = {
      url: vi.fn().mockReturnValue('https://mail.sapo.pt/v7/#/messages/SU5CT1g/26626?'),
      readLinkHrefByText: vi.fn().mockResolvedValue(undefined)
    } as unknown as BrowserPage;

    await expect(resolveInboxUrl(page)).resolves.toBe('https://mail.sapo.pt/v7/#/messages/SU5CT1g');
    expect(page.readLinkHrefByText).not.toHaveBeenCalled();
  });

  it('falls back to discovered sent url', async () => {
    const page = {
      readLinkHrefByText: vi.fn().mockResolvedValue('https://mail.sapo.pt/v7/#/messages/RW52aWFkb3M'),
      url: vi.fn().mockReturnValue('https://mail.sapo.pt/v7/#/messages/SU5CT1g')
    } as unknown as BrowserPage;

    await expect(resolveSentUrl(page)).resolves.toBe('https://mail.sapo.pt/v7/#/messages/RW52aWFkb3M');
  });
});
