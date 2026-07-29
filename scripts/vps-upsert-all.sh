#!/usr/bin/env bash
set -Eeuo pipefail

# Back up first, then merge every record in scratch/localhost_data.json.
# This script never runs DROP, TRUNCATE, DELETE, git reset, or git clean.

APP_DIR="${APP_DIR:-/var/www/vaxplan}"
DATA_FILE="$APP_DIR/scratch/localhost_data.json"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"

cd "$APP_DIR"

[[ -f .env ]] || { echo "ERROR: $APP_DIR/.env is missing." >&2; exit 1; }
[[ -f "$DATA_FILE" ]] || { echo "ERROR: $DATA_FILE is missing." >&2; exit 1; }

DATABASE_URL="$(sed -n 's/^DATABASE_URL=//p' .env | head -n 1 | tr -d '\r')"
[[ -n "$DATABASE_URL" ]] || { echo "ERROR: DATABASE_URL is missing." >&2; exit 1; }
export DATABASE_URL

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="$BACKUP_DIR/pre_upsert_${timestamp}.dump"
log_file="$BACKUP_DIR/upsert_${timestamp}.log"

echo "Creating pre-upsert backup: $backup_file"
PGCONNECT_TIMEOUT=10 pg_dump \
  --dbname="$DATABASE_URL" \
  --format=custom \
  --file="$backup_file"
[[ -s "$backup_file" ]] || { echo "ERROR: Backup is empty. Upsert aborted." >&2; exit 1; }
chmod 600 "$backup_file"

echo "Backup verified. Upserting every bundled record..."
(
  cd "$APP_DIR/scratch"
  npx --prefix "$APP_DIR" tsx "$APP_DIR/scripts/upsert-local-json.ts"
) 2>&1 | tee "$log_file"

if grep -Eq 'Error importing row|Failed to import|Upsert failed' "$log_file"; then
  echo "ERROR: One or more records failed. Review $log_file." >&2
  exit 1
fi

echo "All bundled records were processed successfully."
echo "Backup: $backup_file"
echo "Log: $log_file"
