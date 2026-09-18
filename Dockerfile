# syntax=docker/dockerfile:1.7
# bazi engine (bazi-sft-dataset) — the Next 16 app Vercel serves today, as a reproducible standalone image
# (mumate-infra-move-001 slice 1).
#
#   • Base pinned by digest to node:22 (engines.node = 22.x), Debian slim (glibc, like Vercel's runtime) so
#     sharp / @next/swc load the same flavour of native binary production uses.
#   • `next build` runs with NEXT_OUTPUT_STANDALONE=1 (next.config.ts) — the Vercel build is untouched.
#   • RUNTIME DATA: the engine reads knowledge files from disk relative to process.cwd() (src/lib/runtime-files.ts
#     is the manifest). Vercel traces them per function; here they are copied explicitly into the standalone
#     root, and /api/health reports the manifest so a missing copy is a 503, not a silent wrong reading.
#   • No env file is ever COPYed (.dockerignore). Build arguments are the public Clerk/LIFF values Next inlines
#     into the client bundle (NEXT_PUBLIC_*, not secrets) and APP_GIT_SHA. Everything else is runtime env.
#
# Build:  docker build --build-arg APP_GIT_SHA=$(git rev-parse HEAD) -t bazi:local .
# Smoke:  bash scripts/container-smoke.sh   (builds, hygiene, /api/health db+files, engine route, LINE webhook)

ARG BASE=node:22.23.2-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5

# ── deps ──────────────────────────────────────────────────────────────────────────────────────────────────────
FROM ${BASE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ── builder ───────────────────────────────────────────────────────────────────────────────────────────────────
FROM ${BASE} AS builder
WORKDIR /app
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
ARG NEXT_PUBLIC_LIFF_ID=
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_OUTPUT_STANDALONE=1 \
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY} \
    NEXT_PUBLIC_LIFF_ID=${NEXT_PUBLIC_LIFF_ID}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
# Runtime data the server reads via process.cwd() — one tree, mirrored from src/lib/runtime-files.ts.
RUN set -eu; mkdir -p /runtime-data/knownlage /runtime-data/src/lib/louise-hay \
 && cp -R src/lib/bazi /runtime-data/src/lib/bazi \
 && cp -R src/lib/louise-hay/data /runtime-data/src/lib/louise-hay/data \
 && cp -R knownlage/extracted knownlage/distilled /runtime-data/knownlage/ \
 && find knownlage -maxdepth 1 -type f -name '*.txt' -exec cp {} /runtime-data/knownlage/ \; \
 && find /runtime-data -type f \( -name '*.ts' -o -name '*.tsx' \) -delete

# ── runner ────────────────────────────────────────────────────────────────────────────────────────────────────
FROM ${BASE} AS runner
ARG APP_GIT_SHA=unknown
# APP_RUNTIME=container turns on the runtime-file manifest check in /api/health (it is "not-checked" on Vercel).
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    APP_GIT_SHA=${APP_GIT_SHA} \
    APP_RUNTIME=container \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /runtime-data/ ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
