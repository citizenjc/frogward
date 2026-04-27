import type { BrowserPage } from '../lib/browser.js';

const FALLBACK_INBOX_URL = 'https://mail.sapo.pt/v7/#/messages/SU5CT1g';
const FALLBACK_SENT_URL = 'https://mail.sapo.pt/v7/#/messages/RW52aWFkb3M';

const INBOX_TEXTS = ['Caixa de Entrada', 'Inbox'];
const SENT_TEXTS = ['Enviados', 'Sent'];

export async function resolveInboxUrl(page: BrowserPage): Promise<string> {
  const currentUrl = page.url();
  if (looksLikeMailboxUrl(currentUrl)) {
    return currentUrl;
  }

  const discovered = await page.readLinkHrefByText(INBOX_TEXTS);
  return discovered || FALLBACK_INBOX_URL;
}

export async function resolveSentUrl(page: BrowserPage): Promise<string> {
  const discovered = await page.readLinkHrefByText(SENT_TEXTS);
  return discovered || FALLBACK_SENT_URL;
}

function looksLikeMailboxUrl(url: string): boolean {
  return url.includes('/#/messages/') || url.includes('/messages/SU5CT1g');
}
