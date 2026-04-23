import { createEnvSource, loadConfig } from './config/env.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createBrowserManager } from './lib/browser.js';
import type { BrowserSession } from './lib/browser.js';
import { isAppError, ModuleError } from './lib/errors.js';
import { createLogger } from './lib/logger.js';
import { checkInbox } from './modules/check.js';
import { forwardMessage } from './modules/forward.js';
import { loginToSapo } from './modules/login.js';
import { createStateStore } from './modules/state.js';
import type { AppRuntime, RunOptions } from './types/runtime.js';

export function createApp(runtimeOverrides: Partial<AppRuntime> = {}) {
  return {
    async run(options: RunOptions): Promise<void> {
      const config = runtimeOverrides.config ?? loadConfig(createEnvSource());
      const logger = runtimeOverrides.logger ?? createLogger(config.logLevel);
      const browser = runtimeOverrides.browser ?? createBrowserManager({ config, logger });
      const state = runtimeOverrides.state ?? createStateStore(config.stateFilePath);
      const snapshot = await state.load();

      logger.info('app.start', {
        mode: options.mode,
        safetyLevel: options.safetyLevel,
        appMode: config.mode,
        processedMessages: snapshot.processed.length
      });

      await browser.withSession(async (session) => {
        const tracePath = join(config.artifactDir, 'trace', `probe-${Date.now()}.zip`);
        let failed = false;

        if (config.mode === 'live' && config.captureTraceOnFailure) {
          await mkdir(join(config.artifactDir, 'trace'), { recursive: true });
          await runModule('app', () => session.startTrace('sapo-live-probe'));
        }

        const page = session.page;
        try {
          const loginResult = await runModule('login', () =>
            loginToSapo({ config, logger, page, usingStorageState: session.usingStorageState })
          );

          if (
            config.mode === 'live' &&
            loginResult.status === 'interactive-login' &&
            config.persistStorageState &&
            config.storageStatePath
          ) {
            const storageStatePath = config.storageStatePath;
            await runModule('login', () => session.saveStorageState(storageStatePath));
          }

          const messages = await runModule('check', () =>
            checkInbox({ config, logger, page, state })
          );

          if (options.mode === 'check' || options.safetyLevel === 'probe') {
            logger.info('app.check.complete', { discoveredMessages: messages.length });
            return;
          }

          if (!config.destinationEmail) {
            throw new ModuleError(
              'forward',
              'DESTINATION_EMAIL is required for forward safety mode.',
              {
                mode: options.mode,
                safetyLevel: options.safetyLevel
              }
            );
          }

          for (const message of messages) {
            await runModule('forward', () => forwardMessage({ config, logger, page, message }));
          }

          logger.info('app.once.complete', { processedMessages: messages.length });
        } catch (error) {
          failed = true;
          await captureFailureArtifacts(config, logger, session, tracePath);
          throw error;
        } finally {
          if (config.mode === 'live' && config.captureTraceOnFailure && failed) {
            await runModule('app', () => session.stopTrace(tracePath));
            logger.info('app.trace.saved', { tracePath });
          }
        }
      });
    }
  };
}

async function captureFailureArtifacts(
  config: AppRuntime['config'],
  logger: AppRuntime['logger'],
  session: BrowserSession,
  tracePath: string
): Promise<void> {
  if (config.mode !== 'live') {
    return;
  }

  const failureDir = join(config.artifactDir, 'failure');
  await mkdir(failureDir, { recursive: true });

  if (config.captureScreenshotOnFailure) {
    const screenshotPath = join(failureDir, `failure-${Date.now()}.png`);
    const outputPath = await session.page.screenshot(screenshotPath);
    logger.error('app.failure.screenshot', { outputPath });
  }

  const htmlPath = join(failureDir, `failure-${Date.now()}.html`);
  const html = await session.page.content();
  await writeFile(htmlPath, html, 'utf8');
  logger.error('app.failure.html', { htmlPath, tracePath });
}

async function runModule<T>(moduleName: string, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }

    throw new ModuleError(moduleName, `${moduleName} module failed.`, {
      cause: error instanceof Error ? error.message : 'unknown'
    });
  }
}
