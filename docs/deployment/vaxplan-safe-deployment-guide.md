---
title: "Safe Deployment Guide"
version: 1.0.0
status: Final
last_updated: 2026-06-21
audience: System Administrators, Release Managers
---

# Safe Deployment Guide

## 1. Principles of Data Safety
VaxPlan adheres strictly to non-destructive deployment practices.
- **No Wipe:** Production data is never erased.
- **No Overwrite:** Existing fields (like Official Population) are not overwritten by automated migrations.
- **Upsert Only:** Database migrations must only ADD tables or ADD columns.

## 2. Server Infrastructure
VaxPlan is typically deployed to a VPS (e.g., Hostinger) running Ubuntu, Nginx, Node.js, and PM2.

## 3. Safe Migration Protocol
Never run `npx drizzle-kit push` directly in a production environment as it may trigger destructive warnings or drop data.

Instead, always use the custom safe script:
```bash
npm run db:safe-update
```
This script reads `.env` manually (as `dotenv` may not be present globally), loads the Drizzle config, and executes `drizzle-kit push --force` ONLY IF the changes are purely additive.

## 4. Deployment Steps
```bash
# 1. Connect to VPS
ssh user@vps_ip

# 2. Navigate to project
cd /var/www/vaxplan

# 3. Pull latest code
git pull origin main

# 4. Install dependencies
npm install

# 5. Run safe schema updates
npm run db:safe-update

# 6. Build the application
npm run build

# 7. Restart PM2 process
pm2 restart vaxplan

# 8. Check logs to verify health
pm2 logs vaxplan --lines 50
```

## 5. Handling Build Artifacts
If `dist/` artifacts cause merge conflicts during `git pull`, run `git restore .` to discard local uncommitted changes. 

> [!WARNING]
> Do not modify the `.env` or Nginx configuration files unless explicitly required and approved by the infrastructure lead.
