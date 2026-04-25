# Best Practices

## For normal users

- prefer Docker Compose for day-to-day use
- run Frogward in `--service` mode
- keep your `.env` private
- keep `tmp/` persistent so session/state survive restarts
- use a destination email you control
- start with a safe test message before trusting unattended forwarding

## For reliability

- use `HEADLESS=true` for unattended running
- keep `POLL_INTERVAL_MS` conservative at first
- watch `tmp/live-artifacts/` if a run fails
- keep an eye on `tmp/sapo/runtime-state.json`

## For deployment

- prefer Docker Compose or another supervised runner for real deployment
- mount `tmp/` as a volume
- make sure restarts do not wipe state/session files
- add your own log rotation / cleanup if the service runs for a long time

## For safety

- verify `DESTINATION_EMAIL` carefully
- set `FORWARDING_ENABLED=false` if you want monitoring without forwarding
- avoid changing live selectors casually once forwarding is working
- treat browser session files and artifacts as sensitive local data
