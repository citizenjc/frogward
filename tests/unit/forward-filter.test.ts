import { describe, expect, it } from 'vitest';

import { decideForwardEligibility } from '../../src/modules/forward-filter.js';

describe('forward filter', () => {
  it('allows message when no filters block it', () => {
    const result = decideForwardEligibility(
      {
        id: 'm-1',
        from: 'Banco BPI',
        subject: 'Mensagem importante',
        receivedAt: 'Hoje'
      },
      {
        forwardAllowSenderPatterns: [],
        forwardBlockSenderPatterns: [],
        forwardAllowSubjectPatterns: [],
        forwardBlockSubjectPatterns: []
      }
    );

    expect(result).toEqual({ eligible: true, reason: 'allowed' });
  });

  it('blocks by sender and subject patterns', () => {
    const blockedSender = decideForwardEligibility(
      {
        id: 'm-2',
        from: 'spam@example.com',
        subject: 'Hello',
        receivedAt: 'Hoje'
      },
      {
        forwardAllowSenderPatterns: [],
        forwardBlockSenderPatterns: ['spam@'],
        forwardAllowSubjectPatterns: [],
        forwardBlockSubjectPatterns: []
      }
    );

    const blockedSubject = decideForwardEligibility(
      {
        id: 'm-3',
        from: 'alerts@example.com',
        subject: 'marketing campaign',
        receivedAt: 'Hoje'
      },
      {
        forwardAllowSenderPatterns: [],
        forwardBlockSenderPatterns: [],
        forwardAllowSubjectPatterns: [],
        forwardBlockSubjectPatterns: ['marketing']
      }
    );

    expect(blockedSender).toEqual({ eligible: false, reason: 'sender_blocked' });
    expect(blockedSubject).toEqual({ eligible: false, reason: 'subject_blocked' });
  });

  it('enforces allow-lists when configured', () => {
    const senderDenied = decideForwardEligibility(
      {
        id: 'm-4',
        from: 'other@example.com',
        subject: 'BPI update',
        receivedAt: 'Hoje'
      },
      {
        forwardAllowSenderPatterns: ['bpi'],
        forwardBlockSenderPatterns: [],
        forwardAllowSubjectPatterns: [],
        forwardBlockSubjectPatterns: []
      }
    );

    const subjectDenied = decideForwardEligibility(
      {
        id: 'm-5',
        from: 'banco bpi',
        subject: 'General info',
        receivedAt: 'Hoje'
      },
      {
        forwardAllowSenderPatterns: ['bpi'],
        forwardBlockSenderPatterns: [],
        forwardAllowSubjectPatterns: ['critical'],
        forwardBlockSubjectPatterns: []
      }
    );

    expect(senderDenied).toEqual({ eligible: false, reason: 'sender_not_allowed' });
    expect(subjectDenied).toEqual({ eligible: false, reason: 'subject_not_allowed' });
  });
});
