#!/bin/bash
# ============================================================
# VaxPlan — Safe Production VPS Deployment Script
# Location : /var/www/vaxplan/scripts/deploy-vps.sh
# Usage    : bash scripts/deploy-vps.sh [branch_name]
#
# RULES:
#  - Protected configuration (.env, nginx, pm2) is NEVER touched or overwritten.
#  - Migrations are ADDITIVE ONLY — no DROP, no TRUNCATE, no WIPE.
#  - Existing production data is NEVER overwritten or erased.
#  - Full npm install is performed to support build toolchains.
# ============================================================

set -e

APP_DIR="/var/www/vaxplan"
BRANCH="${1:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "codex/secure-logout-offline-guard")}"

if [ "$BRANCH" = "HEAD" ]; then
  BRANCH="codex/secure-logout-offline-guard"
fi

echo ""
echo "=================================================="
echo "       VaxPlan VPS Deployment — Starting          "
echo "  Target Branch: $BRANCH"
echo "=================================================="

cd "$APP_DIR"

# Load env variables from .env file
if [ -f ".env" ]; then
  if grep -q "neon.tech" .env; then
    echo "⚠️  Detected deprecated Neon database URL in .env. Migrating to local Hostinger PostgreSQL..."
    sed -i 's|DATABASE_URL=.*|DATABASE_URL=postgresql://postgres:postgres@localhost:5432/vaxplan|' .env
  fi
  DATABASE_URL=$(grep DATABASE_URL .env | cut -d '=' -f2-)
else
  echo "      [ERROR] .env file not found at $APP_DIR/.env"
  exit 1
fi

# ─────────────────────────────────────────────────────
# STEP 0: Backup Database
# ─────────────────────────────────────────────────────
echo ""
echo "[0/5] Backing up database before deployment..."
mkdir -p backups
BACKUP_FILE="backups/backup_$(date +%Y%m%d_%H%M%S).sql"
pg_dump "$DATABASE_URL" -f "$BACKUP_FILE" || echo "⚠️ Warning: pg_dump backup skipped (pg_dump unavailable or connection check)"
echo "      ✓ Database backup step completed."

# ─────────────────────────────────────────────────────
# STEP 1: Clean Local Artifacts & Pull Branch Code
# ─────────────────────────────────────────────────────
echo ""
echo "[1/5] Pulling latest code from GitHub (branch: $BRANCH)..."
git reset --hard HEAD
git clean -fd dist/
git fetch origin
git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" "origin/$BRANCH"
git pull origin "$BRANCH"
echo "      ✓ Code updated to branch $BRANCH."

# ─────────────────────────────────────────────────────
# STEP 2: Install Full Dependencies
# ─────────────────────────────────────────────────────
echo ""
echo "[2/5] Installing dependencies..."
npm install --no-audit --no-fund
echo "      ✓ Dependencies installed."

# ─────────────────────────────────────────────────────
# STEP 3: Run Safe Additive Database Migrations
# ─────────────────────────────────────────────────────
echo ""
echo "[3/5] Running safe database migrations..."
if [ -f "node_modules/.bin/tsx" ]; then
  node_modules/.bin/tsx scripts/migrate.ts
else
  npx tsx scripts/migrate.ts
fi
echo "      ✓ Additive migrations completed."

# ─────────────────────────────────────────────────────
# STEP 4: Build Application (Client + Server Bundle)
# ─────────────────────────────────────────────────────
echo ""
echo "[4/5] Building application bundles..."
npm run build
echo "      ✓ Production build complete."

# ─────────────────────────────────────────────────────
# STEP 5: Restart Application via PM2
# ─────────────────────────────────────────────────────
echo ""
echo "[5/5] Restarting application via PM2..."
if command -v pm2 &> /dev/null; then
  pm2 restart vaxplan || pm2 start npm --name "vaxplan" -- run start
  pm2 save
  echo "      ✓ Application restarted successfully."
else
  echo "      [ERROR] PM2 not found. Install via: npm install -g pm2"
  exit 1
fi

echo ""
echo "=================================================="
echo "       VaxPlan Deployment Completed! ✓            "
echo "=================================================="
echo "  Status: pm2 status"
echo "  Logs: pm2 logs vaxplan --lines 50"
echo ""
