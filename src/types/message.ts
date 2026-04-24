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

export interface InboxProbeSummary {
  inboxReached: boolean;
  inboxTitle?: string;
  visibleMessageCount?: number;
}

export interface MessageState {
  id: string;
  processedAt: string;
}
