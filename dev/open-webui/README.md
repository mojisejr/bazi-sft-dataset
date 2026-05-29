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
- Auth mode for Phase 4A recovery: Clerk OIDC (`WEBUI_AUTH=True`)
- User identity forwarding to Bazi: enabled through `ENABLE_FORWARD_USER_INFO_HEADERS=True`
- Image variant: `ghcr.io/open-webui/open-webui:main-slim` to keep local download size lower during pre-phase setup

## Auth Recovery Path
If Open WebUI keeps reusing a stale local admin session instead of creating a Clerk-backed user, archive the persisted auth state before logging in again:

```bash
cd /Users/non/dev/opilot/projects/bazi/dev/open-webui
./reset-auth-state.sh
docker compose -f compose.yaml up -d
```

What the helper does:
- stops the `open-webui` container if Docker is available
- moves `data/webui.db`, `data/webui.db-shm`, and `data/webui.db-wal` into `data/auth-state-backups/<timestamp>/`
- leaves the archived files available for manual rollback

Recovery checklist:
1. Run `./reset-auth-state.sh`.
2. Start the runtime again with `docker compose -f compose.yaml up -d`.
3. Open `http://localhost:3001`.
4. Sign in with the Clerk OIDC button only.
5. Re-check the persisted state in `data/` before treating browser auth as truthful.
6. If you recreated the container, expect Open WebUI browser cookies to be invalidated and sign in again.

## Browser Truth Contract
- Open WebUI's OpenAI-compatible request body may still omit `user.id`; Bazi should read `X-OpenWebUI-User-Id` when `ENABLE_FORWARD_USER_INFO_HEADERS=True` is enabled.
- The final browser-proof loop for this local setup is:
	1. Clerk-backed login succeeds in Open WebUI.
	2. Open WebUI keeps `oauth_session` and user rows in `data/webui.db`.
	3. Browser chat reaches Bazi without upstream `401`.
	4. Bazi log shows a non-null user id from the forwarded Open WebUI header.

This slice makes the local reset path explicit. Browser truth for the recovered login still needs to be closed separately.

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