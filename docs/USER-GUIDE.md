# User Guide

## What Frogward does

Frogward watches your SAPO inbox and forwards new messages to another email address.

It uses the SAPO website directly, so it can still work even when normal forwarding or mailbox protocols are unreliable.

## The main way to use it

For most people, the easiest way is Docker Compose:

```bash
docker compose up -d --build
```

That runs Frogward continuously as the service.

## Local run (without Docker)

If you prefer to run it directly:

```bash
npm run dev -- --service
```

That also keeps it running, checking for new mail and forwarding matching messages automatically.

## Before you start

1. Copy `.env.example` to `.env`
2. Fill in your SAPO login and destination email
3. Optional: change `POLL_INTERVAL_MS` if you want a different check frequency

Minimum values for a normal first run:

- `SAPO_EMAIL=...`
- `SAPO_PASSWORD=...`
- `DESTINATION_EMAIL=...`
- `POLL_INTERVAL_MS=60000`

`POLL_INTERVAL_MS=60000` means Frogward checks every 60 seconds.

Advanced forwarding and troubleshooting options are covered in the other docs.

If you want developer or troubleshooting commands, see the [Development](./DEVELOPMENT.md) guide.

## What happens when it runs

Frogward will:

1. log into SAPO
2. open your inbox
3. detect messages it has not seen before
4. apply allow/block filters
5. forward matching messages
6. remember what succeeded, failed, or was filtered

## Where local data is stored

- state: `tmp/sapo/runtime-state.json`
- browser session: `tmp/sapo/session.auth.json`
- failure artifacts: `tmp/live-artifacts/`

These files are local-only and should stay private.

## If something goes wrong

Check:

- logs in the terminal
- `tmp/live-artifacts/`
- `tmp/sapo/runtime-state.json`

If needed, stop Frogward and clear local runtime files:

```bash
rm -rf tmp/live-artifacts tmp/sapo
```
