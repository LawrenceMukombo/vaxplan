---
title: "Microplan Wizard Walkthrough"
version: 1.0.0
status: Final
last_updated: 2026-06-21
audience: Facility Users, District Managers
---

# Microplan Wizard Walkthrough

## 1. Module Purpose
The step-by-step workflow for a facility to build, review, and submit their quarterly immunization action plan.

## 2. Who Uses It
- **Facility Users:** Complete the wizard and save drafts.
- **Facility In-Charges:** Submit the final draft for approval.
- **District Managers:** Review the output (read-only mode).

## 3. Main Screens and Navigation
- **Wizard Stepper:** A horizontal progress bar tracking completion (Scope -> Catchment -> Population -> Forecasting -> Sessions -> Logistics -> Submit).

## 4. Key Actions
### 4.1. Selecting the Denominator
1. In the "Population" step, compare the **Official Registry** vs. **GIS Calculated** population.
2. Select the most accurate figure using the radio buttons.
3. This figure dictates the rest of the wizard's vaccine forecasts.

### 4.2. Planning Sessions
1. In the "Sessions" step, allocate the number of fixed and outreach sessions for each assigned village.
2. The system warns if the total planned capacity doesn't meet the target population.

## 5. Permissions and RBAC
- Only an In-Charge can click "Submit to District". Clerks can only click "Save Draft".

## 6. Troubleshooting
> **Baby steps:** If you can't progress to the next step, look for a red validation error message on the screen (e.g., "Must plan at least one session for HTR village").

## 7. Related Modules
- [Sessions Walkthrough](./sessions-walkthrough.md)
