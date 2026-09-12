# VaxPlan Technical Documentation Index

Welcome to the official technical documentation directory for **VaxPlan**.

## Documentation Guides & Manuals

- [**Executive Stakeholder Master Brief & Fast-Track Country Adaptation Blueprint (`VAXPLAN_EXECUTIVE_STAKEHOLDER_MASTER_BRIEF.md`)**](./VAXPLAN_EXECUTIVE_STAKEHOLDER_MASTER_BRIEF.md): Enterprise premium-grade prospectus for Ministers of Health, Permanent Secretaries, Gavi / WHO / UNICEF leaders, and National EPI Managers detailing what VaxPlan does, end-to-end capabilities, and the 30-day fast-track national adaptation roadmap. *(Word document available at [`VAXPLAN_EXECUTIVE_STAKEHOLDER_MASTER_BRIEF.docx`](./VAXPLAN_EXECUTIVE_STAKEHOLDER_MASTER_BRIEF.docx))*.
- [**Stakeholder & Sponsor Pitch Deck (`VAXPLAN_STAKEHOLDER_SLIDE_DECK.md`)**](./VAXPLAN_STAKEHOLDER_SLIDE_DECK.md): 14-slide executive widescreen presentation with visual designs, structured layouts, and complete presenter speaker notes. *(PowerPoint file available at [`VAXPLAN_STAKEHOLDER_SLIDE_DECK.pptx`](./VAXPLAN_STAKEHOLDER_SLIDE_DECK.pptx))*.
- [**Business Case & Stakeholder Investment Prospectus (`VAXPLAN_BUSINESS_CASE_AND_STAKEHOLDER_PROSPECTUS.md`)**](./VAXPLAN_BUSINESS_CASE_AND_STAKEHOLDER_PROSPECTUS.md): Comprehensive investment prospectus, ROI modeling, and value proposition for Ministries of Health, Gavi, WHO, UNICEF, and donors. *(Word document available at [`VAXPLAN_BUSINESS_CASE_AND_STAKEHOLDER_PROSPECTUS.docx`](./VAXPLAN_BUSINESS_CASE_AND_STAKEHOLDER_PROSPECTUS.docx))*.
- [**Organizational Terms of Reference (ToR) & Operational Manual (`VAXPLAN_ORGANIZATIONAL_TOR_AND_OPERATING_MANUAL.md`)**](./VAXPLAN_ORGANIZATIONAL_TOR_AND_OPERATING_MANUAL.md): Full governance charters, ToRs for Founder, Co-Founders, Consultants, and Employees, and standard operating procedures. *(Word document available at [`VAXPLAN_ORGANIZATIONAL_TOR_AND_OPERATING_MANUAL.docx`](./VAXPLAN_ORGANIZATIONAL_TOR_AND_OPERATING_MANUAL.docx))*.
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
