import type { AppConfig } from '../config/schema.js';
import type { BrowserPage } from '../lib/browser.js';
import type { Logger } from '../lib/logger.js';
import type { StateStore } from './state.js';
import type { MessageSummary } from '../types/message.js';

interface CheckInput {
  config: AppConfig;
  logger: Logger;
  page: BrowserPage;
  state: StateStore;
}

export async function checkInbox({
  config,
  logger,
  page,
  state
}: CheckInput): Promise<MessageSummary[]> {
  logger.info('sapo.check.placeholder', {
    destination: config.destinationEmail,
    knownMessages: state.getSnapshot().processed.length
  });
  await page.goto('https://mail.sapo.pt/inbox');
  return [];
}
