---
title: "National Admin Quick Guide"
version: 1.0.0
status: Final
last_updated: 2026-06-21
audience: National Administrators
---

# National Admin Quick Guide

## 1. Role Purpose
You manage the country (Tenant) configuration. You control who has access to the system, define the vaccine schedule, and manage the official facility and village registries.

## 2. Daily Tasks
- Invite new users and assign roles.
- Monitor national dashboards for systemic issues (e.g., nationwide stockouts).
- Review audit logs for unauthorized data modifications.

## 3. Key Modules Used
- **Users & Staff:** To provision accounts.
- **Settings:** To configure labels, antigens, and boundaries.
- **Audit Log:** For security compliance.
- **HIS Integrations:** To configure and validate the country DHIS2 aggregate connection.

### Configure DHIS2

1. Navigate to **Administration → HIS Integrations**.
2. Add a DHIS2 connection with the country URL, secret reference, root organisation unit, immunization data set, facility level, and authentication scheme.
3. Save the connection and select **Test** from its card.
4. Confirm facility organisation-unit mappings before previewing coverage or population imports.
5. Run bidirectional synchronization only after the country DHIS2 team approves the indicator mappings.

See [DHIS2 country integration](../DHIS2_INTEGRATION.md) for deployment variables, validation, and troubleshooting.

## 4. Step-by-step Workflow: Adding a New User
1. Navigate to **Administration -> Users & Staff**.
2. Click **Invite User**.
3. Enter their email, facility (if applicable), and assign a role.
4. Click **Send Invite**.

## 5. Common Mistakes
> [!WARNING]
> Be extremely careful when editing the Vaccine Schedule. Removing an active antigen will break existing microplans that rely on it.

## 6. Troubleshooting Tips
> **Baby steps:** If a user can't log in, try manually resetting their password from the Users table.

## 7. Escalation Path
For systemic outages or to request a new Tenant setup, contact the **Platform Super Admin**.
