# Deployment

## Local development

For normal development, just run Frogward directly:

```bash
npm install
npm run dev -- --service
```

This is the recommended way while building and testing.

## Docker

Build and run with Docker:

```bash
docker build -t frogward .
docker run --rm -it --env-file .env -v "$(pwd)/tmp:/app/tmp" frogward
```

## Docker Compose

Run with compose:

```bash
docker compose up -d --build
```

Stop it:

```bash
docker compose down
```

## Notes

- `tmp/` is mounted so session state and runtime files persist
- `.env` is used for secrets and settings
- the default container command runs `--service`

## Good next deployment steps

- add health checks
- add log rotation / artifact cleanup
- add a backup/restore strategy for `tmp/sapo/runtime-state.json`
- consider a small watchdog or host-level restart alerting
