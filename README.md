# 🐸 Frogward

**A little frog that watches your SAPO inbox and hops new emails to another address.**

Frogward is a simple self-hosted forwarding service for people who want their SAPO email to end up somewhere more reliable.

---

## What Frogward does

Frogward:

- logs into SAPO webmail
- checks for new messages
- forwards matching mail automatically
- remembers what already worked
- keeps running as a small always-on service

## The main way to run it

```bash
npm install
npm run dev -- --service
```

That is the normal “real use” command.

## Quick setup

1. Copy `.env.example` to `.env`
2. Fill in your SAPO email, password, and destination email
3. Turn forwarding on in `.env`
4. Start Frogward with `--service`

Minimum `.env` values:

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

Frogward can also be deployed with Docker.

```bash
docker compose up -d --build
```

## Who this is for

Frogward is aimed at:

- home-server users
- self-hosters
- people who just want SAPO mail forwarded automatically

## Current status

Working today:

- live SAPO login and session reuse
- new-mail detection
- one-shot forwarding
- always-on service mode
- real live forwarding already verified

Still worth improving over time:

- deployment polish
- cleanup / health checks
- extra resilience against SAPO UI drift
- broader mailbox coverage

## Documentation

Start here:

- [User Guide](docs/USER-GUIDE.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Best Practices](docs/BEST-PRACTICES.md)
- [Features](docs/FEATURES.md)
- [Docs Index](docs/README.md)

Developer / advanced docs:

- [Development](docs/DEVELOPMENT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [SAPO selector notes](docs/sapo-selector-notes.md)

## Important note

Frogward is now a working always-on app mode, but it only runs when **you start it**.

For example:

- local/dev use: `npm run dev -- --service`
- deployment use: docker / compose / another process runner
