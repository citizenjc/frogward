import { isAppError } from './lib/errors.js';
import { runCli } from './cli.js';

void runCli(process.argv.slice(2)).catch((error: unknown) => {
  const payload = isAppError(error)
    ? {
        level: 'error',
        event: 'app.fatal',
        data: {
          code: error.code,
          retryable: error.retryable,
          message: error.message,
          ...error.details
        }
      }
    : {
        level: 'error',
        event: 'app.fatal',
        data: {
          code: 'UNEXPECTED_FAILURE',
          retryable: false,
          message: error instanceof Error ? error.message : 'Unknown failure'
        }
      };

  process.stderr.write(`${JSON.stringify(payload)}\n`);
  process.exitCode = 1;
});
