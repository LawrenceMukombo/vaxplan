# VAXPLAN: ENTERPRISE PLATFORM MASTER BRIEF & FAST-TRACK COUNTRY ADAPTATION BLUEPRINT

**Target Audience:** Ministers of Health, Permanent Secretaries, National EPI Managers, Gavi / WHO / UNICEF Executive Leadership, Development Bank Sponsoring Teams, and Provincial/District Health Officers  
**Classification:** Strategic Investment, Architecture & Deployment Prospectus  
**Version:** Enterprise Release 1.9.4 | Authoritative Architecture Standard  
**Published:** September 2026  

---

## EXECUTIVE SUMMARY: THE NEXT GENERATION IMMUNIZATION PLATFORM

Every year, an estimated 14.3 million children globally remain **zero-dose**—completely unreached by routine immunization services. An additional 6 million drop out before completing their primary vaccines. Despite substantial investments in vaccine procurement and cold-chain hardware, immunization systems continue to falter at the operational frontline: **microplanning**.

Historically, microplanning has been conducted on fragmented paper forms, disconnected Excel spreadsheets, and static wall maps. These traditional methods introduce severe operational failures:
1. **Denominator Blindness:** National censuses are outdated, while rapid rural-to-urban migrations and remote nomadic movements remain invisible.
2. **Ghost Sessions & Logistics Breakdown:** Outreach sessions are scheduled on paper but cancelled in reality due to lack of fuel, uncoordinated staffing, or cold box shortages.
3. **Delayed Governance:** Microplans take 3 to 6 months to compile, review, and budget, reaching health facilities long after the planned implementation quarter has ended.
4. **Data Isolation:** Catchment population figures, disease surveillance data, and cold-chain capacities reside in isolated silos that cannot communicate with DHIS2 or national logistics systems.

### What is VaxPlan?
**VaxPlan** is the world's most advanced **Geospatial Immunization Microplanning, Logistics & Service Delivery Platform**. Built from the ground up to realize the **WHO Reach Every District (RED 2018)** strategy, **WHO Immunization in Practice (IIP 2025)** guidelines, and the **Immunization Agenda 2030 (IA2030)** targets, VaxPlan replaces manual, disconnected planning with an intelligent, offline-first digital operating system.

### Measurable Executive Outcomes
- **Zero-Dose Elimination:** High-resolution spatial population disaggregation (WorldPop 100m raster + National Census) uncovers remote, unmapped settlements, resulting in a **15% to 35% increase in verified zero-dose cohort identification**.
- **90% Reduction in Microplanning Lead Time:** Compresses the national microplanning cascade from 16 weeks of manual paperwork to **under 10 business days** of digital collaborative authoring and approval.
- **100% Budget & Supply Auditability:** Connects every planned injection directly to required antigen vials, AD syringes, safety boxes, cold chain storage volume, and line-item transport per diems.
- **Zero-Connectivity Field Execution:** Operates seamlessly offline in rural clinics and remote outreach posts with automated bidirectional conflict-free sync upon reconnection.

---

## 1. END-TO-END PLATFORM ARCHITECTURE & CAPABILITIES

VaxPlan provides eight deeply integrated core modules that span the full continuum of immunization planning, budgeting, field execution, and governance:

### Module 1: Spatial Population Intelligence & Catchment Delineation
- **Multi-Source Demographics:** Ingests and harmonizes National Statistics Office (NSO) censuses, DHIS2 administrative targets, community headcounts, and WorldPop high-resolution raster grids.
- **Dynamic Catchment Polygon Engine:** Real-time polygon generation and Voronoi/travel-time catchment modeling around health facilities. Health workers and GIS officers can delineate, split, and edit village catchment boundaries directly on the interactive map.
- **Automated Settlement Harvesting:** Geocoded settlement registry with distance-to-facility calculations, travel times, seasonal river crossing flags, and designated outreach posts.

