---
title: "Microplan Wizard Walkthrough"
version: 1.9.4
status: Active
last_updated: 2026-09-18
audience: Facility In-Charges, Facility Clerks, District Health Management Teams, National Admins
---

# Microplan Wizard Walkthrough

## 1. Module Purpose & Strategic Alignment
The Microplan Wizard is VaxPlan's core operational engine, operationalizing the WHO/UNICEF **Reaching Every District (RED)** and **Reaching Every Community (REC)** guidelines. It guides health facilities in formulating data-driven, executable immunization plans across four distinct operational cadences.

---

## 2. Supported Operational Cadences
1. **Routine Immunization (`routine`)**: Standard quarterly or annual operational plans for recurring facility and outreach delivery.
2. **Periodic Intensification of Routine Immunization (`periodic_intensification` / PIRI)**: Time-bound catch-up campaigns to reduce zero-dose clusters.
3. **Outbreak Response Immunization (`outbreak_response` / ORI)**: Rapid ring-vaccination and containment campaigns triggered by disease surveillance signals.
4. **Supplemental Immunization Activities (`supplemental` / SIA)**: High-volume mass campaigns (e.g., national measles-rubella campaigns).

---

## 3. 5-Stage Wizard Workflow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ 1. Scope &   │ ──> │ 2. Catchment │ ──> │ 3. Sessions  │ ──> │ 4. Logistics │ ──> │ 5. Readiness │
│    Cadence   │     │ & Population │     │    Strategy  │     │ & Cold Chain │     │  & Submit    │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

### Stage 1: Scope & Cadence Selection
- Select target facility and planning period (e.g., Q1-Q4).
- Choose the operational cadence (`routine`, `periodic_intensification`, `outbreak_response`, `supplemental`).

### Stage 2: Catchment & Demographic Pre-Fill
- Review assigned communities, settlements, and nomadic camps.
- Compare official registry demographics against high-resolution **WorldPop zonal statistics**.
- Automatic pre-fill of target cohorts: Under-1 Infants, Surviving Infants, Pregnant Women, and Women of Childbearing Age (WCBA).

### Stage 3: Session Strategy Formulation
- Formulate the delivery mix: **Fixed-Site**, **Outreach**, and **Mobile** sessions.
- Assign target villages and session frequencies (weekly, bi-weekly, monthly).
- Proximity validator ensures remote settlements (>5km from facility) receive dedicated outreach or mobile visits.

### Stage 4: Logistics & Cold Chain Calculation
- Automated vaccine requirement forecasting factoring in target cohorts and antigen wastage factors.
- AD Syringes, Reconstitution Syringes, Safety Boxes, and Diluent forecasting.
- Cold chain storage capacity verification against facility CCEOP inventory.

### Stage 5: Plan Health, Readiness Audit & Submission
- Comprehensive readiness scoring (0–100%).
- Validates quality gates: zero unserved communities, sufficient session capacity, and approved logistics quotas.
- Role-gated submission: Facility In-Charges submit the completed plan to the District Manager for multi-tier approval.

---

## 4. Permissions & RBAC
- **Facility Clerk**: Draft creation, data entry, temporary draft save.
- **Facility In-Charge**: Plan submission, final review, and sign-off.
- **District Manager**: Review, approval, request changes, or rejection.
- **National Admin**: View-all, template management, and policy oversight.
