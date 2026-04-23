import { config as loadDotEnv } from 'dotenv';

import { ConfigError } from '../lib/errors.js';
import { parseConfig } from './schema.js';

export type EnvSource = Record<string, string | undefined>;

export function createEnvSource(source: EnvSource = process.env): EnvSource {
  loadDotEnv();
  return { ...process.env, ...source };
}

export function loadConfig(source: EnvSource) {
  const result = parseConfig(source);

  if (!result.ok) {
    throw new ConfigError(redactConfigError(result.error));
  }

  return result.value;
}

function redactConfigError(message: string): string {
  return `Configuration invalid: ${message.replace(/\b[^\s=;]+@[^\s;]+\b/g, '[redacted-email]')}`;
}
