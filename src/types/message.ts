export interface MessageSummary {
  id: string;
  subject: string;
  receivedAt: string;
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
