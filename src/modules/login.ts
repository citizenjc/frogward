import type { AppConfig } from '../config/schema.js';
import type { BrowserPage } from '../lib/browser.js';
import type { Logger } from '../lib/logger.js';

interface LoginInput {
  config: AppConfig;
  logger: Logger;
  page: BrowserPage;
}

export async function loginToSapo({ config, logger, page }: LoginInput): Promise<void> {
  logger.info('sapo.login.placeholder', { username: config.sapoUsername });
  await page.goto('https://mail.sapo.pt');
}
