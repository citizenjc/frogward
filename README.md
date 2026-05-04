# 🐸 Frogward

**A little frog that watches your SAPO inbox and hops new emails to another address.**

Frogward is a simple self-hosted forwarding service for people who want their SAPO email to end up somewhere more reliable.

> [!IMPORTANT]  
> This project is mostly vibe coded. Manual inspection and refinement was done for security, but I still advise you to run this on an isolated environment.

---

## What Frogward does

Frogward:

- logs into SAPO webmail
- checks for new messages
- forwards matching mail automatically
- remembers what already worked
- keeps running as a small always-on service

## Install and run with Docker Compose

This is the recommended setup for most people.

1. Copy `.env.example` to `.env`
2. Fill in your SAPO email, password, and destination email
3. Optional: change `POLL_INTERVAL_MS` if you want slower or faster checks
4. Start Frogward:

```bash
docker compose up -d --build
```

Stop it:

```bash
docker compose down
```

## Minimum setup values

These are the only values most people need to care about at first:

```env
SAPO_EMAIL=your-sapo-email
SAPO_PASSWORD=your-password
DESTINATION_EMAIL=your-other-email@example.com
POLL_INTERVAL_MS=60000
CAPTURE_TRACE_ON_FAILURE=false
```

`POLL_INTERVAL_MS=60000` means Frogward checks every 60 seconds. Lower is faster but noisier/heavier; higher is quieter/lighter.

`CAPTURE_TRACE_ON_FAILURE=false` keeps Playwright trace capture off by default. Only turn it on temporarily for troubleshooting.

Everything else can stay on the defaults when you are starting out.

## Run it locally without Docker

Useful for development or if you do not want Docker.

```bash
npm install
npm run dev -- --service
```

## What it needs to run

Frogward only works while the service is running.

That means one of these needs to be active:

- `docker compose up -d`
- `npm run dev -- --service`
- another process runner you choose

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

Frogward is a real always-on service mode now, but it still needs to be started by you (or by Docker / another runner).
