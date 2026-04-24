import { setTimeout as sleep } from 'node:timers/promises';

import type { AppConfig } from '../config/schema.js';
import type { Logger } from '../lib/logger.js';
import type { InboxListingResult, PollCycleSummary } from '../types/runtime.js';

export interface PollController {
  stop(): void;
}

export interface PollDependencies {
  check: () => Promise<InboxListingResult>;
  logger: Logger;
  config: Pick<AppConfig, 'pollIntervalMs' | 'pollErrorBackoffMs'>;
}

export function createPollController(deps: PollDependencies): PollController {
  let stopped = false;

  void runLoop();

  return {
    stop(): void {
      stopped = true;
    }
  };

  async function runLoop(): Promise<void> {
    let cycle = 0;

    while (!stopped) {
      cycle += 1;
      const startedAt = new Date().toISOString();
      deps.logger.info('poll.cycle.start', { cycle, startedAt });

      try {
        const result = await deps.check();
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

        deps.logger.info('poll.cycle.complete', {
          cycle: summary.cycle,
          startedAt: summary.startedAt,
          finishedAt: summary.finishedAt,
          parsedCount: summary.parsedCount,
          newCount: summary.newCount,
          alreadySeenCount: summary.alreadySeenCount,
          bootstrapScan: summary.bootstrapScan
        });

        if (stopped) {
          break;
        }

        await sleep(deps.config.pollIntervalMs);
      } catch (error) {
        deps.logger.error('poll.cycle.error', {
          cycle,
          message: error instanceof Error ? error.message : 'unknown'
        });

        if (stopped) {
          break;
        }

        await sleep(deps.config.pollErrorBackoffMs);
      }
    }

    deps.logger.info('poll.stopped');
  }
}
