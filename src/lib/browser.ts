import type { AppConfig } from '../config/schema.js';
import { BrowserError } from './errors.js';
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

interface BrowserContextHandle {
  newPage(): Promise<BrowserPage>;
  close(): Promise<void>;
}

interface BrowserHandle {
  newContext(options?: { storageState: string }): Promise<BrowserContextHandle>;
  close(): Promise<void>;
}

export function createBrowserManager({ config, logger }: BrowserManagerOptions): BrowserManager {
  return {
    async withPage<T>(callback: (page: BrowserPage) => Promise<T>): Promise<T> {
      if (config.mode === 'scaffold') {
        logger.info('browser.stub.start', { headless: config.headless });
        return callback(createStubPage(logger));
      }

      logger.info('browser.playwright.start', { headless: config.headless });
      let browser: BrowserHandle | undefined;
      let context: BrowserContextHandle | undefined;

      try {
        const { chromium } = await import('playwright');
        browser = await chromium.launch({ headless: config.headless });
        context = await browser.newContext(
          config.storageStatePath ? { storageState: config.storageStatePath } : undefined
        );
        const page = await context.newPage();

        return await callback(page);
      } catch (error) {
        throw new BrowserError('Browser startup or navigation failed.', {
          cause: error instanceof Error ? error.message : 'unknown',
          mode: config.mode
        });
      } finally {
        await context?.close();
        await browser?.close();
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
