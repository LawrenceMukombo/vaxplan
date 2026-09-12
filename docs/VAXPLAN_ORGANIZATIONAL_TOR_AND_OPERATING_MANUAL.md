# VaxPlan: Organizational Terms of Reference (ToR) & Operational Manual
## Governance, Executive Mandates, Consultant Scopes, and Team Operations

**Document Version:** 1.0  
**Effective Date:** 2026-09-10  
**Target Audience:** Founder, Co-Founders, Executive Leadership, Advisory Board, Specialized Consultants, Full-Time Employees, In-Country Field Staff, and Institutional Investors/Sponsors.  
**Operational Alignment:** Global Health Data Security Standards, WHO Digital Health Guidelines, ISO/IEC 27001 Data Protection Principles.

---

## 1. Institutional Mandate & Core Values

### 1.1 Mission Statement
To eliminate preventable childhood disease and reach every zero-dose community by providing Ministries of Health, frontline health workers, and global immunization partners with an intelligent, offline-first GIS microplanning and field execution platform.

### 1.2 Core Operating Principles
1. **Health Worker First:** All interfaces must empower frontline nurses, clinic in-charges, and community health volunteers (CHVs) rather than imposing administrative burdens.
2. **Offline-Resilient by Default:** Assume zero connectivity in remote catchments. The platform must function completely without internet and synchronize deterministically when connection resumes.
3. **Absolute Data Sovereignty:** Patient, facility, and national health data belong exclusively to the sovereign Ministry of Health. Zero unauthorized data monetizing or third-party leakage.
4. **Data Safety & Non-Destructive Integrity:** Immutable history. No accidental database wipes, no destructive drops, no overwritten microplans. Upsert and version snapshots only.
5. **Standards Grounded in Global Evidence:** Full fidelity to WHO Reach Every District (RED), WHO Immunization in Practice (IIP), and Gavi 5.0 operational benchmarks.

---

## 2. Executive Leadership Terms of Reference (ToR)

```
                       ┌─────────────────────────────────────┐
                       │       FOUNDER & CHIEF EXECUTIVE     │
                       │             OFFICER (CEO)           │
                       └──────────────────┬──────────────────┘
                                          │
        ┌─────────────────────────────────┼─────────────────────────────────┐
        ▼                                 ▼                                 ▼
┌───────────────────────────┐ ┌───────────────────────────┐ ┌───────────────────────────┐
│        CO-FOUNDER         │ │        CO-FOUNDER         │ │      CHIEF OPERATING      │
│  CHIEF TECHNOLOGY OFFICER │ │   HEAD OF PUBLIC HEALTH   │ │      OFFICER (COO)        │
│          (CTO)            │ │       & EPI STRATEGY      │ │                           │
└─────────────┬─────────────┘ └─────────────┬─────────────┘ └─────────────┬─────────────┘
              │                             │                             │
    ┌─────────┴─────────┐         ┌─────────┴─────────┐         ┌─────────┴─────────┐
    ▼                   ▼         ▼                   ▼         ▼                   ▼
Engineering          GIS &     EPI Policy         Clinical      Country         Field Training
   Team           Architecture Consultants        Auditing    Deployments         & Support
```

### 2.1 Founder & Chief Executive Officer (CEO)

#### Role Summary
The CEO provides overall vision, strategic leadership, institutional governance, and external representation for VaxPlan. The CEO leads donor engagements, Ministry of Health sovereign partnerships, fundraising, and organizational sustainability.

#### Primary Responsibilities
1. **Strategic Leadership & Vision:** Direct the multi-year growth strategy of VaxPlan to become the leading digital microplanning standard across low- and middle-income countries.
2. **Ministerial & Multilateral Partnerships:** Serve as primary principal in negotiations with Ministries of Health, Gavi, WHO, UNICEF, The Global Fund, and bilateral donor missions.
3. **Capitalization & Governance:** Secure grant funding, technical assistance agreements, and venture/equity financing to maintain organizational liquidity and growth.
4. **Culture & Executive Performance:** Recruit, inspire, and manage the executive team, ensuring adherence to high ethical standards and global health equity values.

#### Key Performance Indicators (KPIs)
- Number of national and sub-national health jurisdictions actively deploying VaxPlan.
- Total grant funding and institutional revenue secured.
- Stakeholder satisfaction scores from MoH leadership and global health sponsors.

---

### 2.2 Co-Founder & Chief Technology Officer (CTO)

#### Role Summary
The CTO owns the end-to-end technical architecture, spatial data engineering, offline synchronization protocols, cybersecurity posture, and engineering execution across all VaxPlan platforms (Web, PWA, Mobile, Desktop).

#### Primary Responsibilities
1. **Platform Architecture:** Architect and oversee the scalable development of the Node.js/TypeScript backend, PostgreSQL/PostGIS geospatial database, and React frontend.
2. **Offline-First & GIS Leadership:** Ensure sub-second map rendering, robust GeoJSON boundary calculations, conflict-free offline replication, and fault-tolerant background synchronization.
3. **Security & Data Safety:** Enforce multi-tenant row-level security (RLS), cryptographic hashing, role-based access control (RBAC), and strict zero-data-loss database policies.
4. **Technical Team Leadership:** Mentor engineering staff, oversee continuous integration/continuous delivery (CI/CD), and ensure zero breaking changes in production deployments.

