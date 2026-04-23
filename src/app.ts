import { createEnvSource, loadConfig } from './config/env.js';
import { createBrowserManager } from './lib/browser.js';
import { createLogger } from './lib/logger.js';
import { checkInbox } from './modules/check.js';
import { forwardMessage } from './modules/forward.js';
import { loginToSapo } from './modules/login.js';
import { createStateStore } from './modules/state.js';
import type { AppRuntime } from './types/runtime.js';

export function createApp(runtimeOverrides: Partial<AppRuntime> = {}) {
  return {
    async run(args: string[]): Promise<void> {
      const config = runtimeOverrides.config ?? loadConfig(createEnvSource());
      const logger = runtimeOverrides.logger ?? createLogger(config.logLevel);
      const browser = runtimeOverrides.browser ?? createBrowserManager();
      const state = runtimeOverrides.state ?? createStateStore(config.stateFilePath);

      logger.info('app.start', { mode: args.includes('--check') ? 'check' : 'run' });

      await browser.withPage(async (page) => {
        await loginToSapo({ config, logger, page });
        const messages = await checkInbox({ config, logger, page, state });

        for (const message of messages) {
          await forwardMessage({ config, logger, page, message });
        }
      });
    }
  };
}
