import { createEnvSource, loadConfig } from './config/env.js';
import { createBrowserManager } from './lib/browser.js';
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
        appMode: config.mode,
        processedMessages: snapshot.processed.length
      });

      await browser.withPage(async (page) => {
        await loginToSapo({ config, logger, page });
        const messages = await checkInbox({ config, logger, page, state });

        if (options.mode === 'check') {
          logger.info('app.check.complete', { discoveredMessages: messages.length });
          return;
        }

        for (const message of messages) {
          await forwardMessage({ config, logger, page, message });
        }

        logger.info('app.once.complete', { processedMessages: messages.length });
      });
    }
  };
}
