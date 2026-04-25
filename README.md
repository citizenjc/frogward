# Frogward

Forward new SAPO emails to another inbox automatically.

## What this is

Frogward is a small self-hosted tool that signs into SAPO webmail, watches for new messages, and forwards them to another email address.

This project exists for people who want:

- automatic forwarding from SAPO
- a simple setup on a home server or local machine
- something that can run continuously

## Quick start

1. Copy `.env.example` to `.env`
2. Fill in your SAPO username, password, and destination email
3. Enable forwarding in `.env`
4. Start the service:

```bash
npm install
npm run dev -- --service
```

## Main command

Run Frogward continuously:

```bash
npm run dev -- --service
```

That is the mode that makes it act like the real service.

## Before using service mode

Useful dry-run commands:

```bash
npm run dev -- --check
npm run dev -- --probe
```

Use those first if you want to confirm login and inbox access without forwarding anything.

## Required `.env` values

At minimum:

```env
APP_MODE=live
SAPO_USERNAME=your-sapo-email
SAPO_PASSWORD=your-password
DESTINATION_EMAIL=your-other-email@example.com
FORWARDING_ENABLED=true
FORWARDING_ACK=true
FORWARDING_WARP_TOKEN=approved-local-run
```

## Docker / Compose

For deployment, Docker is now available.

Run with compose:

```bash
docker compose up -d --build
```

## Docs

- [User Guide](docs/USER-GUIDE.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Features](docs/FEATURES.md)
- [Development](docs/DEVELOPMENT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [SAPO selector notes](docs/sapo-selector-notes.md)

## Current status

Working now:

- live SAPO login/session reuse
- inbox parsing and new-mail detection
- one-shot forwarding
- always-on service mode
- live forwarding verified

Still worth improving over time:

- deployment polish
- health checks / cleanup
- UI-drift resilience
- broader mailbox coverage
