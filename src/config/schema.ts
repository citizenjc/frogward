export interface AppConfig {
  mode: 'scaffold' | 'live';
  sapoUsername: string;
  sapoPassword: string;
  destinationEmail?: string;
  pollIntervalMs: number;
  pollErrorBackoffMs: number;
  headless: boolean;
  stateFilePath: string;
  storageStatePath?: string;
  persistStorageState: boolean;
  artifactDir: string;
  captureScreenshotOnFailure: boolean;
  captureTraceOnFailure: boolean;
  forwardingEnabled: boolean;
  forwardingAck: boolean;
  forwardingWarpToken?: string;
  forwardAllowSenderPatterns: string[];
  forwardBlockSenderPatterns: string[];
  forwardAllowSubjectPatterns: string[];
  forwardBlockSubjectPatterns: string[];
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
  const pollErrorBackoffMs = Number(source.POLL_ERROR_BACKOFF_MS ?? '5000');
  const headless = parseBoolean(source.HEADLESS, true);
  const stateFilePath = source.STATE_FILE_PATH?.trim() || 'src/state/runtime-state.json';
  const storageStatePath = source.STORAGE_STATE_PATH?.trim() || undefined;
  const persistStorageState = parseBoolean(source.PERSIST_STORAGE_STATE, true);
  const artifactDir = source.ARTIFACT_DIR?.trim() || 'tmp/live-artifacts';
  const captureScreenshotOnFailure = parseBoolean(source.CAPTURE_SCREENSHOT_ON_FAILURE, true);
  const captureTraceOnFailure = parseBoolean(source.CAPTURE_TRACE_ON_FAILURE, true);
  const forwardingEnabled = parseBoolean(source.FORWARDING_ENABLED, false);
  const forwardingAck = parseBoolean(source.FORWARDING_ACK, false);
  const forwardingWarpToken = source.FORWARDING_WARP_TOKEN?.trim() || undefined;
  const forwardAllowSenderPatterns = parsePatterns(source.FORWARD_ALLOW_SENDERS);
  const forwardBlockSenderPatterns = parsePatterns(source.FORWARD_BLOCK_SENDERS);
  const forwardAllowSubjectPatterns = parsePatterns(source.FORWARD_ALLOW_SUBJECTS);
  const forwardBlockSubjectPatterns = parsePatterns(source.FORWARD_BLOCK_SUBJECTS);
  const logLevel = parseLogLevel(source.LOG_LEVEL);
  const errors: string[] = [];

  if (!mode) {
    errors.push('APP_MODE must be scaffold or live');
  }

  if (!Number.isFinite(pollIntervalMs) || pollIntervalMs < 1000) {
    errors.push('POLL_INTERVAL_MS must be a number >= 1000');
  }

  if (!Number.isFinite(pollErrorBackoffMs) || pollErrorBackoffMs < 1000) {
    errors.push('POLL_ERROR_BACKOFF_MS must be a number >= 1000');
  }

  if (destinationEmail && !isEmail(destinationEmail)) {
    errors.push('DESTINATION_EMAIL must be a valid email address');
  }

  if (!isSafeArtifactPath(artifactDir)) {
    errors.push('ARTIFACT_DIR must stay under tmp/');
  }

  if (storageStatePath && !isSafeStoragePath(storageStatePath)) {
    errors.push('STORAGE_STATE_PATH must stay under tmp/ and end with .auth.json');
  }

  if (mode === 'live') {
    if (!sapoUsername) {
      errors.push('SAPO_USERNAME is required in live mode');
    }

    if (!sapoPassword) {
      errors.push('SAPO_PASSWORD is required in live mode');
    }

    if (persistStorageState && !storageStatePath) {
      errors.push('STORAGE_STATE_PATH is required in live mode');
    }
  }

  if (forwardingEnabled) {
    if (!forwardingAck) {
      errors.push('FORWARDING_ACK must be true when FORWARDING_ENABLED=true');
    }

    if (!forwardingWarpToken) {
      errors.push('FORWARDING_WARP_TOKEN is required when FORWARDING_ENABLED=true');
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
      destinationEmail: destinationEmail || undefined,
      pollIntervalMs,
      pollErrorBackoffMs,
      headless,
      stateFilePath,
      storageStatePath,
      persistStorageState,
      artifactDir,
      captureScreenshotOnFailure,
      captureTraceOnFailure,
      forwardingEnabled,
      forwardingAck,
      forwardingWarpToken,
      forwardAllowSenderPatterns,
      forwardBlockSenderPatterns,
      forwardAllowSubjectPatterns,
      forwardBlockSubjectPatterns,
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

function isSafeRelativePath(value: string): boolean {
  return (
    value.length > 0 && !value.startsWith('/') && !value.includes('..') && !value.includes('://')
  );
}

function isSafeArtifactPath(value: string): boolean {
  return isSafeRelativePath(value) && value.startsWith('tmp/');
}

function isSafeStoragePath(value: string): boolean {
  return isSafeRelativePath(value) && value.startsWith('tmp/') && value.endsWith('.auth.json');
}

function parsePatterns(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}
