# Architecture

Current scaffold shape:

1. `src/index.ts` starts the CLI entrypoint.
2. `src/cli.ts` parses simple runtime modes like `--check`.
3. `src/app.ts` wires config, logging, browser lifecycle, state, login, inbox check, and forwarding boundaries.
4. `src/config/*` loads `.env` values and validates typed runtime config.
5. `src/modules/*` keeps SAPO workflow concerns behind placeholder-safe module APIs.
6. `src/modules/state.ts` persists processed message ids to a local JSON file using atomic temp-file writes.
7. `src/lib/*` holds shared browser, logger, and error infrastructure.

Runtime flow:

1. Load validated config
2. Initialize logger and state store
3. Start a stub browser in scaffold mode, or real Playwright in live mode
4. Run SAPO login placeholder
5. Run inbox check placeholder
6. In `--check` mode, stop after reporting discovered messages
7. In `--once` mode, pass discovered messages to the forwarding placeholder

State notes:

- State lives in a local JSON file configured by `STATE_FILE_PATH`
- Missing files resolve to empty state
- Invalid JSON is moved aside to `*.corrupt`
- Duplicate processed ids are ignored

Implementation details remain intentionally shallow at scaffold time: no real selectors, no background daemon loop, and no production retry orchestration yet.
