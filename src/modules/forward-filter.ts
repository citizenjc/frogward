import type { AppConfig } from '../config/schema.js';
import type { ForwardFilterDecision, MessageSummary } from '../types/message.js';

export function decideForwardEligibility(
  message: MessageSummary,
  config: Pick<
    AppConfig,
    | 'forwardAllowSenderPatterns'
    | 'forwardBlockSenderPatterns'
    | 'forwardAllowSubjectPatterns'
    | 'forwardBlockSubjectPatterns'
  >
): ForwardFilterDecision {
  if (!message.from?.trim()) {
    return { eligible: false, reason: 'missing_sender' };
  }

  if (!message.subject?.trim()) {
    return { eligible: false, reason: 'missing_subject' };
  }

  const sender = message.from.toLowerCase();
  const subject = message.subject.toLowerCase();

  if (matchesAny(sender, config.forwardBlockSenderPatterns)) {
    return { eligible: false, reason: 'sender_blocked' };
  }

  if (matchesAny(subject, config.forwardBlockSubjectPatterns)) {
    return { eligible: false, reason: 'subject_blocked' };
  }

  if (
    config.forwardAllowSenderPatterns.length > 0 &&
    !matchesAny(sender, config.forwardAllowSenderPatterns)
  ) {
    return { eligible: false, reason: 'sender_not_allowed' };
  }

  if (
    config.forwardAllowSubjectPatterns.length > 0 &&
    !matchesAny(subject, config.forwardAllowSubjectPatterns)
  ) {
    return { eligible: false, reason: 'subject_not_allowed' };
  }

  return { eligible: true, reason: 'allowed' };
}

function matchesAny(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => value.includes(pattern.toLowerCase()));
}
