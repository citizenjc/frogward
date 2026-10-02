import { createEnvSource, loadConfig } from './config/env.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createBrowserManager } from './lib/browser.js';
import type { BrowserSession } from './lib/browser.js';
import { isAppError, ModuleError } from './lib/errors.js';
import { createLogger } from './lib/logger.js';
import { checkInbox } from './modules/check.js';
import { decideForwardEligibility } from './modules/forward-filter.js';
import { forwardMessage } from './modules/forward.js';
import { loginToSapo } from './modules/login.js';
import { createPollController } from './modules/poll.js';
import type { PollController, PollStopReason } from './modules/poll.js';
import { createStateStore } from './modules/state.js';
import type { StateSnapshot } from './modules/state.js';
import type { ForwardedMessageRecord } from './types/message.js';
import type { AppRuntime, InboxListingResult, RunOptions } from './types/runtime.js';

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
        seenMessages: snapshot.seen.length,
        forwardedMessages: snapshot.forwarded.length
      });

      const stopSignal =
        options.mode === 'poll' || options.mode === 'service'
          ? createStopSignal(logger)
          : undefined;

      const sessionBody = async (session: BrowserSession): Promise<SessionOutcome> => {
        const tracePath = join(config.artifactDir, 'trace', `probe-${Date.now()}.zip`);
        let failed = false;
        let traceActive = false;

        const traceEnabled =
          config.mode === 'live' && config.captureTraceOnFailure && options.mode !== 'service';
        const handledForwardTraceEnabled = config.mode === 'live' && config.captureTraceOnFailure;

        if (traceEnabled) {
          await mkdir(join(config.artifactDir, 'trace'), { recursive: true });
          await runModule('app', () => session.startTrace('sapo-live-probe'));
          traceActive = true;
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

          const runSingleScan = async () =>
            runModule('check', () => checkInbox({ config, logger, page, state }));

          const processForwardCandidates = async (
            listing: Awaited<ReturnType<typeof runSingleScan>>,
            forwardedSnapshot?: Awaited<ReturnType<typeof state.load>>,
            quietNoop = false
          ): Promise<void> => {
            const snapshotForForward = forwardedSnapshot ?? (await state.load());
            if (!config.forwardingEnabled) {
              logger.debug('app.forward.skipped', {
                reason: 'forwarding_disabled'
              });
              return;
            }

            if (!config.destinationEmail) {
              throw new ModuleError('forward', 'DESTINATION_EMAIL is required for forward mode.');
            }

            const candidates = collectForwardCandidates(listing, snapshotForForward);
            if (candidates.length > 0 || !quietNoop) {
              logger.info('app.forward.start', { candidateCount: candidates.length });
            } else {
              logger.debug('app.forward.start', { candidateCount: candidates.length });
            }
            const forwardedRecords = new Map(
              snapshotForForward.forwarded.map((entry) => [entry.id, entry])
            );
            const outcomeCounts = {
              filtered: 0,
              success: 0,
              failed: 0
            };

            for (const message of candidates) {
              const decision = decideForwardEligibility(message, config);
              if (!decision.eligible) {
                const record = {
                  id: message.id,
                  forwardedAt: new Date().toISOString(),
                  destination: config.destinationEmail,
                  status: 'filtered',
                  reason: decision.reason,
                  attempts: 0
                } as const;
                await state.markForwarded(record);
                forwardedRecords.set(message.id, record);
                outcomeCounts.filtered += 1;
                logger.info('app.forward.filtered', {
                  messageId: message.id,
                  reason: decision.reason
                });
                continue;
              }

              const perMessageTracePath =
                handledForwardTraceEnabled && options.mode === 'service'
                  ? join(
                      config.artifactDir,
                      'trace',
                      `forward-${sanitizeArtifactToken(message.id)}-${Date.now()}.zip`
                    )
                  : undefined;

              if (perMessageTracePath) {
                await mkdir(join(config.artifactDir, 'trace'), { recursive: true });
                await runModule('app', () =>
                  session.startTrace(`sapo-forward-${sanitizeArtifactToken(message.id)}`)
                );
              }

              const result = await runModule('forward', () =>
                forwardMessage({ config, logger, page, message })
              );

              if (result.status === 'success') {
                if (perMessageTracePath) {
                  await runModule('app', () => session.stopTrace());
                }

                const previousAttempts = forwardedRecords.get(message.id)?.attempts ?? 0;
                const record = {
                  id: message.id,
                  forwardedAt: new Date().toISOString(),
                  destination: config.destinationEmail,
                  status: 'success',
                  attempts: previousAttempts + 1
                } as const;
                await state.markForwarded(record);
                forwardedRecords.set(message.id, record);
                outcomeCounts.success += 1;
                continue;
              }

              const previousAttempts = forwardedRecords.get(message.id)?.attempts ?? 0;
              const record = {
                id: message.id,
                forwardedAt: new Date().toISOString(),
                destination: config.destinationEmail,
                status: 'failed',
                reason: result.reason ?? 'forward_failed',
                attempts: previousAttempts + 1
              } as const;
              await state.markForwarded(record);
              forwardedRecords.set(message.id, record);
              outcomeCounts.failed += 1;

              const failureArtifactTag = `forward-${sanitizeArtifactToken(message.id)}-${result.stage ?? 'unknown'}`;
              let failureTracePath = perMessageTracePath;

              if (!failureTracePath && traceEnabled && traceActive) {
                failureTracePath = join(
                  config.artifactDir,
                  'trace',
                  `${failureArtifactTag}-${Date.now()}.zip`
                );
                traceActive = false;
              }

              if (failureTracePath) {
                await saveTraceArtifact(session, logger, failureTracePath, {
                  messageId: message.id,
                  reason: record.reason,
                  stage: result.stage ?? 'unknown'
                });
              }

              await captureFailureArtifacts(config, logger, session, {
                artifactTag: failureArtifactTag,
                tracePath: failureTracePath
              });

              if (!perMessageTracePath && traceEnabled) {
                await runModule('app', () => session.startTrace('sapo-live-probe'));
                traceActive = true;
              }

              logger.warn('app.forward.failed', {
                messageId: message.id,
                stage: result.stage ?? 'unknown',
                reason: record.reason
              });
            }

            const completionLevel =
              !quietNoop ||
              candidates.length > 0 ||
              outcomeCounts.filtered > 0 ||
              outcomeCounts.failed > 0
                ? 'info'
                : 'debug';
            logger[completionLevel]('app.forward.complete', {
              candidateCount: candidates.length,
              filteredCount: outcomeCounts.filtered,
              successCount: outcomeCounts.success,
              failedCount: outcomeCounts.failed
            });
          };

          if (options.mode === 'poll') {
            logger.info('app.poll.start', {
              pollIntervalMs: config.pollIntervalMs,
              pollErrorBackoffMs: config.pollErrorBackoffMs
            });

            const controller = createPollController({
              check: runSingleScan,
              logger,
              config: {
                pollIntervalMs: config.pollIntervalMs,
                pollErrorBackoffMs: config.pollErrorBackoffMs
              }
            });

            return runUntilStopped(controller, stopSignal);
          }

          if (options.mode === 'service') {
            logger.info('app.service.start', {
              pollIntervalMs: config.pollIntervalMs,
              pollErrorBackoffMs: config.pollErrorBackoffMs
            });

            const controller = createPollController({
              check: runSingleScan,
              afterCheck: async (listing) => {
                const checkSummary = {
                  discoveredMessages: listing.messages.length,
                  newMessages: listing.newMessages?.length ?? 0,
                  alreadySeen: listing.alreadySeenMessages?.length ?? 0,
                  skippedAdRowCount: listing.probe.skippedAdRowCount,
                  parserFallbacksUsed: listing.probe.parserFallbacksUsed
                };
                const shouldLogCheckAtInfo =
                  checkSummary.newMessages > 0 ||
                  checkSummary.skippedAdRowCount > 0 ||
                  checkSummary.parserFallbacksUsed.length > 0;
                logger[shouldLogCheckAtInfo ? 'info' : 'debug']('app.check.complete', checkSummary);
                await processForwardCandidates(listing, undefined, true);
              },
              logger,
              config: {
                pollIntervalMs: config.pollIntervalMs,
                pollErrorBackoffMs: config.pollErrorBackoffMs
              }
            });

            return runUntilStopped(controller, stopSignal);
          }

          const listing = await runSingleScan();
          const checkSummary = {
            discoveredMessages: listing.messages.length,
            newMessages: listing.newMessages?.length ?? 0,
            alreadySeen: listing.alreadySeenMessages?.length ?? 0,
            skippedAdRowCount: listing.probe.skippedAdRowCount,
            parserFallbacksUsed: listing.probe.parserFallbacksUsed
          };
          logger.info('app.check.complete', checkSummary);

          if (options.mode === 'once' && options.safetyLevel === 'forward') {
            logger.info('app.forward.deferred', {
              reason: 'forwarding is intentionally out-of-scope for this milestone',
              eligibleMessages: listing.newMessages?.length ?? 0
            });
          }

          if (options.mode === 'forward-new') {
            await processForwardCandidates(listing, snapshot, false);
          }
          return undefined;
        } catch (error) {
          failed = true;
          if (traceEnabled && traceActive) {
            await saveTraceArtifact(session, logger, tracePath);
            traceActive = false;
          }

          await captureFailureArtifacts(config, logger, session, { tracePath });
          throw error;
        } finally {
          if (traceEnabled && failed && traceActive) {
            await saveTraceArtifact(session, logger, tracePath);
            traceActive = false;
          }
        }
      };

      if (!stopSignal) {
        await browser.withSession(sessionBody);
        return;
      }

      await runWithSessionRecovery(
        () => browser.withSession(sessionBody),
        stopSignal,
        config,
        logger
      );
    }
  };
}

