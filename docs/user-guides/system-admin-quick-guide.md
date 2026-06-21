---
title: "System Admin Quick Guide"
version: 1.0.0
status: Final
last_updated: 2026-06-21
audience: System Administrators, Super Admins, DevOps
---

# System Admin Quick Guide

## 1. Role Purpose
You maintain the VaxPlan server infrastructure, deploy updates safely, and onboard new Ministries of Health (Tenants).

## 2. Daily Tasks
- Monitor VPS server health (PM2, Nginx).
- Execute safe database migrations for new features.
- Troubleshoot cross-tenant data isolation.

## 3. Key Modules Used
- **Country Onboarding:** To create new tenants.
- **Server CLI:** For running deployment scripts.

## 4. Step-by-step Workflow: Safe Deployment
1. SSH into the production server.
2. `git pull origin main`
3. `npm run db:safe-update` (Never use raw push).
4. `npm run build`
5. `pm2 restart vaxplan`

## 5. Common Mistakes
> [!CAUTION]
> **Data safety:** VaxPlan follows a strictly NO WIPE, NO OVERWRITE, UPSERT-ONLY approach. Never run destructive database resets in production.

## 6. Troubleshooting Tips
> **Baby steps:** If the app is down after an update, check PM2 logs (`pm2 logs vaxplan --lines 50`) for the exact crash reason.

## 7. Escalation Path
N/A. You are the final escalation point for technical failures.
