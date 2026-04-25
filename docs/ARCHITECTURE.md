# Architecture

Current service-first architecture:

1. `src/index.ts` starts the CLI entrypoint.
2. `src/cli.ts` parses run mode and safety level (`--service` is the real unattended mode).
3. `src/app.ts` wires config, logging, browser lifecycle, state, login, inbox check, and forwarding boundaries.
4. `src/config/*` loads `.env` values and validates typed runtime config.
5. `src/modules/login.ts` performs auth reuse/interactive login checks and failure artifacts.
6. `src/modules/check.ts` performs inbox reachability + read-only listing summary + new-vs-seen detection (no mutation).
7. `src/modules/forward.ts` remains separated and skipped in probe safety mode.
8. `src/modules/inbox-parser.ts` parses inbox row HTML into typed summaries while skipping ad/promoted rows.
9. `src/modules/new-mail-detector.ts` computes bootstrap/new/already-seen transitions against persisted seen state.
10. `src/modules/poll.ts` orchestrates repeated scan cycles with interval/backoff and lifecycle logs, and can run post-scan forwarding hooks for service mode.
11. `src/modules/state.ts` persists mailbox scan state (`seen`, `forwarded`, scan counters) to a local JSON file using atomic temp-file writes.
12. `src/lib/*` holds shared browser, logger, and error infrastructure.

Runtime flow:

1. Load validated config
2. Initialize logger and state store
3. Start Playwright in live mode by default (stub browser remains an internal test/dev path)
4. Run SAPO login
5. Run inbox check
6. In probe safety (`--check` or `--probe`), stop after reporting discovered messages
7. In explicit mutation modes (`--forward-new` and `--service`), pass discovered new messages to the forwarding pipeline
8. In live mode, capture debug artifacts (trace, optional screenshot/html) only under `tmp/` gitignored paths

Service mode boundary:

- `--service` is the always-on application mode for unattended polling + forwarding.
- It reuses the same forward gate, filter rules, recipient verification, and state model as manual `--forward-new`.
- The app process itself is continuous, but external process supervision (systemd/pm2/docker restart policy) is still an operational concern outside the core app.

Logging boundary for read-only listing:

- Return full parsed summaries internally for app flow/tests.
- Emit only aggregate metrics and redacted sender/subject samples in probe logs.
- Avoid full mailbox-content dumps in routine logs.

Security gate for live auth/session work:

- Any task that touches real SAPO credentials, cookies, or reusable storage state is blocked until an explicit security checkpoint approves:
  - redaction coverage in logs
  - local-only artifact/session paths
  - storage-state lifecycle handling
  - operator warning that artifacts can include mailbox/session data
- Live probe execution should use check/probe mode only for this milestone.
- Storage state must stay under `tmp/*.auth.json`; refreshed session persistence can be disabled explicitly.
- Failure traces are retained only on failed runs; successful runs should not leave trace artifacts behind.

Forwarding mutation gate:

- Explicit forwarding mode must be separately acknowledged via config gate flags.
- Warp review token is required before live mutation mode can execute.
- Read-only modes (`--check`, `--probe`, `--once`, `--poll`) remain non-mutating.

Live shakedown gate:

- Manual `--forward-new` runs require explicit Warp/security approval for the current revision.
- Shakedown scenarios must include filtered/success/failure outcomes before any broader usage.
- This gate is a stop condition, not optional guidance.

Forwarding lifecycle boundary:

- Only `newMessages` enter the forward pipeline.
- Filter decisions happen before any mutation attempt.
- `filtered`, `success`, and `failed` outcomes are persisted locally for operator review.
- Only `success` counts as forwarded for dedupe purposes; failed attempts stay retry-visible.
- Completion logs must report actual filtered/success/failed totals, not just candidate volume.
- Success confirmation may come from explicit UI success signals or a verified Sent-folder fallback when the SAPO UI omits a reliable post-send toast.
- Recipient safety requires the committed compose recipient chip/container to match `DESTINATION_EMAIL` before the send control is clicked.

State notes:

- State lives in a local JSON file configured by `STATE_FILE_PATH`
- Missing files resolve to empty seen/forwarded+scan state
- Invalid JSON is moved aside to `*.corrupt`
- Duplicate seen ids are ignored
- `seen` state is scan tracking; `forwarded` remains a separate lifecycle for a later milestone

Manual shakedown boundary:

- Live forwarding validation is operator-driven and local-only.
- The supported shakedown flow is: probe first, then one narrowly scoped `--forward-new` run, then inspect state/logs/artifacts.
- The architecture does not promise unattended recovery, delivery guarantees beyond the observed UI confirmation path, or CI-driven mutation.

Milestone boundary: this architecture now supports the actual always-on service mode plus the previously proven live forwarding shakedown, but it is still a small self-hosted service rather than a broader hosted product.

Explicitly deferred beyond this milestone:

- spam-folder traversal or all-mail aggregation
- hosted/background execution models
- external persistence beyond local JSON state
- delivery guarantees stronger than UI confirmation + manual mailbox check
- broad architectural cleanup outside the forward-path seams

Next-direction note (not implemented yet):

- add spam-folder visibility after inbox parser hardening,
- evaluate all-mail style aggregation,
- then consider local spam heuristics/scoring on top of combined folder inputs.
