import { describe, expect, it } from 'vitest';

import { loadConfig } from '../../src/config/env.js';
import { parseConfig } from '../../src/config/schema.js';

describe('config schema', () => {
  it('parses live-mode required fields', () => {
    const result = parseConfig({
      APP_MODE: 'live',
      SAPO_USERNAME: 'user@example.com',
      SAPO_PASSWORD: 'secret',
      DESTINATION_EMAIL: 'dest@example.com'
    });

    expect(result.ok).toBe(true);
  });

  it('allows scaffold mode defaults', () => {
    const result = parseConfig({});

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.mode).toBe('scaffold');
      expect(result.value.destinationEmail).toBe('forward@example.com');
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