#### Key Performance Indicators (KPIs)
- 99.9% platform availability across national and sub-national production instances.
- Zero data loss incidents during offline synchronization and version snapshots.
- Sub-2 second load times for national-scale spatial datasets and 100m raster population layers.

---

### 2.3 Co-Founder / Head of Public Health & Immunization Strategy

#### Role Summary
Serves as the primary public health authority, ensuring that every calculation, algorithm, form, and workflow in VaxPlan aligns precisely with WHO, UNICEF, Gavi, and national EPI technical guidelines.

#### Primary Responsibilities
1. **WHO/EPI Compliance:** Validate that microplanning workflows strictly adhere to the WHO Reach Every District (RED) strategy, Immunization in Practice (IIP), and Gavi 5.0 benchmarks.
2. **Denominator & Cohort Modeling:** Oversee the mathematical algorithms for population disaggregation, dropout calculations, vaccine vial presentation wastage rates, and cold-chain capacity sizing.
3. **Stakeholder Advisory:** Lead technical dialogue with MoH National EPI Managers, technical working groups (TWGs), and WHO/UNICEF country office epidemiologists.
4. **Impact Measurement:** Design epidemiological evaluation frameworks to quantify reductions in zero-dose children and missed opportunities for vaccination (MOV).

#### Key Performance Indicators (KPIs)
- 100% compliance with WHO RED Annex 1 microplanning tools across platform versions.
- Published case studies and peer-reviewed documentation detailing coverage gains in deployment countries.
- Technical endorsement from national EPI Technical Advisory Groups (NITAGs).

---

### 2.4 Chief Operating Officer (COO) / Head of Deployments

#### Role Summary
Leads on-the-ground operational execution, country onboarding roadmaps, in-country supply logistics, hardware readiness, and operational project management across all deployment countries.

#### Primary Responsibilities
1. **Country Deployment Roadmaps:** Develop and monitor operational Gantt charts for national and district rollouts, tracking milestones from initial data gathering to countrywide sign-off.
2. **Operational Logistics & Field Readiness:** Coordinate hardware distribution (tablets, rugged devices, solar chargers) and local connectivity support for district field teams.
3. **Operational Budget Oversight:** Manage deployment budgets, consultant logistics, and field mission expenditure in full compliance with donor accounting standards.
4. **Cross-Functional Coordination:** Bridge communication between software development teams, public health advisors, and in-country deployment officers.

#### Key Performance Indicators (KPIs)
- On-time delivery of country onboarding milestones within planned budget parameters.
- 90%+ training completion rate among target district health teams and facility officers.
- Resolution of critical field operational issues within 24 hours.

---

## 3. Specialized Consultants Terms of Reference (ToR)

### 3.1 Senior Immunization & EPI Policy Consultant

#### Scope of Work
- Review country-specific national EPI policies, seasonal disease calendars, and local immunization schedules to configure country tenants in VaxPlan.
- Conduct high-level policy briefings with National Health Directors, EPI managers, and health development partners.
- Review and certify that generated microplans satisfy sovereign regulatory and audit standards before formal submission for Gavi/donor operational support.

#### Key Deliverables
- Country-specific Immunization Tenant Configuration Matrix (antigens, target ratios, vial presentations, wastage allowances).
- National Microplanning Readiness Assessment Report.
- Final Evaluation & Policy Recommendations Brief for the Minister of Health.

---

### 3.2 GIS & Spatial Analytics Specialist Consultant

#### Scope of Work
- Cleanse, validate, and ingest national administrative boundary GeoJSON/Shapefiles (Admin 0 to Admin 4).
- Process high-resolution settlement registries, facility GPS coordinates, and WorldPop 100m population rasters.
- Design spatial conflict-resolution protocols for disputed catchment zones between neighboring health facilities.
- Perform spatial accessibility modeling (travel time surfaces, friction maps, seasonal river-crossing impassability).

#### Key Deliverables
- Fully harmonized National Health Facility & Catchment Spatial Dataset in GeoJSON format.
- Catchment Boundary Overlap Audit & Harmonization Report.
- High-resolution printable catchment maps for remote health posts and outreach sites.

---

### 3.3 Health Systems Interoperability Consultant (DHIS2 / FHIR)

#### Scope of Work
- Architect and configure bi-directional integration between VaxPlan and national health management information systems (e.g., DHIS2 Tracker and aggregate).
- Standardize data exchange models conforming to HL7 FHIR (Fast Healthcare Interoperability Resources) and WHO SMART Guidelines (SMART IMMZ).
- Develop automated scheduled data exchange pipelines for monthly aggregate immunization indicators and stock ledger consumption balances.

#### Key Deliverables
- OpenHIE/FHIR-compliant Data Exchange Specification Document.
- Configured and validated DHIS2 Data Export Adapter.
- End-to-End Integration Test Report with National Health Data Center.

