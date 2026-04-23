import { describe, expect, it } from 'vitest';

import { createStateStore } from '../../src/modules/state.js';

describe('state store', () => {
  it('starts empty', () => {
    const store = createStateStore('src/state/runtime-state.json');

    expect(store.getSnapshot()).toEqual({ processed: [] });
  });
});
