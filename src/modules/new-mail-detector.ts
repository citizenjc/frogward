import type { MessageSummary, SeenMessageRecord } from '../types/message.js';
import type { SeenMailboxState } from '../types/runtime.js';

export interface NewMailDetectionResult {
  bootstrap: boolean;
  newMessages: MessageSummary[];
  alreadySeenMessages: MessageSummary[];
  nextState: SeenMailboxState;
}

export function detectNewMail(params: {
  nowIso: string;
  currentMessages: MessageSummary[];
  state: SeenMailboxState;
}): NewMailDetectionResult {
  const { nowIso, currentMessages, state } = params;
  const seenMap = new Map(state.seen.map((record) => [record.id, record]));
  const bootstrap = state.scan.scanCount === 0;

  const newMessages: MessageSummary[] = [];
  const alreadySeenMessages: MessageSummary[] = [];

  const nextSeen: SeenMessageRecord[] = [];

  for (const message of currentMessages) {
    const existing = seenMap.get(message.id);

    if (existing) {
      alreadySeenMessages.push(message);
      nextSeen.push({
        ...existing,
        lastSeenAt: nowIso,
        source: message.source ?? existing.source,
        confidence: message.confidence ?? existing.confidence
      });
      continue;
    }

    if (!bootstrap) {
      newMessages.push(message);
    }

    nextSeen.push({
      id: message.id,
      firstSeenAt: nowIso,
      lastSeenAt: nowIso,
      source: message.source,
      confidence: message.confidence
    });
  }

  const existingNotVisible = state.seen.filter(
    (record) => !currentMessages.some((message) => message.id === record.id)
  );

  const nextState: SeenMailboxState = {
    seen: [...nextSeen, ...existingNotVisible],
    forwarded: state.forwarded,
    scan: {
      ...state.scan,
      scanCount: state.scan.scanCount + 1,
      lastScanAt: nowIso,
      lastNewCount: newMessages.length,
      bootstrapCompletedAt: state.scan.bootstrapCompletedAt ?? nowIso
    }
  };

  return {
    bootstrap,
    newMessages,
    alreadySeenMessages,
    nextState
  };
}
