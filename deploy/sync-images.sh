#!/usr/bin/env bash
# Pull every distinct ContentImage from the production CDN into public/Content/.
# Skips files that already exist. Runs 16 concurrent downloads.
#
# Requirements: psql, wget, xargs.
# Run from the project root after DB is restored.
set -euo pipefail

DB_NAME="${DB_NAME:-envoraicms_db}"
DB_USER="${DB_USER:-user_envoraicms}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
CDN="${CDN:-https://envoraicms.com}"
TARGET="${TARGET:-$(cd "$(dirname "$0")/.." && pwd)/public}"

mkdir -p "$TARGET/Content"
cd "$TARGET"

echo "Querying distinct ContentImage values ..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  -t -A -c 'SELECT DISTINCT "ContentImage" FROM "Contents" WHERE "ContentImage" IS NOT NULL AND NOT "IsDeleted";' \
  | grep -v '^$' \
  | xargs -P 16 -I{} wget -nc -q -x -nH -P "$TARGET" "${CDN}{}"

echo "Image sync complete. Files in: $TARGET/Content"
