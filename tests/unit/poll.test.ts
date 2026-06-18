import { setTimeout as sleep } from 'node:timers/promises';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { ModuleError } from '../../src/lib/errors.js';
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

    expect(check.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(logger.info).toHaveBeenCalledWith(
      'poll.heartbeat',
      expect.objectContaining({ cycle: 1 })
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'poll.cycle.complete',
      expect.objectContaining({ cycle: 1 })
    );
  });

  it('uses error backoff after failed cycle', async () => {
    const check = vi
      .fn()
      .mockResolvedValueOnce({
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
      })
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

  it('retries the first cycle once before logging an error', async () => {
    const check = vi
      .fn()
      .mockRejectedValueOnce(new Error('startup not ready'))
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
        pollIntervalMs: 10_000,
        pollErrorBackoffMs: 20
      }
    });

    await sleep(2035);
    controller.stop();
    await sleep(15);

    expect(check).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledWith(
      'poll.cycle.retrying',
      expect.objectContaining({ cycle: 1, message: 'startup not ready', delayMs: 2000 })
    );
    expect(logger.error).not.toHaveBeenCalledWith(
      'poll.cycle.error',
      expect.objectContaining({ cycle: 1, message: 'startup not ready' })
    );
  });

  it('logs app error details when a cycle still fails', async () => {
    const check = vi
      .fn()
      .mockRejectedValue(new ModuleError('check', 'check module failed.', {
        cause: 'Inbox not reachable during probe.'
      }));

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

    await sleep(2055);
    controller.stop();
    await sleep(15);

    expect(logger.error).toHaveBeenCalledWith(
      'poll.cycle.error',
      expect.objectContaining({
        cycle: 1,
        message: 'check module failed.',
        code: 'MODULE_FAILURE',
        moduleName: 'check',
        cause: 'Inbox not reachable during probe.',
        retryable: true
      })
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
