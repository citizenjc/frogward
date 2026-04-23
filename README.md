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

## Planned goals

- Log into SAPO webmail safely
- Detect newly arrived messages
- Forward selected mail to another address
- Avoid duplicate forwarding
- Be simple to self-host

## Development notes

Initial repo setup only. Implementation to follow.
