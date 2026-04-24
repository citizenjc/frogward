# SAPO Selector Notes (Live Probe + Read-Only Listing)

These notes capture the current selector strategy for **login + inbox reachability probe only**.

Current milestone also includes read-only inbox row listing/parsing.

## Goals

- Reach authenticated inbox safely
- Avoid message mutation actions
- Keep selectors resilient and maintainable

## Selector priority

Use selectors in this order:

1. Role/accessibility selectors (when available in future module upgrades)
2. Stable attribute selectors (`name`, `type`, `href` fragments)
3. Text selectors (localized text can drift)
4. CSS fallback selectors only as last resort

## Login inputs

Current module attempts:

- Username/email field:
  - `input[type="email"]`
  - `input[name*="user"]`
  - `input[name*="mail"]`
- Password field:
  - `input[type="password"]`
- Submit action:
  - `button[type="submit"]`
  - `input[type="submit"]`

## Authenticated-state signals

Probe currently treats auth success as one of:

- URL contains `/inbox`
- Inbox navigation/link selector visible:
  - `a[href*="inbox"]`

## Known UI branches/interstitial handling plan

Expected branches to monitor and extend in future updates:

- Cookie/consent banner before login form
- Redirect landing page before mailbox shell
- Unexpected auth challenge/interstitial page
- Security verification / hCaptcha after password submit

For each branch, future code should:

1. detect branch quickly,
2. log branch name,
3. apply deterministic handling,
4. capture artifacts on failure.

## Probe safety rule

Selectors and interactions in this milestone must remain login/inbox-surface only:

- do not open message rows,
- do not click forward/reply/delete/archive controls,
- do not perform mutation actions.

## Forwarding selector contract (explicit forward mode only)

Planned minimal forward interaction sequence:

1. Open target message row (from parsed `newMessages` id)
2. Trigger forward action via first-available selector fallback
   - preferred: `[data-test="forward"]`
   - fallback: `[data-action="forward"]`, button/link text variants
3. Fill destination recipient input
4. Submit forward compose form
5. Confirm success signal before marking forwarded state

Browser seam additions for forwarding support:

- `clickFirst(selectors: string[])` for deterministic selector fallback without leaking branchy logic into forwarding module.

## Live forwarding UI observations (shakedown)

Observed in current live session:

- Message row class example: `list-item focus unread`
- Stable per-row input id observed (example: `26218`) even when `data-message-id`/`data-id` are absent
- Row internals still expose:
  - `.from`
  - `.subject`
  - `.datetime` / `.date` / `.time`

Forward controls in current observed inbox view did **not** expose:

- `[data-test="forward"]`
- `[data-action="forward"]`
- `[data-test="send-forward"]`
- `input[data-test="forward-recipient"]`

Implication:

- Forward flow should rely on fallback selector chains and compose/send confirmation checks rather than assuming data-test hooks exist.

Additional live forwarding observations from the successful shakedown:

- Visible message-view forward action worked via footer control:
  - `.message-bottom-actions .clear.button:has-text("Encaminhar")`
- Compose recipient entry used:
  - `.recipents-list input[type="text"]`
- Recipient safety requires pressing `Enter` so SAPO converts the typed address into a recipient chip before verification/send.
- Compose send action used:
  - `span.button:has-text("Enviar")`
- Reliable post-send toast/alert was not consistently visible; Sent-folder verification by destination + subject was required as a confirmation fallback.

## Manual verification evidence to capture

For each live shakedown scenario, capture these signals:

1. **Filtered**
   - `app.forward.filtered`
   - no compose/send mutation evidence for that message
   - local state record with `status: filtered`

2. **Success**
   - `sapo.forward.success`
   - `app.forward.complete` with `successCount: 1` for the controlled run
   - local state record with `status: success`
   - destination mailbox receives exactly one expected forwarded message

3. **Controlled failure**
   - `sapo.forward.stage_failed`
   - `app.forward.failed`
   - local state record with `status: failed` and incremented `attempts`
   - no unexpected forwarded copy in the destination mailbox

Reset local state between scenarios when you need a fresh “new message” baseline:

- remove `tmp/live-artifacts/`
- remove the local state/session files under `tmp/sapo/`

## Inbox listing extraction notes (read-only)

Row detection currently targets list-surface row classes:

- `mail-item`
- `message-row`
- `thread-row`

Identity policy for polling milestone:

1. Prefer SAPO-native row ids (`data-message-id`, `data-id`) with `source: sapo-row-id`.
2. If unavailable, use DOM-derived stable row inputs (e.g., checkbox/input ids) with `source: dom-fallback`.
3. Use hash fallback only when no stable row id exists (`source: subject-time-hash`).

This is intentionally "stateful new detection" rather than fuzzy dedupe of lookalike messages.

Polling milestone note:

- `new` means newly seen by local scan state, not semantically unique message content.
- repeated row ids should not be re-emitted as new once seen.

Ad/sponsored skip signals:

- row class token equals one of: `ad`, `ads`, `sponsored`, `promo`, `publicidade`
- row text includes markers like `publicidade`, `patrocinado`, `sponsored`, `anúncio`
- fallback: `pub` marker in text with no detectable sender/subject fields

Non-goal reminder for this milestone:

- listing must remain read-only and avoid opening message rows.
