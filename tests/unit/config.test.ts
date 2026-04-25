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

  it('defaults to live mode with headless enabled', () => {
    const result = parseConfig({});

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('SAPO_USERNAME is required in live mode');
      expect(result.error).toContain('SAPO_PASSWORD is required in live mode');
    }
  });

  it('requires destination email in live mode when forwarding is enabled', () => {
    const result = parseConfig({
      APP_MODE: 'live',
      SAPO_USERNAME: 'user@example.com',
      SAPO_PASSWORD: 'secret',
      FORWARDING_ENABLED: 'true'
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain(
        'DESTINATION_EMAIL is required in live mode when forwarding is enabled'
      );
    }
  });

  it('parses forwarding filter patterns from env', () => {
    const result = parseConfig({
      APP_MODE: 'live',
      SAPO_USERNAME: 'user@example.com',
      SAPO_PASSWORD: 'secret',
      STORAGE_STATE_PATH: 'tmp/sapo/session.auth.json',
      DESTINATION_EMAIL: 'dest@example.com',
      FORWARD_ALLOW_SENDERS: 'bpi,revolut',
      FORWARD_BLOCK_SENDERS: 'spam@',
      FORWARD_ALLOW_SUBJECTS: 'critical,alert',
      FORWARD_BLOCK_SUBJECTS: 'marketing'
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.forwardAllowSenderPatterns).toEqual(['bpi', 'revolut']);
      expect(result.value.forwardBlockSenderPatterns).toEqual(['spam@']);
      expect(result.value.forwardAllowSubjectPatterns).toEqual(['critical', 'alert']);
      expect(result.value.forwardBlockSubjectPatterns).toEqual(['marketing']);
    }
  });

  it('rejects invalid polling backoff', () => {
    const result = parseConfig({
      POLL_ERROR_BACKOFF_MS: '500'
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('POLL_ERROR_BACKOFF_MS must be a number >= 1000');
    }
  });

  it('defaults storage state path in live mode', () => {
    const result = parseConfig({
      APP_MODE: 'live',
      SAPO_USERNAME: 'user@example.com',
      SAPO_PASSWORD: 'secret',
      DESTINATION_EMAIL: 'dest@example.com'
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.storageStatePath).toBe('tmp/sapo/session.auth.json');
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
      DESTINATION_EMAIL: 'dest@example.com',
      PERSIST_STORAGE_STATE: 'false'
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.persistStorageState).toBe(false);
      expect(result.value.storageStatePath).toBe('tmp/sapo/session.auth.json');
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
