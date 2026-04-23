import type { BrowserPage } from '../lib/browser.js';
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

  logger.info('sapo.check.placeholder', {
    destination: config.destinationEmail,
    knownMessages: snapshot.processed.length
  });
  await page.goto('https://mail.sapo.pt/inbox');
  return [];
}