const MAX_FORWARD_ATTEMPTS = 3;
const MAX_SESSION_RESTART_DELAY_MS = 15 * 60_000;
const HEALTHY_SESSION_MS = 30 * 60_000;

// What a browser session ended with; undefined for one-shot modes.
type SessionOutcome = PollStopReason | undefined;

// Failures where the send control was already clicked. Retrying these would re-send
// the message to the destination on every poll cycle, so they are terminal.
const NON_RETRYABLE_FORWARD_REASONS = new Set<ForwardedMessageRecord['reason']>([
  'send_confirmation_missing'
]);

function isRetryableForwardFailure(entry: ForwardedMessageRecord): boolean {
  return (
    entry.status === 'failed' &&
    entry.attempts < MAX_FORWARD_ATTEMPTS &&
    !NON_RETRYABLE_FORWARD_REASONS.has(entry.reason)
  );
}

function collectForwardCandidates(listing: InboxListingResult, snapshot: StateSnapshot) {
  const candidates = new Map((listing.newMessages ?? []).map((message) => [message.id, message]));
  const failedForwardIds = new Set(
    snapshot.forwarded.filter(isRetryableForwardFailure).map((entry) => entry.id)
  );

  for (const message of listing.messages) {
    if (!failedForwardIds.has(message.id)) {
      continue;
    }

    candidates.set(message.id, message);
  }

  return Array.from(candidates.values());
}

