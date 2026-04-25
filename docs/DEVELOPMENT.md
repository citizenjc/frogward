# Development

## Main commands

```bash
npm install
npm run lint
npm run typecheck
npm run test
```

## Run modes

- `--check` basic startup check
- `--probe` live read-only probe
- `--once` one read-only scan
- `--poll` repeated read-only scans
- `--forward-new` one mutation run
- `--service` continuous poll + forward mode

## Suggested workflow

1. use `--probe` while changing login/inbox behavior
2. use `--forward-new` for controlled live forwarding checks
3. use `--service` once forwarding behavior is trusted

## Important files

- `src/app.ts` main orchestration
- `src/modules/check.ts` inbox scan
- `src/modules/forward.ts` forwarding workflow
- `src/modules/poll.ts` continuous loop
- `src/modules/state.ts` local mailbox state

## Testing notes

- unit tests live in `tests/unit`
- smoke CLI coverage lives in `tests/e2e`
- artifact/session files stay under `tmp/`
