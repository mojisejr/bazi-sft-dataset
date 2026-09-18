#!/usr/bin/env bash
# container-smoke.sh — build the bazi image from THIS revision and prove, on the built image (standalone
# `node server.js`, not `next dev`), what mumate-infra-move-001 slice 1 asks of it:
#
#   1. hygiene    no .env of any spelling inside the image; no credential-shaped string in the layer history;
#                 runs as node; every runtime-file manifest entry is present in the standalone root
#   2. readiness  with a real database, GET /api/health → 200 {db:"ok", runtimeFiles:"ok", sha}
#   3. engine     POST /api/bazi/public-calc computes a chart (pure engine, no DB) — the code path Vercel serves
#   4. webhook    POST /api/webhooks/line with a bad signature → 401 (the LINE route is mounted and validating
#                 under standalone; a real signature needs the channel secret, which never enters this script)
#
# Usage:
#   bash scripts/container-smoke.sh            # all; DB env from $SMOKE_ENV_FILE (see below)
#   bash scripts/container-smoke.sh --no-db    # 1 only (CI without a database)
#
# SMOKE_ENV_FILE  env file for 2-4. Default: the arena's committed local env, ../mootech-fe/testenv/env/bazi.env
#                 (dummy secrets, docker Postgres on :5433). `localhost` → host.docker.internal so the container
#                 reaches the host's Postgres. Never point this at production.
# SMOKE_PORT      host port to publish (default 3101).
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"; cd "$HERE"
SHA="$(git rev-parse HEAD)"; TAG="bazi:smoke-${SHA:0:12}"
NO_DB=0; [ "${1:-}" = "--no-db" ] && NO_DB=1
PORT="${SMOKE_PORT:-3101}"; CNAME="bazi-smoke-$$"
fail() { echo "❌ $*" >&2; exit 1; }
cleanup() { docker rm -f "$CNAME" >/dev/null 2>&1 || true; rm -f "${ENV_TMP:-}"; }
trap cleanup EXIT

echo "── build ${TAG} (APP_GIT_SHA=${SHA:0:12}) ──"
docker build --build-arg "APP_GIT_SHA=${SHA}" \
  --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_dummy -t "$TAG" . | tail -3

echo "── 1. hygiene ──"
envs=$(docker run --rm --entrypoint sh "$TAG" -c 'find /app -maxdepth 2 \( -name ".env" -o -name ".env.*" -o -name "*.testenv-shadowed" \) 2>/dev/null' || true)
[ -z "$envs" ] || fail "env file(s) inside the image: $envs"
if docker history --no-trunc "$TAG" | grep -Eiq 'SECRET=[^$ ]|_KEY=(pk_test_dummy)?[^$ p]|postgres(ql)?://[^ ]*:[^ ]*@'; then
  fail "credential-shaped string in image history"
fi
who=$(docker run --rm --entrypoint id "$TAG" -un); [ "$who" = "node" ] || fail "runs as $who, expected node"
# runtime-file manifest, checked INSIDE the image against the standalone root (the same list /api/health uses)
manifest=$(node -e "
const fs=require('fs');const src=fs.readFileSync('src/lib/runtime-files.ts','utf8');
const m=src.match(/RUNTIME_FILE_MANIFEST = \[([\s\S]*?)\] as const/);
for (const l of m[1].split('\n')) { const s=l.trim().replace(/^\"|\",?$/g,''); if (s && !s.startsWith('//')) console.log(s); }")
missing=$(printf '%s\n' "$manifest" | docker run --rm -i --entrypoint sh "$TAG" -c 'while IFS= read -r p; do [ -e "/app/$p" ] || echo "$p"; done')
[ -z "$missing" ] || fail "runtime files missing in image: $missing"
echo "   ✅ no env files, clean history, runs as node, $(printf '%s\n' "$manifest" | wc -l | tr -d ' ') runtime-file entries present"

if [ "$NO_DB" = 1 ]; then echo "── 2-4 SKIPPED (--no-db) — NOT CHECKED ──"; exit 0; fi

echo "── 2. readiness against a real database ──"
ENV_SRC="${SMOKE_ENV_FILE:-$HERE/../mootech-fe/testenv/env/bazi.env}"
[ -f "$ENV_SRC" ] || fail "SMOKE_ENV_FILE not found: $ENV_SRC"
grep -Eq '^APP_DATABASE_URL=postgres(ql)?://[^@]*@(localhost|127\.0\.0\.1|host\.docker\.internal):' "$ENV_SRC" || fail "refusing: $ENV_SRC APP_DATABASE_URL is not a local host"
ENV_TMP="$(mktemp)"
# The LINE webhook route constructs its messaging client and login URL before it validates the signature (the
# same order production runs), so the three LINE values must exist for the 401 branch to be reachable. Smoke
# placeholders only — no real LINE credential is ever read by this script.
{ grep -v '^#' "$ENV_SRC" | grep . | sed 's/localhost/host.docker.internal/g'
  echo "LINE_CHANNEL_SECRET=smoke-only-not-a-real-secret"
  echo "LINE_CHANNEL_ACCESS_TOKEN=smoke-only-not-a-real-token"
  echo "LINE_LOGIN_URL=http://host.docker.internal:3101/login"; } > "$ENV_TMP"
docker run -d --name "$CNAME" --env-file "$ENV_TMP" -p "${PORT}:3000" "$TAG" >/dev/null
for i in $(seq 1 45); do body=$(curl -fsS "http://127.0.0.1:${PORT}/api/health" 2>/dev/null) && break; sleep 2; done
[ -n "${body:-}" ] || { docker logs "$CNAME" | tail -20; curl -sS "http://127.0.0.1:${PORT}/api/health" || true; fail "/api/health never answered 200 within 90s"; }
echo "$body" | grep -q '"db":"ok"' || fail "db not ok: $body"
echo "$body" | grep -q '"runtimeFiles":"ok"' || fail "runtime files not ok: $body"
echo "$body" | grep -q "\"sha\":\"${SHA}\"" || fail "sha not reported: $body"
echo "   ✅ /api/health → $body"

echo "── 3. engine route (no DB) ──"
calc=$(curl -fsS -X POST "http://127.0.0.1:${PORT}/api/bazi/public-calc" -H 'content-type: application/json' \
  -d '{"birthDate":"1990-05-15","birthTime":"08:30","gender":"male","province":"กรุงเทพมหานคร","calendarSystem":"solar","timezone":"Asia/Bangkok"}')
echo "$calc" | grep -q '"dayMaster"' || fail "public-calc did not compute: $calc"
echo "   ✅ /api/bazi/public-calc → dayMaster $(echo "$calc" | sed -n 's/.*"dayMaster":"\([^"]*\)".*/\1/p')"

echo "── 4. LINE webhook mounted + validating under standalone ──"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "http://127.0.0.1:${PORT}/api/webhooks/line" \
  -H 'content-type: application/json' -H 'x-line-signature: bad' -d '{"events":[]}')
[ "$code" = "401" ] || fail "LINE webhook with a bad signature answered $code, expected 401"
echo "   ✅ /api/webhooks/line bad signature → 401"
echo "✅ smoke passed for ${SHA}"