async function captureFailureArtifacts(
  config: AppRuntime['config'],
  logger: AppRuntime['logger'],
  session: BrowserSession,
  options: {
    tracePath?: string;
    artifactTag?: string;
  } = {}
): Promise<void> {
  if (config.mode !== 'live') {
    return;
  }

  const failureDir = join(config.artifactDir, 'failure');
  await mkdir(failureDir, { recursive: true });
  const artifactSuffix = options.artifactTag ? `-${options.artifactTag}` : '';

  if (config.captureScreenshotOnFailure) {
    const screenshotPath = join(failureDir, `failure${artifactSuffix}-${Date.now()}.png`);
    const outputPath = await session.page.screenshot(screenshotPath);
    logger.error('app.failure.screenshot', summarizeArtifact(outputPath));
  }

  const htmlPath = join(failureDir, `failure${artifactSuffix}-${Date.now()}.html`);
  const html = await session.page.content();
  await writeFile(htmlPath, html, 'utf8');
  logger.error('app.failure.html', {
    html: summarizeArtifact(htmlPath),
    trace: options.tracePath ? summarizeArtifact(options.tracePath) : undefined
  });
}

async function saveTraceArtifact(
  session: BrowserSession,
  logger: AppRuntime['logger'],
  tracePath: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  await runModule('app', () => session.stopTrace(tracePath));
  logger.info('app.trace.saved', { tracePath, ...metadata });
}

