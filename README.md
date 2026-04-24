# Frogward

Forward mail from SAPO webmail without depending on flaky IMAP/POP/forwarding.

## Idea

Frogward is intended to run on a home server and automate `mail.sapo.pt` via the web UI, detect new messages, and forward them to a more reliable inbox.

## Status

Current milestone is a **live forwarding shakedown/hardening pass**:

- live login/session reuse is already in place
- read-only inbox listing + new-mail detection are already in place
- `--forward-new` now exists, but this milestone is about proving and hardening it against real SAPO UI behavior
- this is **not** a productionization pass for hosted workers, delivery guarantees, or broad mailbox feature expansion

## Current read-only listing contract (in progress)

Inbox list parsing is list-surface only and does **not** open messages.

Planned summary fields:

- required: `id`, `from`, `subject`, `receivedAt`
- optional: `isUnread`, `preview`, `folder`, `rowType`, `source`, `confidence`

This model intentionally differs from any future “opened full message” schema.

## Stack

- Node.js 20+
- TypeScript
- Playwright
- playwright-extra + stealth plugin for live probe runs
- Vitest
- ESLint + Prettier

## Local setup

1. Use Node.js 20 (`.nvmrc` included).
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env`.
4. Run `npm run dev -- --check` for the scaffold smoke path.

## Commands

- `npm run dev -- --check` — validate config and run the scaffold no-op check flow
- `npm run dev -- --probe` — run explicit probe-only path (never calls forwarding)
- `npm run dev -- --once` — run a single stateful read-only scan
- `npm run dev -- --poll` — run repeated stateful read-only scans on interval
- `npm run lint` — run ESLint
- `npm run typecheck` — run TypeScript checks
- `npm run test` — run unit tests
- `npm run test:e2e` — run the smoke CLI e2e test
- `npm run check` — run lint + typecheck + unit tests
- `npm run pw:install` — install Playwright Chromium dependencies

## Environment

Real secrets stay in local `.env` only.

| Variable                        | Required  | Notes                                                                |
| ------------------------------- | --------- | -------------------------------------------------------------------- |
| `APP_MODE`                      | No        | `scaffold` by default; set `live` to require real SAPO credentials.  |
| `SAPO_USERNAME`                 | Live mode | SAPO webmail login identifier.                                       |
| `SAPO_PASSWORD`                 | Live mode | SAPO webmail password.                                               |
| `DESTINATION_EMAIL`             | Live mode | Forwarding destination inbox.                                        |
| `POLL_INTERVAL_MS`              | No        | Poll interval, default `60000`.                                      |
| `POLL_ERROR_BACKOFF_MS`         | No        | Backoff after scan failure in poll mode, default `5000`.             |
| `HEADLESS`                      | No        | Set `false` to watch browser actions locally.                        |
| `STATE_FILE_PATH`               | No        | Local JSON file for processed message state.                         |
| `STORAGE_STATE_PATH`            | Live mode | Reusable Playwright storage state file path under `tmp/*.auth.json`. |
| `PERSIST_STORAGE_STATE`         | No        | Set `false` to disable saving refreshed login session state.         |
| `ARTIFACT_DIR`                  | No        | Local gitignored folder under `tmp/` for live probe artifacts.       |
| `CAPTURE_SCREENSHOT_ON_FAILURE` | No        | Capture screenshot on probe failures (`true` default).               |
| `CAPTURE_TRACE_ON_FAILURE`      | No        | Capture Playwright trace on probe failures (`true` default).         |
| `FORWARDING_ENABLED`            | No        | Enable explicit forwarding mode (`false` default).                   |
| `FORWARDING_ACK`                | No        | Operator acknowledgment required when forwarding is enabled.         |
| `FORWARDING_WARP_TOKEN`         | No        | Required non-empty Warp approval token for forwarding mode.          |
| `FORWARD_ALLOW_SENDERS`         | No        | Comma-separated sender allow patterns (substring match).             |
| `FORWARD_BLOCK_SENDERS`         | No        | Comma-separated sender block patterns (substring match).             |
| `FORWARD_ALLOW_SUBJECTS`        | No        | Comma-separated subject allow patterns (substring match).            |
| `FORWARD_BLOCK_SUBJECTS`        | No        | Comma-separated subject block patterns (substring match).            |
| `LOG_LEVEL`                     | No        | `debug`, `info`, `warn`, or `error`.                                 |

Config validation fails fast and redacts email-like values in startup errors.

## Local state

The app uses a local JSON file for mailbox scan state. Missing state bootstraps to an empty seen/forwarded model, writes are atomic via temp-file rename, duplicate seen ids are ignored, and corrupt files are quarantined to `*.corrupt` before a fresh empty state is used.

Current format:

```json
{
  "seen": [
    {
      "id": "message-id",
      "firstSeenAt": "2026-04-23T00:00:00.000Z",
      "lastSeenAt": "2026-04-23T00:00:00.000Z",
      "source": "sapo-row-id",
      "confidence": "high"
    }
  ],
  "forwarded": [],
  "scan": {
    "scanCount": 1,
    "lastNewCount": 0,
    "lastScanAt": "2026-04-23T00:00:00.000Z",
    "bootstrapCompletedAt": "2026-04-23T00:00:00.000Z"
  }
}
```

`seen` state is read-only scan tracking; `forwarded` is reserved for a later milestone.

## Logging and failures

- Logs are newline-delimited JSON events.
- Email-like values and secret-shaped fields are redacted before log output.
- Config, browser, and module failures use centralized app error types.
- Fatal startup/runtime failures exit non-zero and include whether the failure is retryable.
- Probe summary logs should prefer counts and redacted samples over full mailbox row dumps.
- Forwarding logs should expose stage-level outcomes (`open`, `compose`, `send`, `confirm`) without raw recipient addresses, full mailbox dumps, or full local artifact paths.
- Failure artifact logs expose only basename/local-only summaries; inspect actual files directly under `tmp/live-artifacts/` on disk.

## Security notes

- Keep real credentials only in local `.env` files.
- Do not commit Playwright storage state files.
- Logs redact email-like values and secret-shaped fields before output.
- Runtime JSON state is local-only and should not contain credentials.
- Live probe artifacts (screenshots, traces, HTML captures) may contain mailbox/session data and must remain local-only.

## Mandatory security gate (live auth/session)

Before executing any real SAPO auth or storage-state reuse work, complete this checkpoint:

1. Confirm log redaction still covers credentials, tokens, and mailbox identifiers.
2. Confirm screenshot/trace/artifact paths are gitignored and local-only.
3. Confirm storage-state path is local-only and treated as a secret.
4. Confirm session-file lifecycle (create/reuse/refresh/delete) is documented.
5. Confirm operator understands artifacts may contain mailbox/session data.

Do not proceed with real-auth execution until this checklist is approved.

## Mandatory forwarding security gate (live mutation)

Before any live forwarding execution:

1. Complete Warp review for forwarding flow changes.
2. Set `FORWARDING_ENABLED=true` intentionally.
3. Set `FORWARDING_ACK=true` to confirm operator acknowledgment.
4. Provide a non-empty `FORWARDING_WARP_TOKEN` from the review checkpoint.
5. Verify destination handling and logs stay redacted/local-safe.

Do not run mutation mode unless all forwarding gate items are satisfied.

## Live forwarding shakedown checkpoint (required)

Before any manual live forwarding shakedown run:

1. Warp/security review is approved for the current forwarding code revision.
2. A controlled destination mailbox is confirmed (non-production critical).
3. A controlled test message strategy exists (filtered, success, failure scenarios).
4. Local artifact/state paths are confirmed and gitignored.
5. Operator confirms rollback/cleanup steps before mutation begins.

If any item is missing, stop and do not run `--forward-new`.

### Safe local operator checklist (pre-live run)

- `.env` exists locally and is never committed.
- `APP_MODE=live` is set intentionally for the run.
- `STORAGE_STATE_PATH` points to a gitignored local file.
- Artifact output paths stay under `tmp/` gitignored local folders.
- You are using probe/check mode only (`--probe` or `--check`, no forwarding intent).

### Session/artifact lifecycle

- Keep `STORAGE_STATE_PATH` under `tmp/` and treat it like a secret.
- Traces are saved on failure only.
- Screenshots/HTML failure captures stay under `tmp/` and may include mailbox/session data.
- Cleanup after debugging with: `rm -rf tmp/live-artifacts tmp/sapo`

### Forward shakedown log/artifact triage

After a failed `--forward-new` shakedown run, inspect in this order:

1. `sapo.forward.stage_failed` to see whether the failure happened in `open`, `compose`, `send`, or `confirm`.
2. `app.forward.failed` for the persisted retry reason recorded against the message id.
3. `app.failure.screenshot` / `app.failure.html` to confirm local artifacts were captured.
4. Files inside `tmp/live-artifacts/failure/` and `tmp/live-artifacts/trace/` for selector or toast/compose evidence.

These logs intentionally keep destinations redacted and do not print full local file paths; use the local `tmp/` folders for detailed inspection.

## Manual live probe checklist (non-CI)

Run this manually with local credentials only:

1. Set local env values: `APP_MODE=live`, `SAPO_USERNAME`, `SAPO_PASSWORD`, `STORAGE_STATE_PATH`, `ARTIFACT_DIR`.
2. Run `npm run dev -- --probe`.
3. Confirm logs include:
   - `app.start` with `safetyLevel=probe`
   - `sapo.login.*` success path
   - `sapo.check.probe_summary` with `inboxReached=true`
   - `app.check.complete`
4. Confirm **no forwarding logs** (`sapo.forward.*`) appear.
5. If failure occurs, confirm screenshot/trace/html artifacts are created under gitignored local paths.

Expected outcome for this milestone: one narrowly scoped, operator-driven live forwarding shakedown with explicit filtered/success/failure evidence and local artifact/state review.

## Forwarding mode notes

- `--forward-new` is the only mutation-capable mode.
- `--once`, `--poll`, `--check`, and `--probe` remain read-only.
- Forward filters are substring-based and applied before any forward action.
- Filtered messages may be recorded as `filtered`; failed sends remain unforwarded and retry-eligible.
- Forward logs should expose stable event names and redacted destination summaries, not raw addresses or full mailbox dumps.

### Forward selector reality note

Current live SAPO UI observations show row-level ids via checkbox/input ids and standard row classes, but no stable forwarding data-test hooks in the observed inbox view. Forwarding logic must therefore use fallback selector chains and explicit post-action confirmation checks.

## Manual live forwarding shakedown runbook

Use this only for a controlled local run after the Warp/security checkpoint is approved.

### Setup

1. Prepare a sacrificial destination mailbox that is not business-critical.
2. Prepare one sacrificial SAPO inbox message for each planned scenario.
3. Confirm `.env` contains at least:
   - `APP_MODE=live`
   - `SAPO_USERNAME=...`
   - `SAPO_PASSWORD=...`
   - `DESTINATION_EMAIL=...`
   - `FORWARDING_ENABLED=true`
   - `FORWARDING_ACK=true`
   - `FORWARDING_WARP_TOKEN=...`
   - `STATE_FILE_PATH=tmp/sapo/runtime-state.json`
   - `STORAGE_STATE_PATH=tmp/sapo/session.auth.json`
   - `ARTIFACT_DIR=tmp/live-artifacts`
4. Confirm `tmp/` is gitignored and writable.
5. Optional but recommended: remove stale local state before the first shakedown:
   - `rm -rf tmp/live-artifacts tmp/sapo`

### Dry verification before mutation

1. Run `npm run dev -- --probe`.
2. Confirm login/inbox reachability still works.
3. Confirm no `sapo.forward.*` logs appear.
4. If probe fails, stop and inspect local artifacts before attempting `--forward-new`.

### First controlled live forwarding run

1. Ensure exactly one intended sacrificial message should qualify as new.
2. Keep filters narrow so only the intended message is eligible.
3. Run `npm run dev -- --forward-new`.
4. Watch for these logs in order:
   - `app.forward.start`
   - `sapo.forward.start`
   - optional `sapo.forward.stage_ok` / `sapo.forward.compose_ready`
   - either `sapo.forward.success` or `sapo.forward.stage_failed`
   - `app.forward.complete`

Live note from the shakedown:

- SAPO may not emit a reliable visible success toast after send.
- The hardened flow therefore accepts either an in-page success signal **or** a matching Sent-folder entry for the same destination+subject as confirmation.
- Recipient safety is enforced before send by committing the typed address into the recipient chip and verifying it matches `DESTINATION_EMAIL`.

### What to inspect after the run

1. `tmp/sapo/runtime-state.json`
   - successful forward => message recorded as `status: "success"`
   - filtered message => message recorded as `status: "filtered"`
   - failed forward => message recorded as `status: "failed"` with incremented `attempts`
2. Destination mailbox
   - confirm exactly one expected forwarded message for the success scenario
3. `tmp/live-artifacts/failure/` and `tmp/live-artifacts/trace/`
   - inspect only if the run failed or confirmation was missing

### Cleanup after shakedown

1. Remove sacrificial forwarded mail from the destination mailbox.
2. Remove or archive sacrificial source messages as needed.
3. Clear local artifacts/state if you want a fresh rerun baseline:
   - `rm -rf tmp/live-artifacts tmp/sapo`

This runbook is intentionally local-only and operator-driven; it is not for unattended or CI mutation runs.

## Explicit live verification scenarios

Reset local state between scenarios if you need a clean “new message” baseline:

- `rm -rf tmp/live-artifacts tmp/sapo`

### Scenario A: filtered message

Goal: prove an inbox message is rejected before mutation.

1. Configure allow/block rules so the sacrificial message should be filtered.
2. Run `npm run dev -- --forward-new`.
3. Expect:
   - `app.forward.filtered`
   - no compose/send success logs for that message
   - state record with `status: "filtered"`
4. Confirm destination mailbox did not receive a forwarded copy.

### Scenario B: confirmed successful forward

Goal: prove one controlled message forwards end-to-end.

1. Narrow filters so exactly one sacrificial message is eligible.
2. Run `npm run dev -- --forward-new`.
3. Expect:
   - `sapo.forward.success`
   - `app.forward.complete` with `successCount: 1`
   - state record with `status: "success"`
   - confirmation may come from Sent-folder evidence if no visible send toast appears
4. Confirm the destination mailbox receives exactly one expected message.

### Scenario C: controlled failure / retry-safe handling

Goal: prove a failed send does not count as forwarded success.

Safe ways to induce this include a temporary selector mismatch in local code, or another controlled condition that prevents confirmation without risking unintended mail.

1. Run `npm run dev -- --forward-new` under the controlled failure setup.
2. Expect:
   - `sapo.forward.stage_failed`
   - `app.forward.failed`
   - `app.forward.complete` with `failedCount: 1`
   - state record with `status: "failed"` and incremented `attempts`
3. Confirm the destination mailbox did not receive an unexpected forwarded copy.

These three scenarios are the required manual evidence for this shakedown milestone.

## Explicit non-goals for this shakedown milestone

- No broad productionization beyond the tested shakedown path
- No background scheduler or long-running service management
- No external database, queue, or cloud deployment layer
- No secret storage beyond local environment variables
- No spam-folder traversal, all-mail aggregation, or local spam heuristics in this pass
- No delivery guarantee claims beyond observed UI confirmation and manual destination check
- No large browser/runtime rewrites beyond targeted forwarding hardening

## Planned goals

- Log into SAPO webmail safely
- Detect newly arrived messages
- Forward selected mail to another address
- Avoid duplicate forwarding
- Be simple to self-host

## Later implementation notes

- Check the spam folder too; SAPO has historically aggressive/poor spam filtering.
- Consider exposing or simulating an “all mail” style view if the UI allows it, so filtering can be handled by Frogward instead of SAPO alone.
- Consider adding local spam heuristics/scoring later instead of trusting SAPO folder placement as the source of truth.

### Future scope boundary (not implemented in this milestone)

- Inbox listing currently targets inbox rows only.
- Spam-folder traversal is intentionally deferred.
- Any all-mail aggregation and local spam heuristics belong to a later milestone after inbox parser stability is proven.

## Development notes

This repo is past initial scaffolding; the current focus is shakedown hardening and manual live validation, not broad feature expansion.

### Inbox fixture policy

- Fixture files under `tests/fixtures/sapo/` must be sanitized before commit.
- Never commit real mailbox content, credentials, addresses, cookies, or session tokens.
- Fixtures should be synthetic/minimized samples that preserve selector shape and ad-row edge cases only.
