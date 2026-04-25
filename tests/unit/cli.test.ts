import { describe, expect, it } from 'vitest';

import { parseArgs } from '../../src/cli.js';

describe('cli argument parsing', () => {
  it('keeps once mode read-only by default', () => {
    expect(parseArgs(['--once'])).toEqual({
      mode: 'once',
      safetyLevel: 'probe'
    });
  });

  it('parses explicit forward-new mutation mode', () => {
    expect(parseArgs(['--forward-new'])).toEqual({
      mode: 'forward-new',
      safetyLevel: 'forward'
    });
  });

  it('keeps poll mode read-only', () => {
    expect(parseArgs(['--poll'])).toEqual({
      mode: 'poll',
      safetyLevel: 'probe'
    });
  });

  it('parses service mode as continuous forward automation', () => {
    expect(parseArgs(['--service'])).toEqual({
      mode: 'service',
      safetyLevel: 'forward'
    });
  });
});