function sanitizeArtifactToken(value: string): string {
  const sanitized = value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return sanitized || 'message';
}

function summarizeArtifact(filePath: string): {
  fileName: string;
  localOnly: boolean;
  relativeDir: string;
} {
  const normalized = filePath.replaceAll('\\', '/');
  const segments = normalized.split('/').filter(Boolean);
  const fileName = segments.at(-1) ?? 'unknown';
  const relativeDir = segments.slice(-2, -1)[0] ?? 'unknown';

  return {
    fileName,
    localOnly: normalized.includes('/tmp/') || normalized.startsWith('tmp/'),
    relativeDir
  };
}

// Long-running modes keep going across browser sessions: when a session goes bad
// (SAPO login expired, Chromium crashed or hung) it is closed and a fresh one,
// including a new login, is started instead of polling a dead page forever.
async function runWithSessionRecovery(
  runSession: () => Promise<SessionOutcome>,
  stopSignal: StopSignal,
  config: AppRuntime['config'],
  logger: AppRuntime['logger']
): Promise<void> {
  try {
    let consecutiveSessionFailures = 0;

    while (!stopSignal.stopped) {
      const startedAt = Date.now();
      let outcome: SessionOutcome;
      let failure: unknown;
      try {
        outcome = await runSession();
      } catch (error) {
        if (stopSignal.stopped) {
          throw error;
        }
        failure = error;
      }

      if (stopSignal.stopped || outcome === 'stopped') {
        return;
      }

      if (outcome === 'expired') {
        consecutiveSessionFailures = 0;
        logger.info('app.session.restart', { reason: 'expired' });
        continue;
      }

      // A session that worked for a while before failing starts the backoff over.
      if (Date.now() - startedAt >= HEALTHY_SESSION_MS) {
        consecutiveSessionFailures = 0;
      }
      consecutiveSessionFailures += 1;
      const delayMs = Math.min(
        config.pollErrorBackoffMs * 2 ** (consecutiveSessionFailures - 1),
        MAX_SESSION_RESTART_DELAY_MS
      );
      logger[failure ? 'error' : 'warn']('app.session.restart', {
        reason: failure ? 'session_failed' : 'unhealthy',
        consecutiveFailures: consecutiveSessionFailures,
        retryInMs: delayMs,
        ...(failure
          ? {
              message: failure instanceof Error ? failure.message : 'unknown',
              ...(isAppError(failure) ? { code: failure.code, ...failure.details } : {})
            }
          : {})
      });
      await stopSignal.sleep(delayMs);
    }
  } finally {
    stopSignal.dispose();
  }
}

interface StopSignal {
  readonly stopped: boolean;
  onStop(listener: () => void): () => void;
  sleep(ms: number): Promise<void>;
  dispose(): void;
}

function createStopSignal(logger: AppRuntime['logger']): StopSignal {
  let stopped = false;
  const listeners = new Set<() => void>();

  const handle = (): void => {
    if (stopped) {
      return;
    }
    stopped = true;
    logger.info('app.poll.stop-signal');
    for (const listener of listeners) {
      listener();
    }
  };

  process.on('SIGINT', handle);
  process.on('SIGTERM', handle);

  return {
    get stopped() {
      return stopped;
    },
    onStop(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    sleep(ms: number): Promise<void> {
      return new Promise<void>((resolve) => {
        const done = (): void => {
          clearTimeout(timer);
          listeners.delete(done);
          resolve();
        };
        const timer = setTimeout(done, ms);
        listeners.add(done);
      });
    },
    dispose(): void {
      process.off('SIGINT', handle);
      process.off('SIGTERM', handle);
      listeners.clear();
    }
  };
}

async function runUntilStopped(
  controller: PollController,
  stopSignal: StopSignal | undefined
): Promise<PollStopReason> {
  if (!stopSignal || stopSignal.stopped) {
    controller.stop();
  }
  const unsubscribe = stopSignal?.onStop(() => controller.stop());
  try {
    return await controller.waitUntilStopped();
  } finally {
    unsubscribe?.();
  }
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
