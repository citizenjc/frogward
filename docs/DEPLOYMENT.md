# Deployment

## Recommended deployment: Docker Compose

For most people, this is the easiest and best way to run Frogward.

```bash
docker compose up -d --build
```

Stop it:

```bash
docker compose down
```

This is the preferred way to run Frogward as the real service.

## Local development

For development, just run Frogward directly:

```bash
npm install
npm run dev -- --service
```

This is mainly for development, debugging, or people who do not want Docker.

## Docker

Build and run with Docker:

```bash
docker build -t frogward .
docker run --rm -it --env-file .env -v "$(pwd)/tmp:/app/tmp" frogward
```

## Notes

- `tmp/` is mounted so session state and runtime files persist
- `.env` is used for secrets and settings
- the default container command runs `--service`
- headless mode is the normal default

## Minimal real setup

For a normal deployment, the only values you realistically need to think about first are:

- `SAPO_USERNAME`
- `SAPO_PASSWORD`
- `DESTINATION_EMAIL`
- `POLL_INTERVAL_MS` (optional, defaults to `60000`)

Keep the rest on defaults until you actually need to tune them.

## Good next deployment steps

- add health checks
- add log rotation / artifact cleanup
- add a backup/restore strategy for `tmp/sapo/runtime-state.json`
- consider a small watchdog or host-level restart alerting
