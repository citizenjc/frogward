import type { BrowserPage } from '../lib/browser.js';
import type {
  ForwardConfirmationSignal,
  ForwardContext,
  ForwardMessageResult
} from '../types/runtime.js';
import { resolveInboxUrl, resolveSentUrl } from './mailbox-routes.js';

interface ForwardInput extends ForwardContext {
  page: BrowserPage;
}

const OPEN_MESSAGE_SELECTORS = (messageId: string): string[] => [
  `.list-item:has(input[id="${messageId}"]) .container`,
  `.list-item:has(input[id="${messageId}"]) .content`,
  `label[for="${messageId}"]`,
  `input[id="${messageId}"]`,
  `input[value="${messageId}"]`,
  `[data-message-id="${messageId}"]`,
  `[data-id="${messageId}"]`,
  '.list-item.focus',
  '.mail-item'
];

const FORWARD_ACTION_SELECTORS = [
  '.message-bottom-actions .clear.button:has-text("Encaminhar")',
  'button[data-test="forward"]',
  'button[title*="Forward"]',
  'button[title*="Reencaminhar"]',
  '[data-action="forward"]',
  'button:has-text("Forward")',
  'button:has-text("Encaminhar")',
  'button:has-text("Reencaminhar")',
  '.clear.button:has-text("Encaminhar")',
  'span.clear.button:has-text("Encaminhar")',
  'a:has-text("Forward")',
  'a:has-text("Encaminhar")',
  'a:has-text("Reencaminhar")'
];

const RECIPIENT_INPUT_SELECTORS = [
  '.recipents-list input[type="text"]',
  'input[data-test="forward-recipient"]',
  'input[name*="to"]',
  'input[placeholder*="To"]',
  'input[placeholder*="Para"]',
  'input[aria-label*="To"]',
  'input[aria-label*="Para"]'
];

const RECIPIENT_CONTAINER_SELECTORS = ['.recipents-list'];

const COMPOSE_READY_SELECTORS = [
  '.recipents-list',
  '#subject',
  'button:has-text("Enviar")',
  'h2:has-text("Nova mensagem")'
];

const BODY_EDITOR_SELECTORS = [
  '[contenteditable="true"]',
  '.fr-element[contenteditable="true"]',
  '.note-editable[contenteditable="true"]',
  '.cke_editable',
  'textarea'
];

const SEND_ACTION_SELECTORS = [
  'span.button:has-text("Enviar")',
  '[role="button"]:has-text("Enviar")',
  'button:has-text("Enviar")',
  'button[data-test="send-forward"]',
  'button[type="submit"]',
  'button:has-text("Send")'
];

const SUCCESS_SIGNAL_SELECTORS = [
  '[role="status"]',
  '[data-test="toast-success"]',
  '.toast-success',
  '.notification-success'
];

const ERROR_SIGNAL_SELECTORS = [
  '[role="alert"]',
  '[data-test="toast-error"]',
  '.toast-error',
  '.notification-error',
  '.error',
  '.form-error'
];

const SUCCESS_TEXT_MARKERS = ['message sent', 'mensagem enviada', 'email enviado'];
const ERROR_TEXT_MARKERS = ['failed to send', 'erro ao enviar', 'não foi possível enviar'];
const FROGWARD_FORWARD_NOTE = 'Automatically forwarded by Frogward.';

