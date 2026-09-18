---
title: "Sessions Walkthrough"
version: 1.9.4
status: Active
last_updated: 2026-09-18
audience: Facility Clerks, Facility In-Charges, Field Teams, District Managers
---

# Sessions Walkthrough

## 1. Module Purpose
The Sessions module coordinates the scheduling, geographic routing, field execution, and closeout reconciliation of all planned immunization delivery sessions (Fixed, Outreach, and Mobile).

---

## 2. Key Capabilities & Workflows

### 2.1 Scheduling & 5km Proximity Conflict Validator
- **Spatial Clash Detection**: When creating or rescheduling an outreach session, the system automatically checks for conflicting sessions within a 5 km radius on the same date (`/api/sessions/validate-proximity`).
- **Conflict Warning**: Prevents duplicate deployments and ensures health teams do not compete for the same community attendance.

### 2.2 Multi-Day Field Logistics & Day Plans
- Configure multi-day itineraries for remote mobile teams (e.g., riverine or island communities).
- Assign vaccinators, community health workers, transport modes (4WD, motorbike, boat, foot), and cold chain carriers.

### 2.3 Real-Time Vaccination Logging & Client Registry
- In the field, clerks record child attendance in the electronic logbook or capture aggregate tally tallies by antigen dose.
- Real-time dose deduction from the facility's local stock ledger.

### 2.4 Session Closeout & Daily Summary Sheets
- Record vials opened, doses administered, doses wasted, and unopened vials returned to the cold chain.
- Generate and export standard Daily Summary Sheets for official record-keeping.

---

## 3. Permissions & Scoping
- **Facility Clerks & In-Charges**: Manage and record sessions strictly within their assigned health facility.
- **District Managers**: Read-only oversight of all district sessions, status monitoring (planned, conducted, overdue, cancelled), and spatial conflict auditing.
