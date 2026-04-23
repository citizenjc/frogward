import type { BrowserPage } from '../lib/browser.js';
import type { ModuleContext } from '../types/runtime.js';

interface LoginInput extends ModuleContext {
  page: BrowserPage;
}

export async function loginToSapo({ config, logger, page }: LoginInput): Promise<void> {
  logger.info('sapo.login.placeholder', {
    mode: config.mode,
    usernameConfigured: Boolean(config.sapoUsername)
  });
  await page.goto('https://mail.sapo.pt');
}
