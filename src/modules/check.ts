import type { BrowserPage } from '../lib/browser.js';
import { ModuleError } from '../lib/errors.js';
import type { MessageSummary } from '../types/message.js';
import type { InboxContext } from '../types/runtime.js';

interface CheckInput extends InboxContext {
  page: BrowserPage;
}

export async function checkInbox({
  config,
  logger,
  page,
  state
}: CheckInput): Promise<MessageSummary[]> {
  const snapshot = await state.load();
  const probeSummary = {
    inboxReached: false,
    inboxTitle: undefined as string | undefined,
    visibleMessageCount: undefined as number | undefined
  };

  logger.info('sapo.check.start', {
    knownMessages: snapshot.processed.length,
    mode: config.mode
  });

  if (config.mode === 'live') {
    logger.info('sapo.check.selector_strategy', {
      primary: ['url:/inbox', 'a[href*="inbox"]'],
      fallback: ['title includes inbox']
    });
  }

  await page.goto('https://mail.sapo.pt/v7/#/messages/SU5CT1g');

  const inboxVisible = await page.waitForSelector(
    'a[href*="inbox"], [data-folder="inbox"], [href*="#/messages/SU5CT1g"]',
    8_000
  );
  const title = await page.title();
  const url = page.url();
  const html = await page.content();
  const hasInboxShellSignals =
    html.includes('Caixa de Entrada') &&
    html.includes('Nova mensagem') &&
    html.includes('Definições');

  if (
    !inboxVisible &&
    !title.includes('Caixa de Entrada') &&
    !url.includes('/messages/SU5CT1g') &&
    !hasInboxShellSignals
  ) {
    throw new ModuleError('check', 'Inbox not reachable during probe.', {
      url
    });
  }

  probeSummary.inboxReached = true;
  probeSummary.inboxTitle = title;
  probeSummary.visibleMessageCount = await estimateVisibleMessageCount(page);

  logger.info('sapo.check.probe_summary', probeSummary);
  return [];
}

async function estimateVisibleMessageCount(page: BrowserPage): Promise<number | undefined> {
  const content = await page.content();
  const rowMarkers = [
    /data-message-id=/g,
    /role="row"/g,
    /class="[^"]*message[^"]*"/g,
    /class="[^"]*mail-item[^"]*"/g
  ];

  for (const marker of rowMarkers) {
    const matches = content.match(marker);
    if (matches && matches.length > 0) {
      return matches.length;
    }
  }

  return undefined;
}