export async function forwardMessage({
  config,
  logger,
  message,
  page
}: ForwardInput): Promise<ForwardMessageResult> {
  if (!config.destinationEmail) {
    return {
      messageId: message.id,
      status: 'failed',
      reason: 'missing_destination',
      stage: 'compose'
    };
  }

  logger.info('sapo.forward.start', {
    destinationSummary: summarizeDestination(config.destinationEmail),
    messageId: message.id
  });

  await dismissForwardInterstitials(page);

  const opened = await page.clickFirst(OPEN_MESSAGE_SELECTORS(message.id));
  if (!opened) {
    logger.warn('sapo.forward.stage_failed', {
      messageId: message.id,
      reason: 'open_message_failed',
      stage: 'open'
    });
    return {
      messageId: message.id,
      status: 'failed',
      reason: 'open_message_failed',
      stage: 'open'
    };
  }

  logger.debug('sapo.forward.stage_ok', {
    messageId: message.id,
    stage: 'open'
  });

  await dismissForwardInterstitials(page);
  await page.waitForAnySelector(['.clear.button', 'span.clear.button', '[role="button"]'], 3_000);

  const startedForward = await page.clickFirst(FORWARD_ACTION_SELECTORS);
  const startedForwardByText =
    startedForward || (await page.clickFirstByText(['Encaminhar', 'Reencaminhar', 'Forward']));
  if (!startedForwardByText) {
    logger.warn('sapo.forward.stage_failed', {
      messageId: message.id,
      reason: 'forward_action_not_found',
      stage: 'compose'
    });
    return {
      messageId: message.id,
      status: 'failed',
      reason: 'forward_action_not_found',
      stage: 'compose'
    };
  }

  await page.waitForAnySelector(COMPOSE_READY_SELECTORS, 8_000);

  const recipientSelector = await page.waitForAnySelector(RECIPIENT_INPUT_SELECTORS, 3_000);
  if (!recipientSelector) {
    logger.warn('sapo.forward.stage_failed', {
      messageId: message.id,
      reason: 'compose_open_failed',
      stage: 'compose'
    });
    return {
      messageId: message.id,
      status: 'failed',
      reason: 'compose_open_failed',
      stage: 'compose'
    };
  }

  logger.debug('sapo.forward.compose_ready', {
    messageId: message.id,
    recipientSelector
  });

  await page.fill(recipientSelector, config.destinationEmail);
  await page.pressKey('Enter');
  await new Promise((resolve) => setTimeout(resolve, 1200));

  const recipientValue = normalizeRecipientValue(await page.readFieldValue(recipientSelector));
  const recipientChipHtml = await readRecipientContainerHtml(page);
  const normalizedDestination = normalizeRecipientValue(config.destinationEmail);
  const recipientVerified =
    recipientValue.includes(normalizedDestination) ||
    normalizeRecipientValue(recipientChipHtml).includes(normalizedDestination);

  if (!recipientVerified) {
    logger.warn('sapo.forward.stage_failed', {
      messageId: message.id,
      reason: 'recipient_verification_failed',
      stage: 'compose'
    });
    return {
      messageId: message.id,
      status: 'failed',
      reason: 'recipient_verification_failed',
      stage: 'compose'
    };
  }

  const noteInserted = await page.prependText(BODY_EDITOR_SELECTORS, FROGWARD_FORWARD_NOTE);
  if (!noteInserted) {
    logger.debug('sapo.forward.note_skipped', {
      messageId: message.id
    });
  }

  const submitted = await page.clickFirst(SEND_ACTION_SELECTORS);
  if (!submitted) {
    logger.warn('sapo.forward.stage_failed', {
      messageId: message.id,
      reason: 'submit_not_found',
      stage: 'send'
    });
    return {
      messageId: message.id,
      status: 'failed',
      reason: 'submit_not_found',
      stage: 'send'
    };
  }

  logger.debug('sapo.forward.send_submitted', {
    messageId: message.id
  });

  const confirmation = await confirmForwardOutcome(page, message, config.destinationEmail);
  if (confirmation.outcome === 'failed') {
    logger.warn('sapo.forward.stage_failed', {
      messageId: message.id,
      reason: 'send_failed',
      stage: 'confirm',
      confirmation: confirmation.signal
    });
    return {
      messageId: message.id,
      status: 'failed',
      reason: 'send_failed',
      stage: 'confirm',
      confirmation: confirmation.signal
    };
  }

  if (confirmation.outcome !== 'success') {
    logger.warn('sapo.forward.stage_failed', {
      messageId: message.id,
      reason: 'send_confirmation_missing',
      stage: 'confirm'
    });
    return {
      messageId: message.id,
      status: 'failed',
      reason: 'send_confirmation_missing',
      stage: 'confirm'
    };
  }

  logger.info('sapo.forward.success', {
    confirmation: confirmation.signal,
    messageId: message.id
  });

  return {
    messageId: message.id,
    status: 'success',
    confirmation: confirmation.signal
  };
}

