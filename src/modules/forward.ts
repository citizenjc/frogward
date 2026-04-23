import type { BrowserPage } from '../lib/browser.js';
import type { ForwardContext } from '../types/runtime.js';

interface ForwardInput extends ForwardContext {
  page: BrowserPage;
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
