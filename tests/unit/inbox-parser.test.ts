import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseInboxRows } from '../../src/modules/inbox-parser.js';

describe('inbox parser', () => {
  it('extracts message rows with stable ids', () => {
    const html = `
      <div class="mail-item unread" data-message-id="m-1" data-date="2026-04-23T10:00:00Z">
        <span class="from">Banco BPI</span>
        <span class="subject">Atualização da conta</span>
        <span class="date">10:00</span>
      </div>
      <div class="mail-item" data-message-id="m-2" data-date="2026-04-23T10:10:00Z">
        <span class="from">NOS</span>
        <span class="subject">Fatura disponível</span>
        <span class="date">10:10</span>
      </div>
    `;

    const result = parseInboxRows(html);

    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]).toEqual(
      expect.objectContaining({
        id: 'm-1',
        from: 'Banco BPI',
        subject: 'Atualização da conta',
        receivedAt: '10:00',
        isUnread: true,
        source: 'sapo-row-id',
        confidence: 'high'
      })
    );
    expect(result.skippedAdRowCount).toBe(0);
  });

  it('falls back to deterministic hash id when row id is missing', () => {
    const html = `
      <div class="mail-item" data-date="2026-04-23T11:00:00Z">
        <span class="from">Revolut</span>
        <span class="subject">Cartão virtual criado</span>
        <span class="date">11:00</span>
      </div>
    `;

    const result = parseInboxRows(html);

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]?.id).toMatch(/^[a-f0-9]{16}$/);
    expect(result.messages[0]?.source).toBe('subject-time-hash');
    expect(result.parserFallbacksUsed).toContain('subject-time-hash');
  });

  it('skips ad/sponsored rows while preserving real messages', () => {
    const html = `
      <div class="mail-item ad" data-date="2026-04-23T09:00:00Z">
        <span class="subject">Publicidade especial</span>
      </div>
      <div class="mail-item" data-message-id="m-real-1" data-date="2026-04-23T09:10:00Z">
        <span class="from">Banco BPI</span>
        <span class="subject">BPI Bank: Message from your Manager</span>
        <span class="date">09:10</span>
      </div>
    `;

    const result = parseInboxRows(html);

    expect(result.skippedAdRowCount).toBe(1);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]?.id).toBe('m-real-1');
  });

  it('parses fixture: basic inbox', async () => {
    const html = await readFixture('inbox-basic.html');
    const result = parseInboxRows(html);

    expect(result.messages).toHaveLength(2);
    expect(result.skippedAdRowCount).toBe(0);
  });

  it('parses fixture: sponsored row on top', async () => {
    const html = await readFixture('inbox-with-sponsored-top-row.html');
    const result = parseInboxRows(html);

    expect(result.messages).toHaveLength(2);
    expect(result.skippedAdRowCount).toBe(1);
    expect(result.messages[0]?.id).toBe('m-2001');
  });

  it('parses fixture: noisy mixed inbox', async () => {
    const html = await readFixture('inbox-noisy-mixed.html');
    const result = parseInboxRows(html);

    expect(result.messages).toHaveLength(2);
    expect(result.skippedAdRowCount).toBe(2);
  });
});

async function readFixture(fileName: string): Promise<string> {
  return readFile(join(process.cwd(), 'tests', 'fixtures', 'sapo', fileName), 'utf8');
}
