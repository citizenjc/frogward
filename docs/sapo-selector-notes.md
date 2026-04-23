# SAPO Selector Notes (Live Probe Milestone)

These notes capture the current selector strategy for **login + inbox reachability probe only**.

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
