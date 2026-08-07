# VaxPlan Technical Documentation Index

Welcome to the official technical documentation directory for **VaxPlan**.

## Documentation Guides & Manuals

- [**System User Guide (`USER_GUIDE.md`)**](./USER_GUIDE.md): Comprehensive user manual for microplanning, supportive supervision, scorecards, GIS maps, and data entry workflows.
- [**Indicator Manual (`INDICATOR_MANUAL.md`)**](./INDICATOR_MANUAL.md): Standardized definitions, formulas, and threshold classifications for vaccination coverage and supervision indicators.
- [**Release Notes (`releases.md`)**](./releases.md): Detailed release history detailing major platform updates, bug fixes, and schema migrations.
- [**Country Onboarding Guide (`COUNTRY_ONBOARDING.md`)**](./COUNTRY_ONBOARDING.md): Step-by-step guide for initializing new country tenants, boundary shapefiles, and national facility databases.
- [**Stakeholder Brief (`VAXPLAN_STAKEHOLDER_BRIEF.md`)**](./VAXPLAN_STAKEHOLDER_BRIEF.md): Executive summary for health ministry leadership, WHO/UNICEF partners, and program directors.

## Recent Platform Highlights (v1.9.0 – v1.9.2)

1. **Supportive Supervision Module**:
   - Short 35-question & National 70-question supervision checklists.
   - Traffic Light color coding standard (🔴 0-49.9% Red, 🟠 50-79.9% Amber, 🟢 80-100% Green).
   - Executive Facility Scorecard with Action Plan table (`SupervisionScorecard.tsx`).
   - Comparative Supervision Scorecard Matrix (`ComparativeScorecardTable.tsx`).
2. **Strict Smart Location Cascade Filter**:
   - Province → District → Health Facility strict parent-child locking and options filtering (`GeoCascadeFilter.tsx`).