function summarizeDestination(destination: string): string {
  const [localPart, domain = 'redacted'] = destination.split('@');
  const first = localPart?.slice(0, 1) || 'x';
  const last = localPart && localPart.length > 1 ? localPart.slice(-1) : 'x';
  return `${first}***${last}@${domain}`;
}

function normalizeRecipientValue(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

async function readRecipientContainerHtml(page: BrowserPage): Promise<string | undefined> {
  for (const selector of RECIPIENT_CONTAINER_SELECTORS) {
    const html = await page.readInnerHtml(selector);
    if (html) {
      return html;
    }
  }

  return undefined;
}

async function dismissForwardInterstitials(page: BrowserPage): Promise<void> {
  await page.clickFirst([
    'button:has-text("ACEITAR")',
    'button:has-text("Aceitar")',
    'button:has-text("Accept")',
    'button#onetrust-accept-btn-handler'
  ]);
}

async function confirmForwardOutcome(
  page: BrowserPage,
  message: ForwardContext['message'],
  destinationEmail: string
): Promise<
  | { outcome: 'success'; signal: ForwardConfirmationSignal }
  | { outcome: 'failed'; signal: ForwardConfirmationSignal }
  | { outcome: 'unknown' }
> {
  const successContent = await matchContentMarker(page, SUCCESS_TEXT_MARKERS);
  if (successContent) {
    return { outcome: 'success', signal: successContent };
  }

  const successSelector = await page.waitForAnySelector(SUCCESS_SIGNAL_SELECTORS, 2_000);
  if (successSelector) {
    return { outcome: 'success', signal: { via: 'selector', signal: successSelector } };
  }

  const errorContent = await matchContentMarker(page, ERROR_TEXT_MARKERS);
  if (errorContent) {
    return { outcome: 'failed', signal: errorContent };
  }

  const errorSelector = await page.waitForAnySelector(ERROR_SIGNAL_SELECTORS, 2_000);
  if (errorSelector) {
    return { outcome: 'failed', signal: { via: 'selector', signal: errorSelector } };
  }

  const sentFolderConfirmation = await confirmViaSentFolder(page, message, destinationEmail);
  if (sentFolderConfirmation) {
    return { outcome: 'success', signal: sentFolderConfirmation };
  }

  return { outcome: 'unknown' };
}

async function matchContentMarker(
  page: BrowserPage,
  markers: string[]
): Promise<ForwardConfirmationSignal | undefined> {
  for (const marker of markers) {
    const matched = await page.contentIncludesAny([marker]);
    if (matched) {
      return { via: 'content', signal: marker };
    }
  }

  return undefined;
}

async function confirmViaSentFolder(
  page: BrowserPage,
  message: ForwardContext['message'],
  destinationEmail: string
): Promise<ForwardConfirmationSignal | undefined> {
  const currentUrl = page.url();

  try {
    await page.goto(await resolveSentUrl(page));
    await page.waitForAnySelector(
      ['.list-item', '.messages-list', 'h2:has-text("Enviados")'],
      8_000
    );

    const sentHtml = (await page.content()).toLowerCase();
    const destinationMatch = sentHtml.includes(destinationEmail.toLowerCase());
    const subjectMatch = sentHtml.includes(message.subject.toLowerCase());

    if (destinationMatch && subjectMatch) {
      return {
        via: 'content',
        signal: `sent-folder:${destinationEmail}`
      };
    }

    return undefined;
  } finally {
    await page.goto(currentUrl || (await resolveInboxUrl(page)));
  }
}
