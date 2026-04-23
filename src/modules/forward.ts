import type { AppConfig } from '../config/schema.js';
import type { BrowserPage } from '../lib/browser.js';
import type { Logger } from '../lib/logger.js';
import type { MessageSummary } from '../types/message.js';

interface ForwardInput {
  config: AppConfig;
  logger: Logger;
  page: BrowserPage;
  message: MessageSummary;
}

export async function forwardMessage({
  config,
  logger,
  message,
  page
}: ForwardInput): Promise<void> {
  logger.info('sapo.forward.placeholder', {
    destination: config.destinationEmail,
    messageId: message.id
  });
  await page.goto('https://mail.sapo.pt/message/forward');
}
