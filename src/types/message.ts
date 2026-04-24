export interface MessageSummary {
  id: string;
  from: string;
  subject: string;
  receivedAt: string;
  isUnread?: boolean;
  preview?: string;
  folder?: string;
  rowType?: 'message' | 'ad' | 'unknown';
  source?: 'sapo-row-id' | 'subject-time-hash' | 'dom-fallback';
  confidence?: 'high' | 'medium' | 'low';
}

export interface ForwardFilterDecision {
  eligible: boolean;
  reason:
    | 'allowed'
    | 'sender_not_allowed'
    | 'sender_blocked'
    | 'subject_not_allowed'
    | 'subject_blocked'
    | 'missing_sender'
    | 'missing_subject';
}

export interface SeenMessageRecord {
  id: string;
  firstSeenAt: string;
  lastSeenAt: string;
  source?: MessageSummary['source'];
  confidence?: MessageSummary['confidence'];
}

export interface ForwardedMessageRecord {
  id: string;
  forwardedAt: string;
  destination: string;
  status: 'success' | 'failed' | 'filtered';
  reason?:
    | ForwardFilterDecision['reason']
    | 'forward_failed'
    | 'missing_destination'
    | 'open_message_failed'
    | 'forward_action_not_found'
    | 'compose_open_failed'
    | 'recipient_verification_failed'
    | 'submit_not_found'
    | 'send_failed'
    | 'send_confirmation_missing';
  attempts: number;
}

export interface InboxProbeSummary {
  inboxReached: boolean;
  inboxTitle?: string;
  visibleMessageCount?: number;
}

export interface MessageState {
  id: string;
  processedAt: string;
}
