#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
DATA_DIR="$SCRIPT_DIR/data"
BACKUP_ROOT="$DATA_DIR/auth-state-backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="$BACKUP_ROOT/$TIMESTAMP"
FOUND_STATE=0

mkdir -p "$BACKUP_DIR"

if command -v docker >/dev/null 2>&1; then
  docker compose -f "$SCRIPT_DIR/compose.yaml" stop open-webui >/dev/null 2>&1 || true
fi

for state_file in webui.db webui.db-shm webui.db-wal; do
  source_path="$DATA_DIR/$state_file"
  if [ -e "$source_path" ]; then
    mv "$source_path" "$BACKUP_DIR/$state_file"
    FOUND_STATE=1
  fi
done

if [ "$FOUND_STATE" -eq 0 ]; then
  rmdir "$BACKUP_DIR"
  printf '%s\n' 'No Open WebUI auth state files were found in data/.'
  exit 0
fi

cat <<EOF
Archived Open WebUI auth state to:
  $BACKUP_DIR

Next steps:
  1. docker compose -f compose.yaml up -d
  2. Open http://localhost:${OPEN_WEBUI_HOST_PORT:-3001}
  3. Sign in with the Clerk OIDC button only

Rollback:
  - stop the container
  - move the archived files from $BACKUP_DIR back into data/
EOF