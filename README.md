# Frogward

Forward mail from SAPO webmail without depending on flaky IMAP/POP/forwarding.

## Idea

Frogward is intended to run on a home server and automate `mail.sapo.pt` via the web UI, detect new messages, and forward them to a more reliable inbox.

## Status

Project scaffold only for now.

## Local setup

1. Use Node.js 20 (`.nvmrc` included).
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env`.
4. Run `npm run dev -- --check` for the scaffold smoke path.

## Environment

Real secrets stay in local `.env` only.

| Variable             | Required  | Notes                                                                   |
| -------------------- | --------- | ----------------------------------------------------------------------- |
| `APP_MODE`           | No        | `scaffold` by default; set `live` to require real SAPO credentials.     |
| `SAPO_USERNAME`      | Live mode | SAPO webmail login identifier.                                          |
| `SAPO_PASSWORD`      | Live mode | SAPO webmail password.                                                  |
| `DESTINATION_EMAIL`  | Live mode | Forwarding destination inbox.                                           |
| `POLL_INTERVAL_MS`   | No        | Poll interval, default `60000`.                                         |
| `HEADLESS`           | No        | Set `false` to watch browser actions locally.                           |
| `STATE_FILE_PATH`    | No        | Local JSON file for processed message state.                            |
| `STORAGE_STATE_PATH` | No        | Optional reusable Playwright storage state file path; do not commit it. |
| `LOG_LEVEL`          | No        | `debug`, `info`, `warn`, or `error`.                                    |

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

## Planned goals

- Log into SAPO webmail safely
- Detect newly arrived messages
- Forward selected mail to another address
- Avoid duplicate forwarding
- Be simple to self-host

## Development notes

Initial repo setup only. Implementation to follow.
