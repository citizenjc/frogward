import type { BrowserPage } from '../lib/browser.js';

const FALLBACK_INBOX_URL = 'https://mail.sapo.pt/v7/#/messages/SU5CT1g';
const FALLBACK_SENT_URL = 'https://mail.sapo.pt/v7/#/messages/RW52aWFkb3M';

const INBOX_TEXTS = ['Caixa de Entrada', 'Inbox'];
const SENT_TEXTS = ['Enviados', 'Sent'];

export async function resolveInboxUrl(page: BrowserPage): Promise<string> {
  const currentUrl = page.url();
  const normalizedCurrentUrl = normalizeInboxUrl(currentUrl);
  if (normalizedCurrentUrl) {
    return normalizedCurrentUrl;
  }

  const discovered = await page.readLinkHrefByText(INBOX_TEXTS);
  return discovered || FALLBACK_INBOX_URL;
}

export async function resolveSentUrl(page: BrowserPage): Promise<string> {
  const discovered = await page.readLinkHrefByText(SENT_TEXTS);
  return discovered || FALLBACK_SENT_URL;
}

function normalizeInboxUrl(url: string): string | undefined {
  if (!url.includes('/#/messages/') && !url.includes('/messages/SU5CT1g')) {
    return undefined;
  }

  const inboxMatch = url.match(/^(.*\/messages\/SU5CT1g)(?:[/?#].*)?$/);
  if (inboxMatch?.[1]) {
    return inboxMatch[1];
  }

  return undefined;
}
