# Open WebUI Local Dev

This folder keeps the local Open WebUI runtime next to the Bazi project without mixing it into the app source tree.

## Files
- `compose.yaml`: local Docker Compose setup for Open WebUI
- `.env`: local, machine-only runtime values
- `.env.example`: template for the local runtime values
- `data/`: persistent Open WebUI data directory

## Local Runtime Shape
- Open WebUI host URL: `http://localhost:3001`
- Bazi API target: `http://host.docker.internal:3000/api/v1`
- Auth mode for pre-phase verification: single-user (`WEBUI_AUTH=False`)
- Image variant: `ghcr.io/open-webui/open-webui:main-slim` to keep local download size lower during pre-phase setup

## Commands
```bash
cd /Users/non/dev/opilot/projects/bazi/dev/open-webui
cp .env.example .env
docker compose -f compose.yaml up -d
docker compose -f compose.yaml ps
docker compose -f compose.yaml logs --tail 50
docker compose -f compose.yaml down
```

## Why Port 3001?
`next dev` for Bazi uses port `3000` by default, so Open WebUI is mapped to `3001` to avoid collisions while still pointing back to the Bazi API on the host machine.