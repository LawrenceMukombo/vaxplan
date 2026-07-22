---
title: "VaxPlan Production Deployment Standard Operating Procedure (SOP)"
version: 1.5.0
status: Approved
last_updated: 2026-07-22
audience: System Administrators, Release Managers, DevOps Engineers
---

# VaxPlan Production Deployment Standard Operating Procedure (SOP)

This Standard Operating Procedure (SOP) defines the non-destructive deployment protocol for VaxPlan across production, staging, and VPS hosting environments (e.g. Hostinger, Cloud VPS, Ubuntu Linux).

---

## 1. NON-NEGOTIABLE DEPLOYMENT RULES

> [!CAUTION]
> **PROTECTED CONFIGURATIONS & ZERO DATA LOSS RULES**
> 1. **NO CONFIGURATION CHANGES**: Never modify, overwrite, or commit `.env`, `nginx.conf`, PM2 ecosystem files, systemd services, SSL certificates, or deployment credentials.
> 2. **NO DATA WIPE / RESET**: Never run `DROP TABLE`, `TRUNCATE`, database resets, or destructive seed scripts against production databases.
> 3. **UPSERT ONLY**: All database migrations and data syncing must be purely additive (`ADD COLUMN IF NOT EXISTS`, `INSERT ... ON CONFLICT DO UPDATE`).
> 4. **FULL DEPENDENCY INSTALLATION**: Always run `npm install` (do **NOT** use `--omit=dev` during build steps) to ensure Vite and ESBuild compilation toolchains remain available on the server.

---

## 2. PRE-DEPLOYMENT CHECKLIST

Before deploying any release:
- [ ] Confirm code changes pass local type checks (`npm run check`) and builds (`npm run build`).
- [ ] Ensure all code and build outputs are committed to the designated feature branch or `main`.
- [ ] Verify that `.env` files are excluded from Git.

---

## 3. AUTOMATED DEPLOYMENT PROTOCOL (RECOMMENDED)

The repository includes an automated, self-healing deployment script that handles build artifact cleanup, branch syncing, additive database migrations, and PM2 process recycling.

Execute the following on the VPS server:

```bash
cd /var/www/vaxplan
bash scripts/deploy-vps.sh
```

---

## 4. MANUAL DEPLOYMENT STEP-BY-STEP PROCEDURE

If executing deployment steps manually, follow this exact sequence:

### Step 1: Clean Local Build Artifacts & Sync Repository
Prevent Git pull conflicts caused by modified `dist/` build files on the server:

```bash
cd /var/www/vaxplan

# Clean uncommitted build artifacts blocking branch checkout/pull
git reset --hard HEAD
git clean -fd dist/

# Fetch and checkout target release branch
git fetch origin
git checkout codex/secure-logout-offline-guard  # Or main
git pull origin codex/secure-logout-offline-guard
```

### Step 2: Install Full Dependencies
Ensure all runtime and build-time dependencies (e.g. `vite`, `@vitejs/plugin-react`) are available:

```bash
npm install
```

### Step 3: Run Additive Database Migrations
Safely apply database migrations without altering or erasing existing data:

```bash
# Runs versioned SQL migrations and safe column additions
npm run db:migrate
```

### Step 4: Optional Idempotent Local-to-Production Data Upsert
If merging local operational data (microplans, CHV profiles, staff, roles, permissions) into production without overwriting existing VPS records:

```bash
npx tsx --env-file=.env scripts/upsert-local-json.ts
```

### Step 5: Build Production Bundle
Bundle frontend assets (Vite PWA) and backend server (ESBuild):

```bash
npm run build
```

### Step 6: Restart & Monitor Application Process
Recycle PM2 application workers safely:

```bash
pm2 restart vaxplan
pm2 save
pm2 status
pm2 logs vaxplan --lines 50
```

---

## 5. TROUBLESHOOTING & EMERGENCY RECOVERY

| Symptom | Cause | Resolution |
| :--- | :--- | :--- |
| `Cannot find package '@vitejs/plugin-react'` | `npm install --omit=dev` was run | Run `npm install` without `--omit=dev`, then re-run `npm run build`. |
| `Your local changes to dist/... would be overwritten` | Build files modified on VPS | Run `git reset --hard HEAD` and `git clean -fd dist/` before `git pull`. |
| `column "..." does not exist` | Database schema missing new column | Run `npm run db:migrate` to execute additive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. |
| `Key (...) already exists` during data upsert | Unique constraint collision | Ensure `scripts/upsert-local-json.ts` is pulled (includes `ON CONFLICT` / code lookup handling). |

---

## 6. AUDIT & REPORTING

After every deployment, document:
- Release branch and commit hash (`git log -n 1`).
- PM2 process uptime and log status (`pm2 status`).
- Confirmation that no `.env` files or database tables were destroyed.
