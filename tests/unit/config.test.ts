import { describe, expect, it } from 'vitest';

import { loadConfig } from '../../src/config/env.js';
import { parseConfig } from '../../src/config/schema.js';

describe('config schema', () => {
  it('parses live-mode required fields', () => {
    const result = parseConfig({
      APP_MODE: 'live',
      SAPO_USERNAME: 'user@example.com',
      SAPO_PASSWORD: 'secret',
      STORAGE_STATE_PATH: 'tmp/sapo/session.auth.json',
      DESTINATION_EMAIL: 'dest@example.com'
    });

    expect(result.ok).toBe(true);
  });

  it('allows scaffold mode defaults', () => {
    const result = parseConfig({});

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.mode).toBe('scaffold');
      expect(result.value.destinationEmail).toBeUndefined();
      expect(result.value.artifactDir).toBe('tmp/live-artifacts');
      expect(result.value.persistStorageState).toBe(true);
    }
  });

  it('requires storage state path in live mode', () => {
    const result = parseConfig({
      APP_MODE: 'live',
      SAPO_USERNAME: 'user@example.com',
      SAPO_PASSWORD: 'secret'
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('STORAGE_STATE_PATH is required in live mode');
    }
  });

  it('rejects unsafe artifact path', () => {
    const result = parseConfig({
      ARTIFACT_DIR: '/tmp/outside-workspace'
    });

    expect(result.ok).toBe(false);
  });

  it('rejects storage path outside tmp auth policy', () => {
    const result = parseConfig({
      STORAGE_STATE_PATH: 'src/session.json'
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain(
        'STORAGE_STATE_PATH must stay under tmp/ and end with .auth.json'
      );
    }
  });

  it('allows live mode without storage persistence when disabled', () => {
    const result = parseConfig({
      APP_MODE: 'live',
      SAPO_USERNAME: 'user@example.com',
      SAPO_PASSWORD: 'secret',
      PERSIST_STORAGE_STATE: 'false'
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.persistStorageState).toBe(false);
      expect(result.value.storageStatePath).toBeUndefined();
    }
  });

  it('redacts email values in config errors', () => {
    expect(() =>
      loadConfig({
        APP_MODE: 'live',
        DESTINATION_EMAIL: 'not-an-email'
      })
    ).toThrowError(/Configuration invalid:/);
  });
});
