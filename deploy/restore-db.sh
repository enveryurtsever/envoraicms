#!/usr/bin/env bash
# Restore a pg_dump into the new DB and create indexes.
# Usage: DUMP=/tmp/dump ./restore-db.sh
set -euo pipefail

DUMP="${DUMP:-/tmp/dump}"
DB_NAME="${DB_NAME:-envoraicms_db}"
DB_USER="${DB_USER:-user_envoraicms}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"

if [[ ! -f "$DUMP" ]]; then
  echo "Dump file not found: $DUMP" >&2
  exit 1
fi

echo "Restoring $DUMP into $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME ..."
pg_restore \
  -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  --no-owner --no-privileges --disable-triggers \
  -j 4 \
  "$DUMP"

echo "Creating indexes ..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  -v ON_ERROR_STOP=1 \
  -f "$(dirname "$0")/indexes.sql"

echo "Restore + index complete."
