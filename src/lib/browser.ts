import type { AppConfig } from '../config/schema.js';
import type { Logger } from './logger.js';

export interface BrowserPage {
  goto(url: string): Promise<unknown>;
}

export interface BrowserManager {
  withPage<T>(callback: (page: BrowserPage) => Promise<T>): Promise<T>;
}

interface BrowserManagerOptions {
  config: AppConfig;
  logger: Logger;
}

export function createBrowserManager({ config, logger }: BrowserManagerOptions): BrowserManager {
  return {
    async withPage<T>(callback: (page: BrowserPage) => Promise<T>): Promise<T> {
      if (config.mode === 'scaffold') {
        logger.info('browser.stub.start', { headless: config.headless });
        return callback(createStubPage(logger));
      }

      logger.info('browser.playwright.start', { headless: config.headless });
      const { chromium } = await import('playwright');
      const browser = await chromium.launch({ headless: config.headless });
      const context = await browser.newContext(
        config.storageStatePath ? { storageState: config.storageStatePath } : undefined
      );
      const page = await context.newPage();

      try {
        return await callback(page);
      } finally {
        await context.close();
        await browser.close();
      }
    }
  };
}

function createStubPage(logger: Logger): BrowserPage {
  return {
    async goto(url: string): Promise<unknown> {
      logger.debug('browser.stub.goto', { url });
      return null;
    }
  };
}
