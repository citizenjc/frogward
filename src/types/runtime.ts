import type { AppConfig } from '../config/schema.js';
import type { BrowserManager } from '../lib/browser.js';
import type { Logger } from '../lib/logger.js';
import type { StateStore } from '../modules/state.js';
import type {
  ForwardedMessageRecord,
  InboxProbeSummary,
  MessageSummary,
  SeenMessageRecord
} from './message.js';

export type SafetyLevel = 'probe' | 'forward';
export type RunMode = 'check' | 'once' | 'poll' | 'forward-new' | 'service';

export interface RunOptions {
  mode: RunMode;
  safetyLevel: SafetyLevel;
}

export interface ForwardingSecurityGate {
  enabled: boolean;
  acknowledged: boolean;
  warpApprovalToken?: string;
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

export type ForwardStage = 'open' | 'compose' | 'send' | 'confirm';

export type ForwardFailureReason =
  | 'missing_destination'
  | 'open_message_failed'
  | 'forward_action_not_found'
  | 'compose_open_failed'
  | 'recipient_verification_failed'
  | 'submit_not_found'
  | 'send_failed'
  | 'send_confirmation_missing';

export interface ForwardConfirmationSignal {
  via: 'selector' | 'content';
  signal: string;
}

export interface ForwardMessageResult {
  messageId: string;
  status: 'success' | 'failed' | 'skipped';
  reason?: ForwardFailureReason;
  stage?: ForwardStage;
  confirmation?: ForwardConfirmationSignal;
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
    alreadySeenCount?: number;
    newMessageCount?: number;
    bootstrapScan?: boolean;
  };
  newMessages?: MessageSummary[];
  alreadySeenMessages?: MessageSummary[];
}

export interface PollCycleSummary {
  cycle: number;
  startedAt: string;
  finishedAt: string;
  parsedCount: number;
  newCount: number;
  alreadySeenCount: number;
  bootstrapScan: boolean;
}

export interface SeenMailboxState {
  seen: SeenMessageRecord[];
  forwarded: ForwardedMessageRecord[];
  scan: {
    lastScanAt?: string;
    bootstrapCompletedAt?: string;
    scanCount: number;
    lastNewCount: number;
  };
}
