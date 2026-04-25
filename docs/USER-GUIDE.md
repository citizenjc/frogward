# User Guide

## What Frogward does

Frogward watches your SAPO inbox and forwards new messages to another email address.

It uses the SAPO website directly, so it can still work even when normal forwarding or mailbox protocols are unreliable.

## The main way to use it

Run Frogward in service mode:

```bash
npm run dev -- --service
```

That keeps it running, checking for new mail and forwarding matching messages automatically.

This is the normal mode most people should use.

## Before you start

1. Copy `.env.example` to `.env`
2. Fill in your SAPO login and destination email
3. Turn on forwarding in `.env`

Minimum values for a normal first run:

- `SAPO_USERNAME=...`
- `SAPO_PASSWORD=...`
- `DESTINATION_EMAIL=...`

After that, turn on forwarding by setting:

- `FORWARDING_ENABLED=true`

Advanced forwarding and troubleshooting options are covered in the other docs.

## Main command

Run continuously as the service:

```bash
npm run dev -- --service
```

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