### Module 2: The 12-Step Guided Microplanning Engine (National & WHO RED)
The core workflow guides facility officers and district teams through twelve structured, policy-enforced microplanning steps:
1. **Coverage, Demographics & RED Categorization:** Analyzes 12-month cohort targets, DTP1/3 and Measles doses, dropout rates (DTP1→3, DTP1→MCV1, MCV1→2), and automatically assigns the official **WHO RED Category (1 to 4)** with prioritized recommendations.
2. **Catchment Mapping & Target Populations:** Interactive GIS map assigning every community a target under-1 cohort, pregnant women baseline, and delivery strategy (Fixed, Outreach, or Mobile).
3. **Risk Analysis & Root-Cause Assessment (BeSD):** Structured Behavioral and Social Drivers (BeSD) evaluation identifying community hesitancy, physical access barriers, and service quality bottlenecks.
4. **Session Schedule & Workload Sizing:** Intelligent calendar scheduling fixed clinic days and outreach tours with automated 7-day advance review policies and workload capacity checks.
5. **Session Staffing Allocation:** Assigns nurses, vaccinators, recorders, and community mobilizers to every planned session date.
6. **Vaccines, Devices & Cold Chain Sizing:** Multi-antigen forecasting (BCG, bOPV, IPV, Penta, PCV, Rota, MR, HPV, Td) with dynamic wastage factors, diluents, 0.5ml/0.05ml AD syringes, 5L safety boxes, and net liter cold chain volume vs. available fridge capacity.
7. **Community Partnerships & Defaulter Tracing:** Establishes community health committee boards, registers community health workers (CHVs), and deploys defaulter tracking mechanisms (Tickler Box, SMS alerts, home visits).
8. **Logistics & Fleet Management:** Calculates vehicle availability, motorbike routes, boat transport, fuel requirements, and difficult terrain surcharges.
9. **Line-Item Operational Budgeting:** Itemized budgeting covering outreach per diems, vehicle hire, community criers, and stationery, mapped directly to Ministry of Health budget codes and donor funding envelopes.
10. **Supportive Supervision Planning:** Multi-tier supervision schedule incorporating digital clinical checklists and on-site mentoring visits.
11. **Automated Validation & Governance Cascade:** A 15-point rule engine checking date overlaps, lead times, population sum reconciliations, and budget limits before submission into the multi-tiered approval hierarchy.
12. **Cumulative Target Monitoring & Annual Review:** Digital WHO wall chart plotting monthly cumulative doses against diagonal annual targets with automated drop-out alarms.

### Module 3: Dual-Mode WHO Reach Every District (RED) Reference Tables
To maintain 100% compliance with WHO formal reporting standards without duplicating data entry, VaxPlan features a **View Mode Switcher**:
- **Guided Digital Flow:** A responsive, modern wizard designed for swift, error-free operational planning by health workers.
- **WHO RED Formal Worksheet Mode:** A dedicated view rendering the authoritative 10-step WHO Reach Every District facility workbook (printed pages 9–37). Pre-populated directly from live microplan records, ready for official inspection and PDF/Excel export.

### Module 4: Supplementary Immunization Activity (SIA) Mass Campaign Engine
- **Campaign Segregation:** Independent workflows for time-bound mass vaccination campaigns (Polio NIDs, Measles-Rubella follow-up, HPV catch-up, Cholera).
- **Target Age Sizing:** Flexible denominator modeling (e.g., 0–59 months or 9 months–14 years) isolated from the routine infant cohort.
- **House-to-House & Rapid Convenience Monitoring (RCM):** Real-time daily tallies, team supervision tracking, and post-campaign coverage survey (PCCS) data models.

### Module 5: Cold Chain Inventory & EVM Storage Compliance
- **Equipment Inventory:** Complete registry of CCE devices (solar direct drive fridges, electric fridges, cold boxes, vaccine carriers) with serial numbers, refrigerants, and operational status.
- **Twice-Daily Temperature Monitoring:** Logs morning and evening temperatures with automatic breach detection (+2°C to +8°C safety zone).
- **Net Storage Volume vs. Vaccine Volume:** Mathematical volume forecasting ensuring planned antigen orders never exceed physical net storage liters.

### Module 6: Offline-First Field Execution & Digital Client Logbook
- **Zero-Connectivity Operations:** Runs as an encrypted Progressive Web App (PWA) on tablets, laptops, and mobile phones.
- **Session Day Register:** Real-time recording of administered doses, batch numbers, vial opening times, and vaccine wastage during outreach sessions.
- **Individual Client Registry:** Digital immunization tracking for children and pregnant women with automated next-dose calculation and missed-appointment alerts.
- **Bidirectional Background Sync:** Automatic conflict-free data replication to central servers via IndexedDB and Web Workers as soon as 2G/3G or Wi-Fi is detected.

