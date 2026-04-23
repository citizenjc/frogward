import type { AppConfig } from '../config/schema.js';
import type { BrowserManager } from '../lib/browser.js';
import type { Logger } from '../lib/logger.js';
import type { StateStore } from '../modules/state.js';

export interface AppRuntime {
  config: AppConfig;
  logger: Logger;
  browser: BrowserManager;
  state: StateStore;
}
