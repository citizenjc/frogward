import type { AppConfig } from '../config/schema.js';

type LogLevel = AppConfig['logLevel'];

export interface Logger {
  debug(event: string, data?: Record<string, unknown>): void;
  info(event: string, data?: Record<string, unknown>): void;
  warn(event: string, data?: Record<string, unknown>): void;
  error(event: string, data?: Record<string, unknown>): void;
}

export function createLogger(level: LogLevel): Logger {
  return {
    debug: (event, data) => writeLog('debug', level, event, data),
    info: (event, data) => writeLog('info', level, event, data),
    warn: (event, data) => writeLog('warn', level, event, data),
    error: (event, data) => writeLog('error', level, event, data)
  };
}

function writeLog(
  level: LogLevel,
  configuredLevel: LogLevel,
  event: string,
  data?: Record<string, unknown>
) {
  if (rank(level) < rank(configuredLevel)) {
    return;
  }

  const payload = JSON.stringify({ level, event, data: data ?? {} });
  process.stdout.write(`${payload}\n`);
}

function rank(level: LogLevel): number {
  switch (level) {
    case 'debug':
      return 10;
    case 'info':
      return 20;
    case 'warn':
      return 30;
    case 'error':
      return 40;
  }
}
