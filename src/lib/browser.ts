import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { AppConfig } from '../config/schema.js';
import { BrowserError } from './errors.js';
import type { Logger } from './logger.js';

let stealthConfigured = false;

export interface BrowserPage {
  goto(url: string): Promise<unknown>;
  fill(selector: string, value: string): Promise<void>;
  click(selector: string): Promise<void>;
  waitForSelector(selector: string, timeoutMs?: number): Promise<boolean>;
  isVisible(selector: string): Promise<boolean>;
  url(): string;
  title(): Promise<string>;
  screenshot(filePath: string): Promise<string>;
  content(): Promise<string>;
  visibleListHtml(listSelector: string): Promise<string | undefined>;
}

export interface BrowserSession {
  page: BrowserPage;
  usingStorageState: boolean;
  startTrace(name: string): Promise<void>;
  stopTrace(filePath: string): Promise<string | undefined>;
  saveStorageState(filePath: string): Promise<string | undefined>;
}

export interface BrowserManager {
  withSession<T>(callback: (session: BrowserSession) => Promise<T>): Promise<T>;
}

interface BrowserManagerOptions {
  config: AppConfig;
  logger: Logger;
}

interface PlaywrightPageHandle {
  goto(url: string): Promise<unknown>;
  fill(selector: string, value: string): Promise<void>;
  click(selector: string): Promise<void>;
  waitForSelector(selector: string, options?: { timeout?: number }): Promise<unknown>;
  isVisible(selector: string): Promise<boolean>;
  url(): string;
  title(): Promise<string>;
  screenshot(options: { path: string; fullPage?: boolean }): Promise<unknown>;
  content(): Promise<string>;
  evaluate(script: string): Promise<unknown>;
}

interface BrowserContextHandle {
  newPage(): Promise<PlaywrightPageHandle>;
  storageState(options: { path: string }): Promise<unknown>;
  tracing: {
    start(options: { screenshots: boolean; snapshots: boolean; title: string }): Promise<void>;
    stop(options: { path: string }): Promise<void>;
  };
  close(): Promise<void>;
}

interface BrowserHandle {
  newContext(options?: { storageState: string }): Promise<BrowserContextHandle>;
  close(): Promise<void>;
}

