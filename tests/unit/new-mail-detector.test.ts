import { describe, expect, it } from 'vitest';

import { detectNewMail } from '../../src/modules/new-mail-detector.js';

describe('new mail detector', () => {
  it('bootstraps first scan without emitting all messages as new', () => {
    const result = detectNewMail({
      nowIso: '2026-04-24T00:00:00.000Z',
      currentMessages: [
        {
          id: 'm-1',
          from: 'Banco BPI',
          subject: 'Mensagem importante',
          receivedAt: 'Ontem, 15:05',
          source: 'sapo-row-id',
          confidence: 'high'
        }
      ],
      state: {
        seen: [],
        forwarded: [],
        scan: {
          scanCount: 0,
          lastNewCount: 0
        }
      }
    });

    expect(result.bootstrap).toBe(true);
    expect(result.newMessages).toEqual([]);
    expect(result.nextState.seen).toHaveLength(1);
    expect(result.nextState.scan.scanCount).toBe(1);
  });

  it('returns only unseen messages on subsequent scans', () => {
    const result = detectNewMail({
      nowIso: '2026-04-24T00:10:00.000Z',
      currentMessages: [
        {
          id: 'm-1',
          from: 'Banco BPI',
          subject: 'Mensagem importante',
          receivedAt: 'Ontem, 15:05',
          source: 'sapo-row-id',
          confidence: 'high'
        },
        {
          id: 'm-2',
          from: 'Revolut',
          subject: 'Pagamento aprovado',
          receivedAt: 'Hoje, 08:10',
          source: 'sapo-row-id',
          confidence: 'high'
        }
      ],
      state: {
        seen: [
          {
            id: 'm-1',
            firstSeenAt: '2026-04-24T00:00:00.000Z',
            lastSeenAt: '2026-04-24T00:00:00.000Z',
            source: 'sapo-row-id',
            confidence: 'high'
          }
        ],
        forwarded: [],
        scan: {
          scanCount: 1,
          lastNewCount: 0,
          lastScanAt: '2026-04-24T00:00:00.000Z',
          bootstrapCompletedAt: '2026-04-24T00:00:00.000Z'
        }
      }
    });

    expect(result.bootstrap).toBe(false);
    expect(result.newMessages.map((message) => message.id)).toEqual(['m-2']);
    expect(result.alreadySeenMessages.map((message) => message.id)).toEqual(['m-1']);
    expect(result.nextState.scan.lastNewCount).toBe(1);
    expect(result.nextState.scan.scanCount).toBe(2);
  });

  it('does not re-emit previously seen message ids', () => {
    const result = detectNewMail({
      nowIso: '2026-04-24T00:20:00.000Z',
      currentMessages: [
        {
          id: 'm-1',
          from: 'Banco BPI',
          subject: 'Mensagem importante',
          receivedAt: 'Ontem, 15:05',
          source: 'sapo-row-id',
          confidence: 'high'
        }
      ],
      state: {
        seen: [
          {
            id: 'm-1',
            firstSeenAt: '2026-04-24T00:00:00.000Z',
            lastSeenAt: '2026-04-24T00:10:00.000Z',
            source: 'sapo-row-id',
            confidence: 'high'
          }
        ],
        forwarded: [],
        scan: {
          scanCount: 2,
          lastNewCount: 1,
          lastScanAt: '2026-04-24T00:10:00.000Z',
          bootstrapCompletedAt: '2026-04-24T00:00:00.000Z'
        }
      }
    });

    expect(result.newMessages).toEqual([]);
    expect(result.nextState.scan.lastNewCount).toBe(0);
    expect(result.nextState.scan.scanCount).toBe(3);
  });
});
