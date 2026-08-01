#!/bin/bash
# =============================================================================
# VaxPlan - Safe Deploy, Schema Update & Tenant Configuration Upsert
# Run this on the Hostinger VPS to safely update code and tenant configuration.
# Usage: bash /var/www/vaxplan/scripts/vps-setup/deploy-and-upsert.sh
# =============================================================================
set -euo pipefail

APP_DIR="/var/www/vaxplan"
DOCS_DIR="/var/www/doc.vaxplan.org"
HEALTH_PORT="${PORT:-5005}"

echo ""
echo "============================================================"
echo " VaxPlan Safe Deploy & Tenant Configuration Upsert"
echo " Time: $(date '+%Y-%m-%d %H:%M:%S UTC')"
echo "============================================================"
echo ""

cd "$APP_DIR"

if [ -f ".env" ]; then
  echo "Loading environment configuration..."
  if grep -q "neon.tech" .env; then
    echo "ERROR: .env still points to a Neon database URL."
    echo "The deployment SOP forbids this script from rewriting protected config."
    echo "Update DATABASE_URL manually to the intended Hostinger PostgreSQL database, then rerun."
    exit 1
  fi
  DATABASE_URL=$(grep '^DATABASE_URL=' .env | cut -d '=' -f2-)
else
  echo "ERROR: .env file not found at $APP_DIR/.env"
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is missing in .env"
  exit 1
fi

# 0. Database Backup
echo ""
echo "0. Backing up production database..."
mkdir -p backups
BACKUP_FILE="backups/backup_$(date +%Y%m%d_%H%M%S).sql"
pg_dump "$DATABASE_URL" -f "$BACKUP_FILE"
echo "Database backup saved to: $BACKUP_FILE"

# 1. Pull latest code
echo ""
echo "1. Pulling latest from GitHub (main)..."
git fetch origin
git reset --hard origin/main
echo "Code updated to: $(git log --oneline -1)"

# 2. Install dependencies
echo ""
echo "2. Installing dependencies..."
npm install --legacy-peer-deps --no-audit --no-fund
echo "Dependencies installed."

# 3. Database Schema Push (Safe)
echo ""
echo "3. Applying schema updates safely..."
node --env-file=.env scripts/migrate.js
echo "Schema synced."

# 4. Tenant and platform configuration upsert
echo ""
echo "4. Upserting tenant settings and platform configuration..."
npx tsx --env-file=.env scripts/upsert-tenant-configurations.ts

echo "Upserting demo operational records where applicable..."
npx tsx --env-file=.env server/migrations/006-seed-demo-operational.ts

echo "Upserting Zambia demo accounts..."
npx tsx --env-file=.env scripts/seed-zambia-demo-accounts.ts

if [ -f "scripts/seed-ssd-accounts.ts" ]; then
  echo "Upserting South Sudan demo accounts..."
  npx tsx --env-file=.env scripts/seed-ssd-accounts.ts
fi

echo "Configuration upsert complete."

# 5. Build production assets
echo ""
echo "5. Building production assets..."
npm run build
echo "Build complete."

# 6. Upload docs site if present
echo ""
echo "6. Updating documentation site if docs-site exists..."
if [ -d "docs-site" ]; then
  sudo mkdir -p "$DOCS_DIR"
  sudo cp -r docs-site/* "$DOCS_DIR"/
  sudo chown -R www-data:www-data "$DOCS_DIR"
  sudo chmod -R 755 "$DOCS_DIR"
  echo "Documentation site updated."
else
  echo "docs-site directory not found; skipping documentation upload."
fi

# 7. Restart server
echo ""
echo "7. Restarting VaxPlan server under PM2..."
pm2 restart vaxplan --update-env || pm2 start dist/index.cjs --name vaxplan --update-env
sleep 5

# 8. Health check
echo ""
echo "8. Running health check on port $HEALTH_PORT..."
SUCCESS=0
for i in {1..6}; do
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${HEALTH_PORT}/api/public/tenants" 2>/dev/null || echo "000")
  if [ "$HTTP" = "200" ]; then
    echo "Health check: HTTP $HTTP - VaxPlan is live."
    SUCCESS=1
    break
  fi
  echo "      [Attempt $i/6] App not ready yet (HTTP $HTTP). Sleeping 5s..."
  sleep 5
done

if [ "$SUCCESS" -ne 1 ]; then
  echo "ERROR: Health check failed after 30 seconds. PM2 status:"
  pm2 status
  echo "Last 30 lines of pm2 logs:"
  pm2 logs vaxplan --lines 30 --no-daemon &
  PID_LOGS=$!
  sleep 3
  kill $PID_LOGS 2>/dev/null || true
  exit 1
fi

echo ""
echo "============================================================"
echo " Safe deployment and tenant configuration upsert complete."
echo "============================================================"
echo ""