---

## 4. Core Employee Terms of Reference (ToR)

### 4.1 Lead Full-Stack Engineer

#### Role & Duties
- Build and maintain core application modules using React 18, TypeScript, Express.js, and Drizzle ORM.
- Optimize database queries, spatial indexing (PostGIS `ST_Intersects`, `ST_DWithin`), and server-side response payloads.
- Enforce strict unit, integration, and regression testing (`vitest`, `supertest`) with 90%+ code coverage.
- Maintain API documentation and ensure backwards compatibility across all API version upgrades.

#### Required Profile
- 5+ years of production TypeScript/Node.js experience.
- Deep expertise in relational schema design and PostGIS spatial queries.
- Proven track record with large-scale data web applications and automated testing.

---

### 4.2 GIS & Offline Frontend Engineer

#### Role & Duties
- Develop interactive, touch-friendly mapping user interfaces using Leaflet, MapLibre GL, and OpenLayers.
- Implement robust Progressive Web App (PWA) caching, Service Workers, and client-side IndexedDB databases (`Dexie.js`/custom).
- Optimize complex SVG and GeoJSON rendering to ensure 60fps interaction on entry-level Android tablets.
- Maintain enterprise-grade table and chart components supporting sorting, filtering, and export.

#### Required Profile
- 4+ years of modern React and GIS web mapping experience.
- Mastery of offline-first storage mechanics and optimistic client reconciliation.
- Passion for crafting accessible, high-performance user interfaces for resource-constrained environments.

---

### 4.3 In-Country Field Implementation & Training Lead

#### Role & Duties
- Facilitate interactive, hands-on training sessions for district health officers, EPI focal persons, and facility nurses.
- Provide real-time field troubleshooting during microplanning creation, review, and approval cycles.
- Capture user feedback, operational friction points, and field bugs, translating them into structured engineering tickets.
- Coordinate community-level pilot tests in remote and conflict-affected health catchments.

#### Required Profile
- Degree in Public Health, Nursing, Health Informatics, or related field.
- 3+ years experience conducting training programs within national health systems.
- Fluency in national language and working knowledge of official administrative health workflows.

---

### 4.4 Quality Assurance & Data Integrity Engineer

#### Role & Duties
- Execute automated end-to-end regression test suites and manual validation workflows prior to every software release.
- Validate that all mathematical forecasting engines (population, target infants, vial wastage, budget totals) yield exact results across all currency and cohort variations.
- Conduct simulated offline field tests: verify data capture under network disconnects, battery drops, and concurrent synchronization.
- Audit the platform to ensure zero data overwrites, zero dropped records, and full audit trail capture.

#### Required Profile
- 3+ years of software quality assurance and test automation experience.
- Strong knowledge of relational database verification and data integrity testing.
- Detail-oriented mindset with an uncompromising standard for software reliability in life-critical systems.

---

## 5. Standard Operating Procedures (SOPs) for Team Operations

### 5.1 Non-Destructive Deployment & Data Safety SOP (Strict Enforcement)
1. **Zero Configuration Overwrite:** Production environment files (`.env`), web server configs (Nginx), and process managers (PM2) are protected assets. No automated deployment script may overwrite production configurations.
2. **Additive Schema Migrations Only:** Never execute `DROP TABLE`, `TRUNCATE`, or destructive column renames on live instances. All database schema evolution must be backwards-compatible, nullable, and additive.
3. **Immutable Version Snapshots:** Any user action that creates, edits, saves, submits, or approves a microplan must capture a distinct, numbered snapshot version in `microplan_versions`.
4. **Mandatory Pre-Release Validation:** Prior to any deployment, the lead engineer must verify:
   ```bash
   npm run check       # 0 TypeScript compilation errors
   npm test            # 100% passing automated test suite
   npm run build       # Clean production client & server bundle
   ```

### 5.2 Microplan Approval & Lead-Time Governance SOP
1. **7-Day Quality Review Window:** No microplan may be approved immediately upon submission. A mandatory minimum 7-day review window is enforced by policy to enable district supervisors to conduct desk reviews and community verification.
2. **Session Implementation Lead-Time:** Vaccination sessions must be scheduled to occur at least X days (configurable per tenant, default 7 days) following approval to ensure cold chain equipment is prepared and vaccines are received from district stores.
3. **Independent Review Trail:** An approval request must be submitted by facility staff and approved by authorized district/provincial managers, maintaining an immutable audit log of comments, timestamps, and approver user IDs.

---

## 6. Code of Conduct, Ethics & Data Privacy

1. **Child Protection & Data Anonymity:** Under no circumstances are individual infant names or identifiable patient records exported or shared outside of authorized sovereign health channels.
2. **Zero Conflict of Interest:** All consultants and employees must disclose any commercial or advisory relationships with vaccine manufacturers, medical distributors, or political parties.
3. **Respect for Frontline Workers:** Team members must always treat community health workers and nurses as co-creators of VaxPlan, listening with humility and acting promptly on frontline feedback.
