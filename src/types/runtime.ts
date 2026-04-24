import type { AppConfig } from '../config/schema.js';
import type { BrowserManager } from '../lib/browser.js';
import type { Logger } from '../lib/logger.js';
import type { StateStore } from '../modules/state.js';
import type { InboxProbeSummary, MessageSummary } from './message.js';

export type SafetyLevel = 'probe' | 'forward';
export type RunMode = 'check' | 'once';

export interface RunOptions {
  mode: RunMode;
  safetyLevel: SafetyLevel;
}

export interface ModuleContext {
  config: AppConfig;
  logger: Logger;
}

export interface InboxContext extends ModuleContext {
  state: StateStore;
}

export interface ForwardContext extends ModuleContext {
  message: MessageSummary;
}

export interface AppRuntime {
  config: AppConfig;
  logger: Logger;
  browser: BrowserManager;
  state: StateStore;
}

export interface LoginResult {
  status: 'reused-session' | 'interactive-login';
  inboxReached: boolean;
}

export interface InboxListingResult {
  messages: MessageSummary[];
  probe: InboxProbeSummary & {
    parsedMessageCount: number;
    skippedAdRowCount: number;
    parserFallbacksUsed: string[];
  };
}
