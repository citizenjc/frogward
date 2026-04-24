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
      expect(result.value.pollErrorBackoffMs).toBe(5000);
      expect(result.value.forwardingEnabled).toBe(false);
      expect(result.value.forwardingAck).toBe(false);
      expect(result.value.forwardAllowSenderPatterns).toEqual([]);
      expect(result.value.forwardBlockSenderPatterns).toEqual([]);
      expect(result.value.forwardAllowSubjectPatterns).toEqual([]);
      expect(result.value.forwardBlockSubjectPatterns).toEqual([]);
    }
  });

  it('requires forwarding ack and warp token when forwarding is enabled', () => {
    const result = parseConfig({
      FORWARDING_ENABLED: 'true'
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('FORWARDING_ACK must be true when FORWARDING_ENABLED=true');
      expect(result.error).toContain(
        'FORWARDING_WARP_TOKEN is required when FORWARDING_ENABLED=true'
      );
    }
  });

  it('parses forwarding filter patterns from env', () => {
    const result = parseConfig({
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
