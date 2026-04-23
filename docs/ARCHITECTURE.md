# Architecture

Current probe-enabled scaffold shape:

1. `src/index.ts` starts the CLI entrypoint.
2. `src/cli.ts` parses run mode and safety level (`--check` / `--probe` => probe safety).
3. `src/app.ts` wires config, logging, browser lifecycle, state, login, inbox check, and forwarding boundaries.
4. `src/config/*` loads `.env` values and validates typed runtime config.
5. `src/modules/login.ts` performs auth reuse/interactive login checks and failure artifacts.
6. `src/modules/check.ts` performs inbox reachability probe summary only (no mutation).
7. `src/modules/forward.ts` remains separated and skipped in probe safety mode.
8. `src/modules/state.ts` persists processed message ids to a local JSON file using atomic temp-file writes.
9. `src/lib/*` holds shared browser, logger, and error infrastructure.

Runtime flow:

1. Load validated config
2. Initialize logger and state store
3. Start a stub browser in scaffold mode, or real Playwright in live mode
4. Run SAPO login placeholder
5. Run inbox check placeholder
6. In probe safety (`--check` or `--probe`), stop after reporting discovered messages
7. In forward safety (`--once` default), pass discovered messages to the forwarding placeholder
8. In live mode, capture debug artifacts (trace, optional screenshot/html) only under `tmp/` gitignored paths

Security gate for live auth/session work:

- Any task that touches real SAPO credentials, cookies, or reusable storage state is blocked until an explicit security checkpoint approves:
  - redaction coverage in logs
  - local-only artifact/session paths
  - storage-state lifecycle handling
  - operator warning that artifacts can include mailbox/session data
- Live probe execution should use check/probe mode only for this milestone.
- Storage state must stay under `tmp/*.auth.json`; refreshed session persistence can be disabled explicitly.
- Failure traces are retained only on failed runs; successful runs should not leave trace artifacts behind.

State notes:

- State lives in a local JSON file configured by `STATE_FILE_PATH`
- Missing files resolve to empty state
- Invalid JSON is moved aside to `*.corrupt`
- Duplicate processed ids are ignored

Milestone boundary: this architecture supports live login + inbox probe and diagnostics only; forwarding is still intentionally out of scope for live runs in this milestone.
