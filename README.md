# Frogward

Forward mail from SAPO webmail without depending on flaky IMAP/POP/forwarding.

## Idea

Frogward is intended to run on a home server and automate `mail.sapo.pt` via the web UI, detect new messages, and forward them to a more reliable inbox.

## Status

Live probe milestone in progress: login + inbox reachability verification without forwarding.

Read-only inbox listing milestone in progress: parse list-surface message rows and skip ad/promoted rows without opening messages.

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
- `npm run dev` — run the scaffold once flow
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
| `HEADLESS`                      | No        | Set `false` to watch browser actions locally.                        |
| `STATE_FILE_PATH`               | No        | Local JSON file for processed message state.                         |
| `STORAGE_STATE_PATH`            | Live mode | Reusable Playwright storage state file path under `tmp/*.auth.json`. |
| `PERSIST_STORAGE_STATE`         | No        | Set `false` to disable saving refreshed login session state.         |
| `ARTIFACT_DIR`                  | No        | Local gitignored folder under `tmp/` for live probe artifacts.       |
| `CAPTURE_SCREENSHOT_ON_FAILURE` | No        | Capture screenshot on probe failures (`true` default).               |
| `CAPTURE_TRACE_ON_FAILURE`      | No        | Capture Playwright trace on probe failures (`true` default).         |
| `LOG_LEVEL`                     | No        | `debug`, `info`, `warn`, or `error`.                                 |

Config validation fails fast and redacts email-like values in startup errors.

## Local state

The scaffold uses a local JSON file for processed message tracking. Missing state bootstraps to an empty list, writes are atomic via temp-file rename, duplicate message ids are ignored, and corrupt files are quarantined to `*.corrupt` before a fresh empty state is used.

Current format:

```json
{
  "processed": [
    {
      "id": "message-id",
      "processedAt": "2026-04-23T00:00:00.000Z"
    }
  ]
}
```

## Logging and failures

- Logs are newline-delimited JSON events.
- Email-like values and secret-shaped fields are redacted before log output.
- Config, browser, and module failures use centralized app error types.
- Fatal startup/runtime failures exit non-zero and include whether the failure is retryable.
- Probe summary logs should prefer counts and redacted samples over full mailbox row dumps.

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

Expected outcome for this milestone: login + inbox reachability only, no message forwarding or mutation actions.

## Explicit non-goals for this scaffold

- No production forwarding support yet (probe only)
- No background scheduler or long-running service management
- No external database, queue, or cloud deployment layer
- No secret storage beyond local environment variables

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

Initial repo setup only. Implementation to follow.

### Inbox fixture policy

- Fixture files under `tests/fixtures/sapo/` must be sanitized before commit.
- Never commit real mailbox content, credentials, addresses, cookies, or session tokens.
- Fixtures should be synthetic/minimized samples that preserve selector shape and ad-row edge cases only.
