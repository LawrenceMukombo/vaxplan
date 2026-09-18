---
title: "Recommendations Walkthrough"
version: 1.9.4
status: Active
last_updated: 2026-09-18
audience: District Managers, Provincial Coordinators, Facility In-Charges, National Planners
---

# Recommendations Walkthrough

## 1. Module Purpose
The VaxPlan Geospatial Intelligence Engine (VGIE) provides intelligent operational recommendations to eliminate zero-dose clusters, resolve geographic coverage gaps, and optimize field resource allocation.

---

## 2. Dual Recommendation Channels

### 2.1 Rule-Based Catchment Analysis
- Evaluates spatial distance, catchment assignment, and historical session frequency:
  - *High-Priority*: Unassigned settlements or hard-to-reach clusters with estimated unserved populations.
  - *Medium-Priority*: Settlements >5km from a facility with high dropout rates.
  - *Low-Priority*: Minor schedule rebalancing to improve seasonal outreach access.

### 2.2 Generative AI Decision Support (`/api/ai/recommendations/generate`)
- Analyzes multi-dimensional national and district metrics (demographics, vaccine stock, historical outbreaks, supervision scores) to generate contextual operational strategies.

---

## 3. Workflow & Lifecycle
1. **Inbox Review**: View prioritized recommendation cards with evidence rationale.
2. **Actioning**: Convert recommendations into actionable items in the **Planning Actions** register (`/planning-actions`) with assigned owners and due dates.
3. **Status Tracking**: Transition status from `pending` → `actioned` or `dismissed`.