### Module 7: Disease Surveillance & Early Warning Outbreak Detection
- **VPD Tracking:** Integrated case recording for Measles, Acute Flaccid Paralysis (Polio), Diphtheria, Pertussis, Neonatal Tetanus, and Yellow Fever.
- **AEFI Case Reporting:** Adverse Events Following Immunization investigation forms linked directly to vaccine lot numbers.
- **Outbreak Cluster Mapping:** Automated alerts when VPD cases concentrate in low-coverage or high-dropout RED Category 4 communities.

### Module 8: Enterprise Analytics, Interactive Dashboards & Open APIs
- **Cross-Filtering Analytics:** Highly interactive dashboards featuring province, district, facility, date range, and antigen filters.
- **Drill-Down Capability:** Seamlessly zoom from national executive KPI summaries down to individual settlement immunization points.
- **Automated Document Exports:** One-click generation of national microplanning compendiums in PDF, Excel, and Word (.docx) formats.

---

## 2. HOW COUNTRIES CAN QUICKLY ADAPT VAXPLAN (30-DAY FAST-TRACK BLUEPRINT)

VaxPlan is engineered as an open, modular, multi-tenant digital health platform. A Ministry of Health can rapidly localize, configure, and deploy VaxPlan nationwide within **30 business days** using our structured five-phase onboarding framework:

### The 30-Day Country Onboarding Playbook

| Phase & Timeline | Strategic Focus | Operational Deliverables | Technical Enablers |
|---|---|---|---|
| **Phase 1: Days 1–5** | **Tenant & Spatial Baseline Ingestion** | • National ISO tenant configuration<br>• Administrative boundary import (Levels 1–4)<br>• Health facility master list ingestion<br>• Community & settlement geocoding | Shapefile/GeoJSON import scripts, PostGIS spatial indexing, automated GeoNames / OCHA settlement harvesting. |
| **Phase 2: Days 6–10** | **EPI Policy, Antigens & Financial Rules** | • Customization of national immunization schedule<br>• Wastage factors & vial presentations<br>• Operational per-diem and mileage rate tables<br>• Customization of review lead times (7-day rule) | Configurable JSON policy engines; zero hard-coded country rules; additive schema extensions. |
| **Phase 3: Days 11–15** | **Interoperability & Data Pipelines** | • Bi-directional DHIS2 API connection<br>• eLMIS / mSupply stock synchronization<br>• Historical coverage & denominator baseline sync<br>• Single Sign-On (SSO) integration | DHIS2 Webhooks & REST adapters; FHIR Immunization Recommendation profile; OAuth2/SAML SSO. |
| **Phase 4: Days 16–22** | **Cascaded Training & Field Validation** | • Master Training of Trainers (ToT)<br>• Provincial & District Officer workshops<br>• Pilot facility dry runs in 2 target districts<br>• Offline mobile PWA field testing | Interactive sandbox environments, localized video walkthroughs, offline role-based access testing. |
| **Phase 5: Days 23–30** | **National Scale-Up & Governance Activation** | • Full production cutover<br>• National approval workflow activation<br>• Quarterly microplan authoring cycle kickoff<br>• Real-time national monitoring dashboard launch | Production PM2 cluster, Redis cache tuning, automated multi-region database backups. |

### Minimal National Prerequisites
To execute the fast-track deployment, a country only needs to provide:
1. **Master Facility List (MFL):** Facility names, coordinates (latitude/longitude), and administrative codes (CSV or Excel).
2. **National Immunization Schedule:** Antigens, target ages, doses per vial, and national wastage assumptions.
3. **Administrative Boundaries:** Standard GeoJSON or Shapefiles for Provinces and Districts.
4. **Denominator Data:** Most recent NSO census totals and/or DHIS2 annual population estimates.

---

## 3. TECHNICAL ARCHITECTURE, SECURITY & DATA SOVEREIGNTY

