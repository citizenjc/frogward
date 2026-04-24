import type { BrowserPage } from '../lib/browser.js';
import { ModuleError } from '../lib/errors.js';
import { parseInboxRows } from './inbox-parser.js';
import type { InboxContext, InboxListingResult } from '../types/runtime.js';

interface CheckInput extends InboxContext {
  page: BrowserPage;
}

export async function checkInbox({
  config,
  logger,
  page,
  state
}: CheckInput): Promise<InboxListingResult> {
  const snapshot = await state.load();

  logger.info('sapo.check.start', {
    knownMessages: snapshot.processed.length,
    mode: config.mode
  });

  if (config.mode === 'live') {
    logger.info('sapo.check.selector_strategy', {
      primary: ['.list-item.focus', '.from', '.subject', '.datetime'],
      fallback: ['.messages-list', 'title includes inbox', 'url:/messages/SU5CT1g']
    });
  }

  const reachability = await ensureInboxReachable(page);
  const listing = await buildListingSummary(page);

  const result: InboxListingResult = {
    messages: listing.messages,
    probe: {
      inboxReached: true,
      inboxTitle: reachability.title,
      visibleMessageCount: listing.visibleMessageCount,
      parsedMessageCount: listing.messages.length,
      skippedAdRowCount: listing.skippedAdRowCount,
      parserFallbacksUsed: listing.parserFallbacksUsed
    }
  };

  logger.info('sapo.check.probe_summary', {
    inboxReached: result.probe.inboxReached,
    inboxTitle: result.probe.inboxTitle,
    visibleMessageCount: result.probe.visibleMessageCount,
    parsedMessageCount: result.probe.parsedMessageCount,
    skippedAdRowCount: result.probe.skippedAdRowCount,
    parserFallbacksUsed: result.probe.parserFallbacksUsed,
    sampleSenders: redactSummaryList(
      result.messages.map((message) => message.from),
      2
    ),
    sampleSubjects: redactSummaryList(
      result.messages.map((message) => message.subject),
      2
    )
  });
  return result;
}

async function buildListingSummary(page: BrowserPage): Promise<{
  visibleMessageCount: number | undefined;
  messages: InboxListingResult['messages'];
  skippedAdRowCount: number;
  parserFallbacksUsed: string[];
}> {
  const listHtml =
    (await page.visibleListHtml(
      '[data-test="message-list"], .message-list, .messages-list, #messages, .list-group, .container.messages-list'
    )) ?? (await page.content());

  const parsed = parseInboxRows(listHtml);
  const content = listHtml;
  const rowMarkers = [
    /data-message-id=/g,
    /role="row"/g,
    /class="[^"]*list-item[^"]*"/g,
    /class="[^"]*message[^"]*"/g,
    /class="[^"]*mail-item[^"]*"/g
  ];

  for (const marker of rowMarkers) {
    const matches = content.match(marker);
    if (matches && matches.length > 0) {
      return {
        visibleMessageCount: matches.length,
        messages: parsed.messages,
        skippedAdRowCount: parsed.skippedAdRowCount,
        parserFallbacksUsed: parsed.parserFallbacksUsed
      };
    }
  }

  return {
    visibleMessageCount: undefined,
    messages: parsed.messages,
    skippedAdRowCount: parsed.skippedAdRowCount,
    parserFallbacksUsed: parsed.parserFallbacksUsed
  };
}

async function ensureInboxReachable(page: BrowserPage): Promise<{ title: string; url: string }> {
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

  return { title, url };
}

function redactSummaryList(values: string[], maxItems: number): string[] {
  return values.slice(0, maxItems).map((value) => {
    const compact = value.trim();
    if (compact.length <= 3) {
      return '[redacted]';
    }

    return `${compact.slice(0, 1)}***${compact.slice(-1)}`;
  });
}
