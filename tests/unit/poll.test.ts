import { setTimeout as sleep } from 'node:timers/promises';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPollController } from '../../src/modules/poll.js';

describe('poll module', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('repeats checks on configured interval', async () => {
    const check = vi.fn().mockResolvedValue({
      messages: [],
      probe: {
        inboxReached: true,
        parsedMessageCount: 1,
        skippedAdRowCount: 0,
        parserFallbacksUsed: [],
        newMessageCount: 0,
        alreadySeenCount: 1,
        bootstrapScan: false
      }
    });

    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    const controller = createPollController({
      check,
      logger,
      config: {
        pollIntervalMs: 10,
        pollErrorBackoffMs: 20
      }
    });

    await sleep(40);
    controller.stop();
    await sleep(15);

    expect(check.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(logger.info).toHaveBeenCalledWith(
      'poll.cycle.complete',
      expect.objectContaining({ cycle: 1 })
    );
  });

  it('uses error backoff after failed cycle', async () => {
    const check = vi
      .fn()
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValue({
        messages: [],
        probe: {
          inboxReached: true,
          parsedMessageCount: 1,
          skippedAdRowCount: 0,
          parserFallbacksUsed: [],
          newMessageCount: 0,
          alreadySeenCount: 1,
          bootstrapScan: false
        }
      });

    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    const controller = createPollController({
      check,
      logger,
      config: {
        pollIntervalMs: 10,
        pollErrorBackoffMs: 20
      }
    });

    await sleep(45);
    controller.stop();
    await sleep(15);

    expect(check.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(logger.error).toHaveBeenCalledWith(
      'poll.cycle.error',
      expect.objectContaining({ message: 'temporary failure' })
    );
  });

  it('runs afterCheck hook after successful cycles', async () => {
    const check = vi.fn().mockResolvedValue({
      messages: [],
      probe: {
        inboxReached: true,
        parsedMessageCount: 1,
        skippedAdRowCount: 0,
        parserFallbacksUsed: [],
        newMessageCount: 1,
        alreadySeenCount: 0,
        bootstrapScan: false
      },
      newMessages: []
    });

    const afterCheck = vi.fn().mockResolvedValue(undefined);
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    const controller = createPollController({
      check,
      afterCheck,
      logger,
      config: {
        pollIntervalMs: 10,
        pollErrorBackoffMs: 20
      }
    });

    await sleep(25);
    controller.stop();
    await sleep(15);

    expect(afterCheck).toHaveBeenCalled();
  });
});
