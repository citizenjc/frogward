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

  const payload = JSON.stringify({
    level,
    event,
    data: sanitizeValue(data ?? {})
  });
  const stream = level === 'error' ? process.stderr : process.stdout;
  stream.write(`${payload}\n`);
}

function sanitizeValue(value: unknown, key = ''): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry, key));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeValue(entryValue, entryKey)
      ])
    );
  }

  if (typeof value === 'string') {
    if (isSecretKey(key)) {
      return '[redacted]';
    }

    return value.replace(/\b[^\s=;]+@[^\s;]+\b/g, '[redacted-email]');
  }

  return value;
}

function isSecretKey(key: string): boolean {
  return /pass|password|secret|token|key/i.test(key);
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
