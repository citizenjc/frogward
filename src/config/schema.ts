export interface AppConfig {
  mode: 'scaffold' | 'live';
  sapoUsername: string;
  sapoPassword: string;
  destinationEmail: string;
  pollIntervalMs: number;
  headless: boolean;
  stateFilePath: string;
  storageStatePath?: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

interface ParseSuccess {
  ok: true;
  value: AppConfig;
}

interface ParseFailure {
  ok: false;
  error: string;
}

type ParseResult = ParseSuccess | ParseFailure;

export function parseConfig(source: Record<string, string | undefined>): ParseResult {
  const mode = parseMode(source.APP_MODE);
  const sapoUsername = source.SAPO_USERNAME?.trim() ?? '';
  const sapoPassword = source.SAPO_PASSWORD?.trim() ?? '';
  const destinationEmail = source.DESTINATION_EMAIL?.trim() ?? '';
  const pollIntervalMs = Number(source.POLL_INTERVAL_MS ?? '60000');
  const headless = parseBoolean(source.HEADLESS, true);
  const stateFilePath = source.STATE_FILE_PATH?.trim() || 'src/state/runtime-state.json';
  const storageStatePath = source.STORAGE_STATE_PATH?.trim() || undefined;
  const logLevel = parseLogLevel(source.LOG_LEVEL);
  const errors: string[] = [];

  if (!mode) {
    errors.push('APP_MODE must be scaffold or live');
  }

  if (!Number.isFinite(pollIntervalMs) || pollIntervalMs < 1000) {
    errors.push('POLL_INTERVAL_MS must be a number >= 1000');
  }

  if (!isEmail(destinationEmail) && !(mode === 'scaffold' && destinationEmail === '')) {
    errors.push('DESTINATION_EMAIL must be a valid email address');
  }

  if (mode === 'live') {
    if (!sapoUsername) {
      errors.push('SAPO_USERNAME is required in live mode');
    }

    if (!sapoPassword) {
      errors.push('SAPO_PASSWORD is required in live mode');
    }

    if (!destinationEmail) {
      errors.push('DESTINATION_EMAIL is required in live mode');
    }
  }

  if (errors.length > 0 || !mode) {
    return {
      ok: false,
      error: errors.join('; ')
    };
  }

  return {
    ok: true,
    value: {
      mode,
      sapoUsername,
      sapoPassword,
      destinationEmail: destinationEmail || 'forward@example.com',
      pollIntervalMs,
      headless,
      stateFilePath,
      storageStatePath,
      logLevel
    }
  };
}

function parseMode(mode: string | undefined): AppConfig['mode'] | null {
  switch (mode) {
    case undefined:
    case 'scaffold':
      return 'scaffold';
    case 'live':
      return 'live';
    default:
      return null;
  }
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  return value !== 'false';
}

function parseLogLevel(level: string | undefined): AppConfig['logLevel'] {
  switch (level) {
    case 'debug':
    case 'warn':
    case 'error':
      return level;
    default:
      return 'info';
  }
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
