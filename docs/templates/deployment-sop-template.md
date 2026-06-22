---
title: "Deployment SOP: [Environment Name]"
version: 1.0.0
status: Draft
last_updated: YYYY-MM-DD
audience: System Administrators, Release Managers
---

# Safe Deployment SOP: [Environment Name]

## 1. Environment Details
- **Server:** [e.g., VPS / Hostinger]
- **OS:** [e.g., Ubuntu]
- **Node Version:** [e.g., v22.x]
- **Process Manager:** [e.g., PM2]

## 2. Pre-Deployment Checks
- [ ] Ensure all local changes are committed.
- [ ] Verify `npm run check` and `npm run build` pass locally.
- [ ] Confirm no destructive changes (e.g., table drops) are required.

## 3. Deployment Steps
1. **Connect to Server:** SSH into the target server.
2. **Navigate to App Directory:** `cd /path/to/app`
3. **Stash/Restore any conflicting artifacts (if applicable):** `git restore .` (Caution: Ensure no uncommitted config files are affected)
4. **Pull Latest Code:** `git pull origin main`
5. **Install Dependencies:** `npm install`
6. **Run Safe Migrations:** `npm run db:safe-update` (Never run `db:push` directly in production unless explicitly safe)
7. **Build Application:** `npm run build`
8. **Restart Service:** `pm2 restart [app_name]`

## 4. Post-Deployment Verification
- [ ] Check logs: `pm2 logs [app_name] --lines 50`
- [ ] Verify app is accessible via web browser (or cURL).
- [ ] Confirm specific new features are active.

## 5. Rollback Procedure
- If the deployment fails:
  1. `git checkout [previous_commit_hash]`
  2. `npm install`
  3. `npm run build`
  4. `pm2 restart [app_name]`