VaxPlan adheres strictly to the **Principles for Digital Development** and **WHO Digital Health Standards**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      PRESENTATION & ACCESS LAYER                        │
│   Responsive React + Vite Frontend  •  Progressive Web App (PWA)        │
│   Interactive Leaflet GIS Mapping   •  Enterprise DataTables & Charts   │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ HTTPS / Secure WebSockets
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     APPLICATION & INTEGRATION LAYER                     │
│   Node.js / Express Enterprise API  •  Role-Based Access Control (RBAC) │
│   DHIS2 Bi-directional Adapter      •  OpenLMIS / FHIR Connector        │
│   Offline Sync Batch Processor      •  Redis Performance Cache          │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Parameterized Queries & Pool
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      DATA & SPATIAL STORAGE LAYER                       │
│   PostgreSQL 16 Relational Engine   •  PostGIS Spatial Data Engine      │
│   Multi-Tenant Row-Level Security   •  Tamper-Proof Audit Logging       │
│   Encrypted Client-Side IndexedDB   •  Immutable Microplan Snapshots    │
└─────────────────────────────────────────────────────────────────────────┘
```

### Security & Data Protection Guarantees
- **National Data Sovereignty:** VaxPlan can be deployed on sovereign national government cloud infrastructure, national data centers, or secure dedicated VPS environments. The Ministry of Health retains 100% data ownership.
- **Multi-Tenant Row-Level Isolation:** Every database record is stamped with a cryptographic `tenantId`. Users are strictly bound to their country, province, district, or facility scope.
- **Enterprise RBAC:** Six granular user roles:
  - *National Admin:* Countrywide oversight, policy configuration, national approvals.
  - *Provincial Coordinator:* Sub-national resource distribution, cross-district validation.
  - *District Manager:* Microplan approval, supervision planning, cold chain allocation.
  - *Facility In-Charge:* Microplan authoring, session scheduling, budget submission.
  - *Nurse / Vaccinator:* Session day register recording, actual dose entry.
  - *Community Health Worker (CHV):* Defaulter tracing, newborn registration.
- **Audit Logging & Non-Destructive Data Safety:** Immutable audit logs recording every creation, edit, approval, and data synchronization.

---

## 4. GOVERNANCE, APPROVAL CASCADES & POLICY ENFORCEMENT

A frequent failure of paper microplans is the absence of governance: plans are written after sessions have already occurred, or approvals linger unread on supervisors' desks.

VaxPlan enforces **rigorous digital governance policies**:
1. **The 7-Day Advance Lead-Time Policy:** In accordance with national operational standards, all microplan approvals require at least 7 days of review following submission. Planned vaccination sessions must be scheduled for implementation at least 7 days after approval, guaranteeing that vaccines, transport, and per diems are physically mobilized in advance.
2. **Immutable Approval Locking:** Once a microplan reaches terminal approval (District Manager or Provincial Coordinator), the plan and all linked child sessions, vaccine requests, and budgets are locked against tampering.
3. **Supervisory Action Tracking:** Any issue flagged during supportive supervision creates an actionable item in the Digital Action Register, assigned to a specific officer with an enforced completion deadline.

---

## 5. RETURN ON INVESTMENT (ROI) & TOTAL COST OF OWNERSHIP (TCO)

For Development Partners (Gavi, UNICEF, WHO, Global Fund) and National Treasuries, VaxPlan delivers an extraordinary return on investment:

### Comparative Cost & Efficiency Matrix

| Dimension | Traditional Paper / Excel Microplanning | VaxPlan Digital Enterprise Platform | Net Strategic Impact |
|---|---|---|---|
| **Compilation Lead Time** | 12 to 16 weeks of field workshops and paperwork | 5 to 10 days of collaborative digital authoring | **85% reduction in administrative cycle time** |
| **National Workshop Costs** | $250,000 to $800,000 annually in per diems & printing | Minimal printing; remote online reviews & training | **60% to 75% recurring budget savings** |
| **Vaccine Wastage** | 25% to 45% due to inaccurate session sizing | 10% to 15% via formula-driven vial forecasting | **Multi-million dollar antigen savings** |
| **Zero-Dose Identification** | Incomplete estimates based on outdated censuses | Exact settlement coordinates via spatial raster | **30%+ increase in verified cohort reach** |
| **Budget Auditability** | Receipts often detached from planned session records | Every dollar linked to verified session records | **100% clean donor & treasury audit trail** |

---

## 6. STAKEHOLDER ENGAGEMENT & NEXT STEPS

VaxPlan is operational and battle-tested across multiple national contexts (including South Africa, Zambia, South Sudan, and Papua New Guinea). We invite global health leaders, national ministries, and funding partners to initiate national partnership:

1. **Request an Executive Demonstration:** Schedule a guided walkthrough tailored to your national EPI schedule and administrative geography.
2. **Execute a 2-District Fast-Track Pilot:** Deploy VaxPlan across 20 to 50 health facilities in your highest-burden zero-dose district within 14 days.
3. **Initiate National Scale-Up:** Integrate with national DHIS2 instances and scale nationwide with full bilateral donor backing.

**Contact & Inquiries:**  
Global Immunization Platform Directorate | VaxPlan Digital Health Systems  
Documentation & Resources: `/docs` | Interactive Alignment: `/standards-alignment`
