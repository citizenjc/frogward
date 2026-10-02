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

  it('asks for a fresh session after repeated consecutive failures', async () => {
    const check = vi.fn().mockRejectedValue(new Error('session expired'));
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
        pollErrorBackoffMs: 10,
        maxConsecutiveFailures: 2
      }
    });

    // cycle 1 retries once internally after 2s, then cycle 2 fails too.
    await expect(controller.waitUntilStopped()).resolves.toBe('unhealthy');
    expect(logger.warn).toHaveBeenCalledWith(
      'poll.session.recycle',
      expect.objectContaining({ reason: 'consecutive_failures', consecutiveFailures: 2 })
    );
  }, 10_000);

  it('resets the failure count after a successful cycle', async () => {
    const check = vi
      .fn()
      .mockResolvedValueOnce(okResult())
      .mockRejectedValueOnce(new Error('blip'))
      .mockResolvedValueOnce(okResult())
      .mockRejectedValueOnce(new Error('blip'))
      .mockResolvedValue(okResult());
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
        pollIntervalMs: 5,
        pollErrorBackoffMs: 5,
        maxConsecutiveFailures: 2
      }
    });

    await sleep(80);
    controller.stop();

    await expect(controller.waitUntilStopped()).resolves.toBe('stopped');
    expect(logger.warn).not.toHaveBeenCalledWith('poll.session.recycle', expect.anything());
  });

  it('treats a hung cycle as unhealthy', async () => {
    const check = vi.fn().mockReturnValue(new Promise(() => {}));
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
        pollErrorBackoffMs: 10,
        cycleTimeoutMs: 30
      }
    });

    await expect(controller.waitUntilStopped()).resolves.toBe('unhealthy');
    expect(logger.warn).toHaveBeenCalledWith(
      'poll.session.recycle',
      expect.objectContaining({ reason: 'cycle_timeout' })
    );
  });

  it('expires the session once it reaches its maximum age', async () => {
    const check = vi.fn().mockResolvedValue(okResult());
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
        pollErrorBackoffMs: 10,
        maxSessionAgeMs: 25
      }
    });

    await expect(controller.waitUntilStopped()).resolves.toBe('expired');
    expect(logger.info).toHaveBeenCalledWith(
      'poll.session.recycle',
      expect.objectContaining({ reason: 'max_session_age' })
    );
  });

  it('stops without waiting out the poll interval', async () => {
    const check = vi.fn().mockResolvedValue(okResult());
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
        pollIntervalMs: 60_000,
        pollErrorBackoffMs: 60_000
      }
    });

    await sleep(20);
    const stoppedAt = Date.now();
    controller.stop();

    await expect(controller.waitUntilStopped()).resolves.toBe('stopped');
    expect(Date.now() - stoppedAt).toBeLessThan(1_000);
  });
});

function okResult() {
  return {
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
  };
}
