#!/usr/bin/env bash
set -Eeuo pipefail

# Backup first, then upsert every record from the complete local DB snapshot.
# No DROP, TRUNCATE, DELETE, reset, restore, or clean operation is performed.

APP_DIR="${APP_DIR:-/var/www/vaxplan}"
SNAPSHOT="$APP_DIR/scratch/local_database_all.jsonl.gz"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"

cd "$APP_DIR"
[[ -f .env ]] || { echo "ERROR: $APP_DIR/.env is missing." >&2; exit 1; }
[[ -s "$SNAPSHOT" ]] || { echo "ERROR: Complete snapshot is missing or empty." >&2; exit 1; }
[[ -d node_modules ]] || { echo "ERROR: Run npm install first." >&2; exit 1; }

DATABASE_URL="$(sed -n 's/^DATABASE_URL=//p' .env | head -n 1 | tr -d '\r')"
[[ -n "$DATABASE_URL" ]] || { echo "ERROR: DATABASE_URL is missing." >&2; exit 1; }
export DATABASE_URL

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="$BACKUP_DIR/pre_full_upsert_${timestamp}.dump"
log_file="$BACKUP_DIR/full_upsert_${timestamp}.log"

echo "Creating production backup: $backup_file"
PGCONNECT_TIMEOUT=10 pg_dump \
  --dbname="$DATABASE_URL" \
  --format=custom \
  --file="$backup_file"
[[ -s "$backup_file" ]] || { echo "ERROR: Backup is empty. Upsert aborted." >&2; exit 1; }
chmod 600 "$backup_file"

echo "Backup verified. Upserting the complete 104-table local snapshot..."
npx tsx scripts/upsert-entire-database.ts "$SNAPSHOT" 2>&1 | tee "$log_file"

grep -q "Successfully upserted every one of 182069 records." "$log_file" || {
  echo "ERROR: Full-record completion marker was not found. Review $log_file." >&2
  exit 1
}

echo "Complete database upsert succeeded."
echo "Backup: $backup_file"
echo "Log: $log_file"
