import type { MessageState } from '../types/message.js';

export interface StateSnapshot {
  processed: MessageState[];
}

export interface StateStore {
  getSnapshot(): StateSnapshot;
}

export function createStateStore(filePath: string): StateStore {
  void filePath;
  const snapshot: StateSnapshot = { processed: [] };

  return {
    getSnapshot(): StateSnapshot {
      return snapshot;
    }
  };
}
