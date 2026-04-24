import { createHash } from 'node:crypto';

import type { MessageSummary } from '../types/message.js';

export interface InboxParserResult {
  messages: MessageSummary[];
  skippedAdRowCount: number;
  parserFallbacksUsed: string[];
}

interface RawRow {
  html: string;
  attributes: Record<string, string>;
  classes: string[];
  text: string;
}

export function parseInboxRows(html: string): InboxParserResult {
  const rows = extractRows(html);
  const parserFallbacksUsed = new Set<string>();
  const messages: MessageSummary[] = [];
  let skippedAdRowCount = 0;

  for (const row of rows) {
    if (isAdLikeRow(row)) {
      skippedAdRowCount += 1;
      continue;
    }

    const parsed = parseMessageRow(row, parserFallbacksUsed);
    if (parsed) {
      messages.push(parsed);
    }
  }

  return {
    messages,
    skippedAdRowCount,
    parserFallbacksUsed: Array.from(parserFallbacksUsed)
  };
}

function extractRows(html: string): RawRow[] {
  const rows: RawRow[] = [];
  const startRegex =
    /<(div|li)([^>]*class="[^"]*(?:mail-item|message-row|thread-row|list-item)[^"]*"[^>]*)>/gi;
  const starts = Array.from(html.matchAll(startRegex));

  for (let index = 0; index < starts.length; index += 1) {
    const match = starts[index];
    const tagName = match?.[1]?.toLowerCase();
    const attrsChunk = match?.[2] ?? '';
    const startToken = match?.[0] ?? '';
    const startIndex = match?.index ?? -1;

    if (!tagName || startIndex < 0) {
      continue;
    }

    const contentStart = startIndex + startToken.length;
    const nextStartIndex = starts[index + 1]?.index ?? html.length;
    const closeToken = `</${tagName}>`;
    const body = html.slice(contentStart, nextStartIndex);
    const fullHtml = `<${tagName}${attrsChunk}>${body}${closeToken}`;
    const attributes = parseAttributes(attrsChunk);
    const classes = (attributes.class ?? '').split(/\s+/).filter(Boolean);

    rows.push({
      html: fullHtml,
      attributes,
      classes,
      text: normalizeText(stripTags(fullHtml))
    });
  }

  return rows;
}

function parseAttributes(chunk: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const attrRegex = /([a-zA-Z_:][a-zA-Z0-9_:\-.]*)\s*=\s*"([^"]*)"/g;

  for (const match of chunk.matchAll(attrRegex)) {
    const key = match[1];
    const value = match[2];
    if (key && value !== undefined) {
      attributes[key] = value;
    }
  }

  return attributes;
}

function parseMessageRow(row: RawRow, parserFallbacksUsed: Set<string>): MessageSummary | null {
  const id =
    row.attributes['data-message-id'] ??
    row.attributes['data-key'] ??
    row.attributes['data-id'] ??
    extractByRegex(row.html, /<input[^>]*id="([^"]+)"/i) ??
    buildFallbackId(row, parserFallbacksUsed);

  const from =
    extractByRegex(row.html, /class="[^"]*(?:from|sender)[^"]*"[^>]*>([^<]+)/i) ??
    extractByRegex(row.html, /data-from="([^"]+)"/i);

  const subject =
    extractByRegex(row.html, /class="[^"]*(?:subject|title)[^"]*"[^>]*>([^<]+)/i) ??
    extractByRegex(row.html, /data-subject="([^"]+)"/i);

  const receivedAt =
    extractByRegex(row.html, /class="[^"]*(?:date|time|datetime)[^"]*"[^>]*>([^<]+)/i) ??
    extractByRegex(row.html, /data-date="([^"]+)"/i) ??
    '';

  if (!from || !subject) {
    return null;
  }

  return {
    id,
    from: normalizeText(from),
    subject: normalizeText(subject),
    receivedAt: normalizeText(receivedAt),
    isUnread: isUnreadRow(row),
    preview:
      extractByRegex(row.html, /class="[^"]*(?:preview|snippet)[^"]*"[^>]*>([^<]+)/i) ?? undefined,
    rowType: 'message',
    source:
      row.attributes['data-message-id'] || row.attributes['data-id']
        ? 'sapo-row-id'
        : 'subject-time-hash',
    confidence:
      row.attributes['data-message-id'] || row.attributes['data-id']
        ? 'high'
        : receivedAt
          ? 'medium'
          : 'low'
  };
}

function buildFallbackId(row: RawRow, parserFallbacksUsed: Set<string>): string {
  parserFallbacksUsed.add('subject-time-hash');
  const base = `${row.text}|${row.attributes['data-date'] ?? ''}`;
  return createHash('sha1').update(base).digest('hex').slice(0, 16);
}

function isAdLikeRow(row: RawRow): boolean {
  const classTokens = row.classes.map((token) => token.toLowerCase());
  const text = row.text.toLowerCase();

  if (classTokens.includes('adds-messages-list') || classTokens.includes('ads-messages-list')) {
    return true;
  }

  const classSignals = ['ad', 'ads', 'sponsored', 'promo', 'publicidade'];
  if (classSignals.some((signal) => classTokens.includes(signal))) {
    return true;
  }

  const textSignals = [' publicidade ', ' patrocinado ', ' sponsored ', ' anúncio '];
  if (textSignals.some((signal) => ` ${text} `.includes(signal))) {
    return true;
  }

  const sender =
    extractByRegex(row.html, /class="[^"]*(?:from|sender)[^"]*"[^>]*>([^<]+)/i)?.toLowerCase() ??
    '';
  const subject =
    extractByRegex(row.html, /class="[^"]*(?:subject|title)[^"]*"[^>]*>([^<]+)/i)?.toLowerCase() ??
    '';
  if (!sender && !subject && /\bpub\b/i.test(text)) {
    return true;
  }

  return false;
}

function isUnreadRow(row: RawRow): boolean {
  const classNames = row.classes.join(' ').toLowerCase();
  if (classNames.includes('unread') || classNames.includes('is-unread')) {
    return true;
  }

  const unreadAttr = row.attributes['data-unread'];
  return unreadAttr === 'true' || unreadAttr === '1';
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ');
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function extractByRegex(html: string, regex: RegExp): string | undefined {
  const match = html.match(regex);
  return match?.[1] ? normalizeText(match[1]) : undefined;
}
