import { setTimeout as sleep } from 'node:timers/promises';

import type { AppConfig } from '../config/schema.js';
import { isAppError } from '../lib/errors.js';
import type { Logger } from '../lib/logger.js';
import type { InboxListingResult, PollCycleSummary } from '../types/runtime.js';

const FIRST_CYCLE_RETRY_DELAY_MS = 2_000;

export interface PollController {
  stop(): void;
  waitUntilStopped(): Promise<void>;
}

export interface PollDependencies {
  check: () => Promise<InboxListingResult>;
  logger: Logger;
  config: Pick<AppConfig, 'pollIntervalMs' | 'pollErrorBackoffMs'>;
  afterCheck?: (result: InboxListingResult) => Promise<void>;
}

export function createPollController(deps: PollDependencies): PollController {
  let stopped = false;

  const loopPromise = runLoop();

  return {
    stop(): void {
      stopped = true;
    },
    waitUntilStopped(): Promise<void> {
      return loopPromise;
    }
  };

  async function runLoop(): Promise<void> {
    let cycle = 0;

    while (!stopped) {
      cycle += 1;
      const startedAt = new Date().toISOString();
      deps.logger.debug('poll.cycle.start', { cycle, startedAt });

      try {
        const result = await runCheck(cycle);
        if (deps.afterCheck) {
          await deps.afterCheck(result);
        }
        const finishedAt = new Date().toISOString();
        const summary: PollCycleSummary = {
          cycle,
          startedAt,
          finishedAt,
          parsedCount: result.probe.parsedMessageCount,
          newCount: result.probe.newMessageCount ?? 0,
          alreadySeenCount: result.probe.alreadySeenCount ?? 0,
          bootstrapScan: result.probe.bootstrapScan ?? false
        };

        deps.logger.debug('poll.cycle.complete', {
          cycle: summary.cycle,
          startedAt: summary.startedAt,
          finishedAt: summary.finishedAt,
          parsedCount: summary.parsedCount,
          newCount: summary.newCount,
          alreadySeenCount: summary.alreadySeenCount,
          bootstrapScan: summary.bootstrapScan
        });

        if (summary.newCount > 0 || cycle === 1 || cycle % 10 === 0) {
          deps.logger.info('poll.heartbeat', {
            cycle: summary.cycle,
            parsedCount: summary.parsedCount,
            newCount: summary.newCount,
            alreadySeenCount: summary.alreadySeenCount,
            bootstrapScan: summary.bootstrapScan
          });
        }

        if (stopped) {
          break;
        }

        await sleep(deps.config.pollIntervalMs);
      } catch (error) {
        deps.logger.error('poll.cycle.error', {
          cycle,
          message: error instanceof Error ? error.message : 'unknown',
          ...(isAppError(error)
            ? {
                code: error.code,
                retryable: error.retryable,
                ...error.details
              }
            : {})
        });

        if (stopped) {
          break;
        }

        await sleep(deps.config.pollErrorBackoffMs);
      }
    }

    deps.logger.info('poll.stopped');
  }

  async function runCheck(cycle: number): Promise<InboxListingResult> {
    try {
      return await deps.check();
    } catch (error) {
      if (cycle !== 1 || stopped) {
        throw error;
      }

      deps.logger.warn('poll.cycle.retrying', {
        cycle,
        delayMs: FIRST_CYCLE_RETRY_DELAY_MS,
        message: error instanceof Error ? error.message : 'unknown',
        ...(isAppError(error)
          ? {
              code: error.code,
              retryable: error.retryable,
              ...error.details
            }
          : {})
      });

      await sleep(FIRST_CYCLE_RETRY_DELAY_MS);
      return deps.check();
    }
  }
}
