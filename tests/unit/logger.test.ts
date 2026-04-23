import { afterEach, describe, expect, it, vi } from 'vitest';

import { createLogger } from '../../src/lib/logger.js';

const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
const stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

afterEach(() => {
  stdoutWrite.mockClear();
  stderrWrite.mockClear();
});

describe('logger', () => {
  it('redacts emails and secret-shaped fields', () => {
    const logger = createLogger('debug');

    logger.info('test.event', {
      email: 'user@example.com',
      password: 'super-secret',
      nested: { destination: 'dest@example.com' }
    });

    expect(stdoutWrite).toHaveBeenCalledTimes(1);
    expect(String(stdoutWrite.mock.calls[0]?.[0])).toContain('[redacted-email]');
    expect(String(stdoutWrite.mock.calls[0]?.[0])).toContain('[redacted]');
  });

  it('writes error logs to stderr', () => {
    const logger = createLogger('debug');

    logger.error('test.error', { reason: 'boom' });

    expect(stderrWrite).toHaveBeenCalledTimes(1);
    expect(String(stderrWrite.mock.calls[0]?.[0])).toContain('test.error');
  });
});
