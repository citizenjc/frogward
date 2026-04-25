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
        seenMessages: snapshot.seen.length,
        forwardedMessages: snapshot.forwarded.length
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

          const runSingleScan = async () =>
            runModule('check', () => checkInbox({ config, logger, page, state }));

          const processForwardCandidates = async (
            listing: Awaited<ReturnType<typeof runSingleScan>>,
            forwardedSnapshot?: Awaited<ReturnType<typeof state.load>>
          ): Promise<void> => {
            const snapshotForForward = forwardedSnapshot ?? (await state.load());
            if (!config.forwardingEnabled) {
              logger.info('app.forward.skipped', {
                reason: 'forwarding_disabled'
              });
              return;
            }

            if (!config.destinationEmail) {
              throw new ModuleError('forward', 'DESTINATION_EMAIL is required for forward mode.');
            }

            const candidates = listing.newMessages ?? [];
            logger.info('app.forward.start', { candidateCount: candidates.length });
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

              const result = await runModule('forward', () =>
                forwardMessage({ config, logger, page, message })
              );

              if (result.status === 'success') {
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
              logger.warn('app.forward.failed', {
                messageId: message.id,
                stage: result.stage ?? 'unknown',
                reason: record.reason
              });
            }

            logger.info('app.forward.complete', {
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

            await waitForStopSignal(controller, logger);
            return;
          }

          if (options.mode === 'service') {
            logger.info('app.service.start', {
              pollIntervalMs: config.pollIntervalMs,
              pollErrorBackoffMs: config.pollErrorBackoffMs
            });

            const controller = createPollController({
              check: runSingleScan,
              afterCheck: async (listing) => {
                logger.info('app.check.complete', {
                  discoveredMessages: listing.messages.length,
                  newMessages: listing.newMessages?.length ?? 0,
                  alreadySeen: listing.alreadySeenMessages?.length ?? 0,
                  skippedAdRowCount: listing.probe.skippedAdRowCount,
                  parserFallbacksUsed: listing.probe.parserFallbacksUsed
                });
                await processForwardCandidates(listing);
              },
              logger,
              config: {
                pollIntervalMs: config.pollIntervalMs,
                pollErrorBackoffMs: config.pollErrorBackoffMs
              }
            });

            await waitForStopSignal(controller, logger);
            return;
          }

          const listing = await runSingleScan();
          logger.info('app.check.complete', {
            discoveredMessages: listing.messages.length,
            newMessages: listing.newMessages?.length ?? 0,
            alreadySeen: listing.alreadySeenMessages?.length ?? 0,
            skippedAdRowCount: listing.probe.skippedAdRowCount,
            parserFallbacksUsed: listing.probe.parserFallbacksUsed
          });

          if (options.mode === 'once' && options.safetyLevel === 'forward') {
            logger.info('app.forward.deferred', {
              reason: 'forwarding is intentionally out-of-scope for this milestone',
              eligibleMessages: listing.newMessages?.length ?? 0
            });
          }

          if (options.mode === 'forward-new') {
            await processForwardCandidates(listing, snapshot);
          }
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
    logger.error('app.failure.screenshot', summarizeArtifact(outputPath));
  }

  const htmlPath = join(failureDir, `failure-${Date.now()}.html`);
  const html = await session.page.content();
  await writeFile(htmlPath, html, 'utf8');
  logger.error('app.failure.html', {
    html: summarizeArtifact(htmlPath),
    trace: summarizeArtifact(tracePath)
  });
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

async function waitForStopSignal(
  controller: { stop(): void; waitUntilStopped(): Promise<void> },
  logger: AppRuntime['logger']
): Promise<void> {
  await new Promise<void>((resolve) => {
    const handle = (): void => {
      controller.stop();
      logger.info('app.poll.stop-signal');
      process.off('SIGINT', handle);
      process.off('SIGTERM', handle);
      void controller.waitUntilStopped().finally(resolve);
    };

    process.on('SIGINT', handle);
    process.on('SIGTERM', handle);
  });
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
