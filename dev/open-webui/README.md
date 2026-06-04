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
- Auth mode for the canonical post-Phase-3 baseline: Clerk OIDC (`WEBUI_AUTH=True`)
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
- The accepted post-Phase-3 runtime proof for this local setup is:
	1. Clerk-backed login succeeds in Open WebUI.
	2. Open WebUI keeps `oauth_session` and user rows in `data/webui.db`.
	3. Browser chat reaches Bazi without upstream `401`.
	4. Bazi log shows a non-null user id from the forwarded Open WebUI header.
	5. Same-thread refresh/resume keeps prior turns available without asking for birth data again.
	6. Finalized reply content remains present after reload.
	7. A fresh thread stays isolated from earlier prompts and replies.

This slice is now a canonical local runtime baseline, not an open recovery tracker. Older BT-10, `browser-truth-open`, and similar blocked-login or blocked-persistence narratives are historical-only and should not be treated as the current Open WebUI status without new failing evidence.

## Harness Ownership Boundary

Operator-owned steps:
1. Bring the Open WebUI shell to a ready-to-chat state.
2. Complete Clerk/OIDC login or consent walls.
3. Confirm the intended Bazi-backed model is selected in the Open WebUI shell.

AI-owned steps:
1. Run `npm run gate:open-webui` inside `/Users/non/dev/opilot/projects/bazi`.
2. Run `npm run test:open-webui-regression` before escalating a failure to browser truth.
3. Read the structured Open WebUI operational events emitted by Bazi to classify forwarding, persistence, continuity, and skip-reason failures.

Named waiting states:
- `Awaiting Operator Auth`
- `Awaiting OpenWebUI Session Ready`
- `Browser Truth Pending`

If the deterministic gate and regression pack pass, backend release confidence stays green unless a runtime-only symptom survives. In that case, treat the issue as Open WebUI shell debt first and classify it with [shell-debt.md](./shell-debt.md) before reopening backend correctness work.

## Runtime Smoke Flow

Use this minimal smoke flow only when deterministic evidence leaves a runtime-only uncertainty:

1. Confirm the Open WebUI shell is pointed at `http://host.docker.internal:3000/api/v1` and the intended Bazi-backed model is visible.
2. Complete operator-owned auth until the shell is ready to chat.
3. Run one same-thread continuity check: ask a Bazi question, refresh, then verify prior turns and finalized reply text remain visible.
4. Run one fresh-thread isolation check: open a new thread and verify it does not inherit the earlier conversation.
5. Save any local runtime evidence under `/Users/non/dev/opilot/projects/bazi/.playwright-mcp/` only.

Do not treat shell-auth redirects, stale browser cookies, or Open WebUI session reuse as backend failures by default. Those belong to the shell-debt lane unless the deterministic gate or structured operational events disagree.

## Commands
```bash
cd /Users/non/dev/opilot/projects/bazi/dev/open-webui
cp .env.example .env
docker compose -f compose.yaml up -d
docker compose -f compose.yaml ps
docker compose -f compose.yaml logs --tail 50
docker compose -f compose.yaml down
```

## Shell-Only Failure Tracker

See [shell-debt.md](./shell-debt.md) for:
- known shell-only failure classes
- backend-vs-shell classification rules
- operator/AI handoff checkpoints
- local artifact sink rules

## Why Port 3001?
`next dev` for Bazi uses port `3000` by default, so Open WebUI is mapped to `3001` to avoid collisions while still pointing back to the Bazi API on the host machine.