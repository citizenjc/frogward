import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { AppConfig } from '../config/schema.js';
import { BrowserError } from './errors.js';
import type { Logger } from './logger.js';

let stealthConfigured = false;

export interface BrowserPage {
  goto(url: string): Promise<unknown>;
  reload(): Promise<unknown>;
  readLinkHrefByText(texts: string[]): Promise<string | undefined>;
  fill(selector: string, value: string): Promise<void>;
  prependText(selectors: string[], text: string): Promise<boolean>;
  pressKey(key: string): Promise<void>;
  readFieldValue(selector: string): Promise<string | undefined>;
  readInnerHtml(selector: string): Promise<string | undefined>;
  click(selector: string): Promise<void>;
  clickFirst(selectors: string[]): Promise<boolean>;
  clickFirstByText(texts: string[], selector?: string): Promise<string | undefined>;
  waitForAnySelector(selectors: string[], timeoutMs?: number): Promise<string | undefined>;
  waitForSelector(selector: string, timeoutMs?: number): Promise<boolean>;
  isVisible(selector: string): Promise<boolean>;
  url(): string;
  title(): Promise<string>;
  screenshot(filePath: string): Promise<string>;
  content(): Promise<string>;
  contentIncludesAny(markers: string[]): Promise<boolean>;
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
  reload(options?: { waitUntil?: 'domcontentloaded' | 'load' }): Promise<unknown>;
  fill(selector: string, value: string): Promise<void>;
  keyboard: { press(key: string): Promise<void> };
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
      async reload(): Promise<unknown> {
        logger.debug('browser.stub.reload');
        return null;
      },
      async readLinkHrefByText(texts: string[]): Promise<string | undefined> {
        logger.debug('browser.stub.readLinkHrefByText', { texts });
        return undefined;
      },
      async fill(selector: string, value: string): Promise<void> {
        logger.debug('browser.stub.fill', { selector, valueLength: value.length });
      },
      async prependText(selectors: string[], text: string): Promise<boolean> {
        logger.debug('browser.stub.prependText', { selectors, textLength: text.length });
        return selectors.length > 0;
      },
      async pressKey(key: string): Promise<void> {
        logger.debug('browser.stub.pressKey', { key });
      },
      async readFieldValue(): Promise<string | undefined> {
        return undefined;
      },
      async readInnerHtml(): Promise<string | undefined> {
        return undefined;
      },
      async click(selector: string): Promise<void> {
        logger.debug('browser.stub.click', { selector });
      },
      async clickFirst(selectors: string[]): Promise<boolean> {
        logger.debug('browser.stub.clickFirst', { selectors });
        return selectors.length > 0;
      },
      async clickFirstByText(texts: string[]): Promise<string | undefined> {
        logger.debug('browser.stub.clickFirstByText', { texts });
        return texts[0];
      },
      async waitForAnySelector(selectors: string[]): Promise<string | undefined> {
        logger.debug('browser.stub.waitForAnySelector', { selectors });
        return selectors.length > 0 ? selectors[0] : undefined;
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
      async contentIncludesAny(markers: string[]): Promise<boolean> {
        logger.debug('browser.stub.contentIncludesAny', { markerCount: markers.length });
        return markers.length > 0;
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
      reload(): Promise<unknown> {
        return page.reload({ waitUntil: 'domcontentloaded' });
      },
      async readLinkHrefByText(texts: string[]): Promise<string | undefined> {
        const result = await page.evaluate(
          `(${((candidateTexts: string[]) => {
            const normalizedTexts = candidateTexts.map((text) => text.trim().toLowerCase());
            const links = Array.from(document.querySelectorAll('a[href]'));

            for (const link of links) {
              const text = (link.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
              if (!text) continue;

              const matches = normalizedTexts.some(
                (candidate) => text === candidate || text.includes(candidate)
              );
              if (!matches) continue;

              const href = link.getAttribute('href');
              if (!href) continue;

              try {
                return new URL(href, window.location.href).href;
              } catch {
                return href;
              }
            }

            return undefined;
          }).toString()})(${JSON.stringify(texts)})`
        );

        return typeof result === 'string' ? result : undefined;
      },
      fill(selector: string, value: string): Promise<void> {
        return page.fill(selector, value);
      },
      async prependText(selectors: string[], text: string): Promise<boolean> {
        for (const selector of selectors) {
          const inserted = await page.evaluate(
            `(${((targetSelector: string, nextText: string) => {
              const element = document.querySelector(targetSelector);
              if (
                !(element instanceof HTMLElement) &&
                !(element instanceof HTMLTextAreaElement) &&
                !(element instanceof HTMLInputElement)
              ) {
                return false;
              }

              const note = nextText.trim();

              if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
                const current = element.value || '';
                if (current.includes(note)) {
                  return true;
                }

                element.value = `${note}\n\n${current}`.trimEnd();
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
              }

              const currentText = element.innerText || element.textContent || '';
              if (currentText.includes(note)) {
                return true;
              }

              const doc = element.ownerDocument;
              const noteNode = doc.createElement('div');
              noteNode.textContent = note;
              const spacerNode = doc.createElement('div');
              spacerNode.innerHTML = '<br>';

              if (element.firstChild) {
                element.insertBefore(spacerNode, element.firstChild);
                element.insertBefore(noteNode, spacerNode);
              } else {
                element.appendChild(noteNode);
                element.appendChild(spacerNode);
              }

              element.dispatchEvent(new Event('input', { bubbles: true }));
              element.dispatchEvent(new Event('change', { bubbles: true }));
              return true;
            }).toString()})(${JSON.stringify(selector)}, ${JSON.stringify(text)})`
          );

          if (inserted === true) {
            return true;
          }
        }

        return false;
      },
      pressKey(key: string): Promise<void> {
        return page.keyboard.press(key);
      },
      async readFieldValue(selector: string): Promise<string | undefined> {
        const result = await page.evaluate(
          `(${((targetSelector: string) => {
            const element = document.querySelector(targetSelector);
            if (!element) return undefined;

            if (
              element instanceof HTMLInputElement ||
              element instanceof HTMLTextAreaElement ||
              element instanceof HTMLSelectElement
            ) {
              return element.value;
            }

            return element.textContent?.trim() || undefined;
          }).toString()})(${JSON.stringify(selector)})`
        );

        return typeof result === 'string' ? result : undefined;
      },
      async readInnerHtml(selector: string): Promise<string | undefined> {
        const result = await page.evaluate(
          `(${((targetSelector: string) => {
            const element = document.querySelector(targetSelector);
            return element?.innerHTML ?? undefined;
          }).toString()})(${JSON.stringify(selector)})`
        );

        return typeof result === 'string' ? result : undefined;
      },
      click(selector: string): Promise<void> {
        return page.click(selector);
      },
      async clickFirst(selectors: string[]): Promise<boolean> {
        for (const selector of selectors) {
          try {
            await page.waitForSelector(selector, { timeout: 1_500 });
            await page.click(selector);
            return true;
          } catch {
            continue;
          }
        }

        return false;
      },
      async clickFirstByText(
        texts: string[],
        selector = 'button, a, span, small, [role="button"], .clear.button'
      ): Promise<string | undefined> {
        const result = await page.evaluate(
          `(${((candidateTexts: string[], rootSelector: string) => {
            const normalizedTexts = candidateTexts.map((text) => text.trim().toLowerCase());
            const elements = Array.from(document.querySelectorAll(rootSelector));

            for (const element of elements) {
              const text = (element.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
              if (!text) continue;

              const matched = normalizedTexts.find(
                (candidate) => text === candidate || text.includes(candidate)
              );
              if (!matched) continue;

              const clickable =
                element.closest('[role="button"], button, a, .clear.button') || element;

              if (clickable instanceof HTMLElement) {
                const style = window.getComputedStyle(clickable);
                const rect = clickable.getBoundingClientRect();
                const visibleEnough =
                  style.display !== 'none' &&
                  style.visibility !== 'hidden' &&
                  style.opacity !== '0' &&
                  rect.width > 0 &&
                  rect.height > 0;

                if (!visibleEnough) {
                  continue;
                }

                clickable.scrollIntoView({ block: 'center', inline: 'center' });
                clickable.click();
                return matched;
              }
            }

            return undefined;
          }).toString()})(${JSON.stringify(texts)}, ${JSON.stringify(selector)})`
        );

        return typeof result === 'string' ? result : undefined;
      },
      async waitForAnySelector(
        selectors: string[],
        timeoutMs = 10_000
      ): Promise<string | undefined> {
        for (const selector of selectors) {
          try {
            await page.waitForSelector(selector, { timeout: timeoutMs });
            return selector;
          } catch {
            continue;
          }
        }

        return undefined;
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
      async contentIncludesAny(markers: string[]): Promise<boolean> {
        if (markers.length === 0) {
          return false;
        }

        const pageHtml = (await page.content()).toLowerCase();
        return markers.some((marker) => pageHtml.includes(marker.toLowerCase()));
      },
      async visibleListHtml(listSelector: string): Promise<string | undefined> {
        const result = await page.evaluate(
          `(${((selector: string) => {
            const root = document.querySelector(selector);
            if (!root) return undefined;

            const nodes = Array.from(root.querySelectorAll('div, li')).filter((node) => {
              const cls = (node.getAttribute('class') || '').toLowerCase();
              return (
                cls.includes('mail-item') ||
                cls.includes('message-row') ||
                cls.includes('thread-row') ||
                cls.includes('list-item')
              );
            });

            const escape = (value: string): string =>
              value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

            const normalizedRows = nodes.map((node) => {
              const cls = (node.getAttribute('class') || '').toLowerCase();
              const isUnread = cls.includes('unread');
              const from = node.querySelector('.from')?.textContent?.trim() || '';
              const subject = node.querySelector('.subject')?.textContent?.trim() || '';
              const datetime =
                node.querySelector('.datetime, .date, .time')?.textContent?.trim() || '';
              const preview = node.querySelector('.preview, .snippet')?.textContent?.trim() || '';
              const inputId = node.querySelector('input[id]')?.getAttribute('id') || '';
              const rowType =
                cls.includes('ad') || cls.includes('adds-messages-list') ? 'ad' : 'message';

              return (
                '<div class="mail-item ' +
                cls.split(' ').filter(Boolean).join(' ').trim() +
                '"' +
                (inputId ? ' data-id="' + escape(inputId) + '"' : '') +
                (isUnread ? ' data-unread="true"' : '') +
                ' data-row-type="' +
                rowType +
                '">' +
                '<span class="from">' +
                escape(from) +
                '</span>' +
                '<span class="subject">' +
                escape(subject) +
                '</span>' +
                '<span class="datetime">' +
                escape(datetime) +
                '</span>' +
                (preview ? '<span class="preview">' + escape(preview) + '</span>' : '') +
                '</div>'
              );
            });

            return normalizedRows.join('\n');
          }).toString()})(${JSON.stringify(listSelector)})`
        );

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
