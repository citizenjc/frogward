import { setTimeout as sleep } from 'node:timers/promises';

import type { AppConfig } from '../config/schema.js';
import { isAppError } from '../lib/errors.js';
import type { Logger } from '../lib/logger.js';
import type { InboxListingResult, PollCycleSummary } from '../types/runtime.js';

const FIRST_CYCLE_RETRY_DELAY_MS = 2_000;
// After this many failed cycles in a row the browser session is considered broken
// (expired SAPO login, crashed page, ...) and the loop asks for a fresh session.
const DEFAULT_MAX_CONSECUTIVE_FAILURES = 3;
// A single cycle (check + forwarding) taking longer than this is treated as hung.
const DEFAULT_CYCLE_TIMEOUT_MS = 10 * 60_000;
// Long-lived browser sessions are recycled proactively to avoid slow degradation.
const DEFAULT_MAX_SESSION_AGE_MS = 6 * 60 * 60_000;

/**
 * Why the poll loop ended: `stopped` after `stop()`; `expired` when the browser
 * session reached its maximum age; `unhealthy` when it kept failing or hung.
 * Both `expired` and `unhealthy` ask the caller for a fresh browser session.
 */
export type PollStopReason = 'stopped' | 'expired' | 'unhealthy';

export interface PollController {
  stop(): void;
  waitUntilStopped(): Promise<PollStopReason>;
}

export interface PollDependencies {
  check: () => Promise<InboxListingResult>;
  logger: Logger;
  config: Pick<AppConfig, 'pollIntervalMs' | 'pollErrorBackoffMs'> & {
    maxConsecutiveFailures?: number;
    cycleTimeoutMs?: number;
    maxSessionAgeMs?: number;
  };
  afterCheck?: (result: InboxListingResult) => Promise<void>;
}

class CycleTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Poll cycle exceeded ${timeoutMs}ms.`);
    this.name = 'CycleTimeoutError';
  }
}

export function createPollController(deps: PollDependencies): PollController {
  let stopped = false;
  let wakeUp: (() => void) | undefined;

  const maxConsecutiveFailures =
    deps.config.maxConsecutiveFailures ?? DEFAULT_MAX_CONSECUTIVE_FAILURES;
  const cycleTimeoutMs = deps.config.cycleTimeoutMs ?? DEFAULT_CYCLE_TIMEOUT_MS;
  const maxSessionAgeMs = deps.config.maxSessionAgeMs ?? DEFAULT_MAX_SESSION_AGE_MS;

  const loopPromise = runLoop();

  return {
    stop(): void {
      stopped = true;
      wakeUp?.();
    },
    waitUntilStopped(): Promise<PollStopReason> {
      return loopPromise;
    }
  };

  async function pause(ms: number): Promise<void> {
    const controller = new AbortController();
    wakeUp = () => controller.abort();
    try {
      await sleep(ms, undefined, { signal: controller.signal });
    } catch {
      // Woken up early by stop().
    } finally {
      wakeUp = undefined;
    }
  }

  async function runCycle(cycle: number): Promise<InboxListingResult> {
    const work = (async () => {
      const result = await runCheck(cycle);
      if (deps.afterCheck) {
        await deps.afterCheck(result);
      }
      return result;
    })();

    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new CycleTimeoutError(cycleTimeoutMs)), cycleTimeoutMs);
    });

    try {
      return await Promise.race([work, timeout]);
    } finally {
      clearTimeout(timer);
      // A hung cycle keeps running in the background until its browser session is
      // closed; swallow its eventual rejection so it cannot crash the process.
      work.catch(() => {});
    }
  }

  async function runLoop(): Promise<PollStopReason> {
    let cycle = 0;
    let consecutiveFailures = 0;
    const sessionStartedAt = Date.now();

    while (!stopped) {
      cycle += 1;
      const startedAt = new Date().toISOString();
      deps.logger.debug('poll.cycle.start', { cycle, startedAt });

      try {
        const result = await runCycle(cycle);
        consecutiveFailures = 0;
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

        const sessionAgeMs = Date.now() - sessionStartedAt;
        if (sessionAgeMs >= maxSessionAgeMs) {
          deps.logger.info('poll.session.recycle', {
            reason: 'max_session_age',
            cycle,
            sessionAgeMs
          });
          return 'expired';
        }

        await pause(deps.config.pollIntervalMs);
      } catch (error) {
        consecutiveFailures += 1;
        deps.logger.error('poll.cycle.error', {
          cycle,
          consecutiveFailures,
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

        if (error instanceof CycleTimeoutError || consecutiveFailures >= maxConsecutiveFailures) {
          deps.logger.warn('poll.session.recycle', {
            reason: error instanceof CycleTimeoutError ? 'cycle_timeout' : 'consecutive_failures',
            cycle,
            consecutiveFailures
          });
          return 'unhealthy';
        }

        await pause(deps.config.pollErrorBackoffMs);
      }
    }

    deps.logger.info('poll.stopped');
    return 'stopped';
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