export function createBrowserManager({ config, logger }: BrowserManagerOptions): BrowserManager {
  return {
    async withSession<T>(callback: (session: BrowserSession) => Promise<T>): Promise<T> {
      if (config.mode === 'scaffold') {
        logger.info('browser.stub.start', { headless: config.headless });
        return callback(createStubSession(logger, Boolean(config.storageStatePath)));
      }

      logger.info('browser.playwright.start', { headless: config.headless });
      let browser: BrowserHandle | undefined;
      let context: BrowserContextHandle | undefined;

      try {
        const chromium = await createChromiumLauncher(logger);
        browser = await chromium.launch({ headless: config.headless });
        const reusableStorageStatePath = await resolveReusableStorageStatePath(
          config.storageStatePath
        );
        context = await browser.newContext(
          reusableStorageStatePath ? { storageState: reusableStorageStatePath } : undefined
        );
        const page = await context.newPage();
        const session = createPlaywrightSession(
          page,
          context,
          logger,
          Boolean(reusableStorageStatePath)
        );

        return await callback(session);
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

function createStubSession(logger: Logger, usingStorageState: boolean): BrowserSession {
  let currentUrl = 'about:blank';

  return {
    usingStorageState,
    page: {
      async goto(url: string): Promise<unknown> {
        currentUrl = url;
        logger.debug('browser.stub.goto', { url });
        return null;
      },
      async fill(selector: string, value: string): Promise<void> {
        logger.debug('browser.stub.fill', { selector, valueLength: value.length });
      },
      async click(selector: string): Promise<void> {
        logger.debug('browser.stub.click', { selector });
      },
      async waitForSelector(selector: string): Promise<boolean> {
        logger.debug('browser.stub.waitForSelector', { selector });
        return true;
      },
      async isVisible(selector: string): Promise<boolean> {
        logger.debug('browser.stub.isVisible', { selector });
        return true;
      },
      url(): string {
        return currentUrl;
      },
      async title(): Promise<string> {
        return 'frogward-stub';
      },
      async screenshot(filePath: string): Promise<string> {
        await ensureParentDirectory(filePath);
        await writeFile(filePath, 'stub screenshot', 'utf8');
        return filePath;
      },
      async content(): Promise<string> {
        return '<html><body>stub page</body></html>';
      },
      async visibleListHtml(listSelector: string): Promise<string> {
        logger.debug('browser.stub.visibleListHtml', { listSelector });
        return '<div class="mail-item" data-message-id="stub-1"><span class="from">Stub</span><span class="subject">Stub message</span><span class="date">now</span></div>';
      }
    },
    async startTrace(name: string): Promise<void> {
      logger.debug('browser.stub.trace.start', { name });
    },
    async stopTrace(filePath: string): Promise<string> {
      await ensureParentDirectory(filePath);
      await writeFile(filePath, 'stub trace', 'utf8');
      return filePath;
    },
    async saveStorageState(filePath: string): Promise<string> {
      await ensureParentDirectory(filePath);
      await writeFile(filePath, JSON.stringify({ cookies: [], origins: [] }, null, 2), 'utf8');
      return filePath;
    }
  };
}

function createPlaywrightSession(
  page: PlaywrightPageHandle,
  context: BrowserContextHandle,
  logger: Logger,
  usingStorageState: boolean
): BrowserSession {
  return {
    usingStorageState,
    page: {
      goto(url: string): Promise<unknown> {
        return page.goto(url);
      },
      fill(selector: string, value: string): Promise<void> {
        return page.fill(selector, value);
      },
      click(selector: string): Promise<void> {
        return page.click(selector);
      },
      async waitForSelector(selector: string, timeoutMs = 10_000): Promise<boolean> {
        try {
          await page.waitForSelector(selector, { timeout: timeoutMs });
          return true;
        } catch {
          return false;
        }
      },
      isVisible(selector: string): Promise<boolean> {
        return page.isVisible(selector);
      },
      url(): string {
        return page.url();
      },
      title(): Promise<string> {
        return page.title();
      },
      async screenshot(filePath: string): Promise<string> {
        await ensureParentDirectory(filePath);
        await page.screenshot({ path: filePath, fullPage: true });
        return filePath;
      },
      content(): Promise<string> {
        return page.content();
      },
      async visibleListHtml(listSelector: string): Promise<string | undefined> {
        const selectorLiteral = JSON.stringify(listSelector);
        const result = await page.evaluate(`(() => {
            const root = document.querySelector(${selectorLiteral});
            if (!root) return undefined;

            const nodes = Array.from(root.querySelectorAll('div, li')).filter((node) => {
              const cls = (node.getAttribute('class') || '').toLowerCase();
              return cls.includes('mail-item') || cls.includes('message-row') || cls.includes('thread-row') || cls.includes('list-item');
            });

            const normalizedRows = nodes.map((node) => {
              const cls = (node.getAttribute('class') || '').toLowerCase();
              const isUnread = cls.includes('unread');
              const from = node.querySelector('.from')?.textContent?.trim() || '';
              const subject = node.querySelector('.subject')?.textContent?.trim() || '';
              const datetime = node.querySelector('.datetime, .date, .time')?.textContent?.trim() || '';
              const preview = node.querySelector('.preview, .snippet')?.textContent?.trim() || '';
              const inputId = node.querySelector('input[id]')?.getAttribute('id') || '';
              const rowType = cls.includes('ad') || cls.includes('adds-messages-list') ? 'ad' : 'message';

              return '<div class="mail-item ' + cls.split(' ').filter(Boolean).join(' ').trim() + '"' +
                (inputId ? ' data-id="' + inputId + '"' : '') +
                (isUnread ? ' data-unread="true"' : '') +
                ' data-row-type="' + rowType + '">' +
                '<span class="from">' + from.replace(/</g, '&lt;') + '</span>' +
                '<span class="subject">' + subject.replace(/</g, '&lt;') + '</span>' +
                '<span class="datetime">' + datetime.replace(/</g, '&lt;') + '</span>' +
                (preview ? '<span class="preview">' + preview.replace(/</g, '&lt;') + '</span>' : '') +
                '</div>';
            });

            return normalizedRows.join('\n');
          })()`);

        return typeof result === 'string' && result.length > 0 ? result : undefined;
      }
    },
    async startTrace(name: string): Promise<void> {
      await context.tracing.start({
        screenshots: true,
        snapshots: true,
        title: name
      });
      logger.debug('browser.trace.started', { name });
    },
    async stopTrace(filePath: string): Promise<string> {
      await ensureParentDirectory(filePath);
      await context.tracing.stop({ path: filePath });
      logger.debug('browser.trace.saved', { filePath });
      return filePath;
    },
    async saveStorageState(filePath: string): Promise<string> {
      await ensureParentDirectory(filePath);
      await context.storageState({ path: filePath });
      logger.info('browser.storage.saved', { filePath });
      return filePath;
    }
  };
}

async function ensureParentDirectory(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
}

async function resolveReusableStorageStatePath(
  storageStatePath: string | undefined
): Promise<string | undefined> {
  if (!storageStatePath) {
    return undefined;
  }

  try {
    await access(storageStatePath);
    return storageStatePath;
  } catch {
    return undefined;
  }
}

async function createChromiumLauncher(
  logger: Logger
): Promise<{ launch(options: { headless: boolean }): Promise<BrowserHandle> }> {
  const { chromium } = await import('playwright-extra');

  if (!stealthConfigured) {
    const { default: StealthPlugin } = await import('puppeteer-extra-plugin-stealth');
    chromium.use(StealthPlugin());
    stealthConfigured = true;
    logger.info('browser.stealth.enabled');
  }

  return chromium as unknown as { launch(options: { headless: boolean }): Promise<BrowserHandle> };
}
