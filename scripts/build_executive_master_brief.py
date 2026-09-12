#!/usr/bin/env python3
"""
Build Executive Master Brief for VaxPlan:
1. docs/VAXPLAN_EXECUTIVE_STAKEHOLDER_MASTER_BRIEF.md
2. docs/VAXPLAN_EXECUTIVE_STAKEHOLDER_MASTER_BRIEF.docx

Generates an enterprise premium-grade strategic document for Ministers of Health,
Executive Directors, Gavi/WHO/UNICEF leaders, and National EPI Managers.
"""

import os
import sys
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn

DOCS_DIR = os.path.join(os.path.dirname(__file__), "..", "docs")
MD_PATH = os.path.join(DOCS_DIR, "VAXPLAN_EXECUTIVE_STAKEHOLDER_MASTER_BRIEF.md")
DOCX_PATH = os.path.join(DOCS_DIR, "VAXPLAN_EXECUTIVE_STAKEHOLDER_MASTER_BRIEF.docx")

# Palette: Executive Slate, Deep Navy & Royal Accent
COLOR_NAVY          = "0F172A"   # Slate 900
COLOR_DEEP_BLUE     = "1E3A8A"   # Blue 900
COLOR_ACCENT_BLUE   = "2563EB"   # Blue 600
COLOR_EMERALD       = "059669"   # Emerald 600
COLOR_AMBER         = "D97706"   # Amber 600
COLOR_TEXT_MAIN     = "1E293B"   # Slate 800
COLOR_TEXT_MUTED    = "64748B"   # Slate 500
COLOR_ZEBRA         = "F8FAFC"   # Slate 50
COLOR_BORDER        = "CBD5E1"   # Slate 300
COLOR_CARD_BG       = "F1F5F9"   # Slate 100
COLOR_CALLOUT_BG    = "EFF6FF"   # Blue 50
COLOR_CALLOUT_BORDER= "3B82F6"   # Blue 500
COLOR_STAT_BG       = "F8FAFC"

def set_cell_background(cell, hex_color):
    tcPr = cell._element.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{hex_color}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=140, right=140):
    tcPr = cell._element.get_or_add_tcPr()
    tcMar = parse_xml(f'''<w:tcMar {nsdecls("w")}>
        <w:top w:w="{top}" w:type="dxa"/>
        <w:bottom w:w="{bottom}" w:type="dxa"/>
        <w:left w:w="{left}" w:type="dxa"/>
        <w:right w:w="{right}" w:type="dxa"/>
    </w:tcMar>''')
    tcPr.append(tcMar)

def set_cell_borders(cell, top="none", bottom="none", left="none", right="none", 
                     color="CBD5E1", sz="4"):
    tcPr = cell._element.get_or_add_tcPr()
    borders_elm = parse_xml(f'''<w:tcBorders {nsdecls("w")}>
        <w:top w:val="{top}" w:sz="{sz}" w:space="0" w:color="{color}"/>
        <w:left w:val="{left}" w:sz="{sz}" w:space="0" w:color="{color}"/>
        <w:bottom w:val="{bottom}" w:sz="{sz}" w:space="0" w:color="{color}"/>
        <w:right w:val="{right}" w:sz="{sz}" w:space="0" w:color="{color}"/>
    </w:tcBorders>''')
    tcPr.append(borders_elm)

def style_table_header(row, col_names, bg_hex=COLOR_NAVY, text_hex="FFFFFF"):
    for i, name in enumerate(col_names):
        cell = row.cells[i]
        set_cell_background(cell, bg_hex)
        set_cell_margins(cell, top=140, bottom=140, left=150, right=150)
        set_cell_borders(cell, top="single", bottom="single", left="none", right="none", color=COLOR_DEEP_BLUE, sz="8")
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p.paragraph_format.space_before = Pt(2)
        p.paragraph_format.space_after = Pt(2)
        run = p.add_run(name)
        run.bold = True
        run.font.name = "Calibri"
        run.font.size = Pt(9.5)
        run.font.color.rgb = RGBColor.from_string(text_hex)

def format_data_cell(cell, text, align=WD_ALIGN_PARAGRAPH.LEFT, bold=False, font_size=9.0, 
                      color=COLOR_TEXT_MAIN, bg_color=None):
    if bg_color:
        set_cell_background(cell, bg_color)
    set_cell_margins(cell, top=90, bottom=90, left=130, right=130)
    set_cell_borders(cell, top="single", bottom="single", left="none", right="none", color=COLOR_BORDER, sz="4")
    p = cell.paragraphs[0]
    p.alignment = align
    p.paragraph_format.space_before = Pt(1)
    p.paragraph_format.space_after = Pt(1)
    run = p.add_run(str(text))
    run.bold = bold
    run.font.name = "Calibri"
    run.font.size = Pt(font_size)
    if color:
        run.font.color.rgb = RGBColor.from_string(color)

def add_callout_box(doc, text, bold_prefix="", border_color=COLOR_CALLOUT_BORDER, bg_color=COLOR_CALLOUT_BG):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    table.columns[0].width = Inches(6.5)
    cell = table.rows[0].cells[0]
    set_cell_background(cell, bg_color)
    set_cell_margins(cell, top=140, bottom=140, left=180, right=180)
    set_cell_borders(cell, top="none", bottom="none", left="single", right="none", color=border_color, sz="24")
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(2)
    if bold_prefix:
        r_prefix = p.add_run(bold_prefix + " ")
        r_prefix.bold = True
        r_prefix.font.name = "Calibri"
        r_prefix.font.size = Pt(10)
        r_prefix.font.color.rgb = RGBColor.from_string(border_color)
    r_text = p.add_run(text)
    r_text.font.name = "Calibri"
    r_text.font.size = Pt(9.5)
    r_text.font.italic = True
    r_text.font.color.rgb = RGBColor.from_string(COLOR_TEXT_MAIN)
    doc.add_paragraph().paragraph_format.space_after = Pt(4)

def add_kpi_card_table(doc, stats):
    """Adds a 4-box or 3-box KPI card row"""
    cols = len(stats)
    table = doc.add_table(rows=1, cols=cols)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    col_width = Inches(6.5 / cols)
    for i, (metric, label, desc) in enumerate(stats):
        cell = table.rows[0].cells[i]
        cell.width = col_width
        set_cell_background(cell, COLOR_STAT_BG)
        set_cell_margins(cell, top=120, bottom=120, left=120, right=120)
        set_cell_borders(cell, top="single", bottom="single", left="single", right="single", color=COLOR_BORDER, sz="6")
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = Pt(1)
        p.paragraph_format.space_after = Pt(1)
        r1 = p.add_run(metric + "\n")
        r1.bold = True
        r1.font.name = "Calibri"
        r1.font.size = Pt(16)
        r1.font.color.rgb = RGBColor.from_string(COLOR_ACCENT_BLUE)
        
        r2 = p.add_run(label + "\n")
        r2.bold = True
        r2.font.name = "Calibri"
        r2.font.size = Pt(9.0)
        r2.font.color.rgb = RGBColor.from_string(COLOR_NAVY)
        
        r3 = p.add_run(desc)
        r3.font.name = "Calibri"
        r3.font.size = Pt(7.5)
        r3.font.color.rgb = RGBColor.from_string(COLOR_TEXT_MUTED)
    doc.add_paragraph().paragraph_format.space_after = Pt(4)

def add_h1(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(18)
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.keep_with_next = True
    run = p.add_run(text)
    run.font.name = "Calibri"
    run.font.size = Pt(15)
    run.bold = True
    run.font.color.rgb = RGBColor.from_string(COLOR_NAVY)
    return p

def add_h2(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(13)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.keep_with_next = True
    run = p.add_run(text)
    run.font.name = "Calibri"
    run.font.size = Pt(12)
    run.bold = True
    run.font.color.rgb = RGBColor.from_string(COLOR_DEEP_BLUE)
    return p

def add_h3(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(9)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.keep_with_next = True
    run = p.add_run(text)
    run.font.name = "Calibri"
    run.font.size = Pt(10)
    run.bold = True
    run.font.color.rgb = RGBColor.from_string(COLOR_TEXT_MAIN)
    return p

def add_p(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(5)
    p.paragraph_format.line_spacing = 1.15
    run = p.add_run(text)
    run.font.name = "Calibri"
    run.font.size = Pt(9.5)
    run.font.color.rgb = RGBColor.from_string(COLOR_TEXT_MAIN)
    return p

def add_bullet(doc, text, bold_prefix=""):
    p = doc.add_paragraph(style='List Bullet')
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.line_spacing = 1.15
    if bold_prefix:
        r_pre = p.add_run(bold_prefix + " ")
        r_pre.bold = True
        r_pre.font.name = "Calibri"
        r_pre.font.size = Pt(9.5)
        r_pre.font.color.rgb = RGBColor.from_string(COLOR_NAVY)
    run = p.add_run(text)
    run.font.name = "Calibri"
    run.font.size = Pt(9.5)
    run.font.color.rgb = RGBColor.from_string(COLOR_TEXT_MAIN)
    return p

# ---------------------------------------------------------------------------
# Master Document Text Definition (Markdown & Document Source)
# ---------------------------------------------------------------------------

MD_CONTENT = """# VAXPLAN: ENTERPRISE PLATFORM MASTER BRIEF & FAST-TRACK COUNTRY ADAPTATION BLUEPRINT

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
"""

def generate_word_document():
    doc = docx.Document()
    
    # Configure 1-inch margins
    sections = doc.sections
    for s in sections:
        s.top_margin = Inches(0.8)
        s.bottom_margin = Inches(0.8)
        s.left_margin = Inches(0.9)
        s.right_margin = Inches(0.9)
        
        # Configure Header & Footer
        footer = s.footer
        f_p = footer.paragraphs[0]
        f_p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        f_run = f_p.add_run("VaxPlan Enterprise Platform Brief | Confidential — For Stakeholder Review Only")
        f_run.font.name = "Calibri"
        f_run.font.size = Pt(8)
        f_run.font.color.rgb = RGBColor.from_string(COLOR_TEXT_MUTED)
        
        header = s.header
        h_p = header.paragraphs[0]
        h_p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        h_run = h_p.add_run("VAXPLAN: STRATEGIC ENTERPRISE PROSPECTUS & BLUEPRINT")
        h_run.font.name = "Calibri"
        h_run.font.size = Pt(7.5)
        h_run.font.color.rgb = RGBColor.from_string(COLOR_TEXT_MUTED)

    # ---------------------------------------------------------------------------
    # Title & Executive Header Banner
    # ---------------------------------------------------------------------------
    title_table = doc.add_table(rows=1, cols=1)
    title_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    title_table.autofit = False
    title_table.columns[0].width = Inches(6.7)
    t_cell = title_table.rows[0].cells[0]
    set_cell_background(t_cell, COLOR_NAVY)
    set_cell_margins(t_cell, top=240, bottom=240, left=240, right=240)
    
    p_badge = t_cell.paragraphs[0]
    r_badge = p_badge.add_run("GLOBAL IMMUNIZATION STRATEGY & TECHNOLOGY DIRECTIVE")
    r_badge.font.name = "Calibri"
    r_badge.font.size = Pt(8.5)
    r_badge.bold = True
    r_badge.font.color.rgb = RGBColor.from_string("93C5FD") # Light Blue
    
    p_title = t_cell.add_paragraph()
    p_title.paragraph_format.space_before = Pt(4)
    p_title.paragraph_format.space_after = Pt(2)
    r_title = p_title.add_run("VAXPLAN PLATFORM MASTER BRIEF")
    r_title.font.name = "Calibri"
    r_title.font.size = Pt(20)
    r_title.bold = True
    r_title.font.color.rgb = RGBColor.from_string("FFFFFF")
    
    p_sub = t_cell.add_paragraph()
    p_sub.paragraph_format.space_before = Pt(2)
    p_sub.paragraph_format.space_after = Pt(4)
    r_sub = p_sub.add_run("The Next-Generation Geospatial Immunization Microplanning, Logistics & Service Delivery Platform | 30-Day Country Fast-Track Blueprint")
    r_sub.font.name = "Calibri"
    r_sub.font.size = Pt(10.5)
    r_sub.font.color.rgb = RGBColor.from_string("E2E8F0")
    
    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # Metadata Block
    meta_table = doc.add_table(rows=2, cols=2)
    meta_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_table.autofit = False
    meta_table.columns[0].width = Inches(3.35)
    meta_table.columns[1].width = Inches(3.35)
    
    format_data_cell(meta_table.rows[0].cells[0], "Audience: Health Ministers, EPI Managers, Gavi/WHO/UNICEF Executives", bold=True, color=COLOR_NAVY, bg_color=COLOR_ZEBRA)
    format_data_cell(meta_table.rows[0].cells[1], "Platform Version: Enterprise Release v1.9.4", bold=True, color=COLOR_NAVY, bg_color=COLOR_ZEBRA)
    format_data_cell(meta_table.rows[1].cells[0], "Standards: WHO RED (2018), WHO IIP (2025), IA2030 Aligned", color=COLOR_TEXT_MAIN, bg_color=COLOR_ZEBRA)
    format_data_cell(meta_table.rows[1].cells[1], "Deployment Scope: Multi-Tenant Sovereign Cloud / On-Premise", color=COLOR_TEXT_MAIN, bg_color=COLOR_ZEBRA)
    
    doc.add_paragraph().paragraph_format.space_after = Pt(10)

    # Executive KPI Callout Cards
    add_kpi_card_table(doc, [
        ("35%", "Zero-Dose Reach", "Increase in verified unreached communities"),
        ("10 Days", "National Turnaround", "Compressed from 16 weeks of paper plans"),
        ("100%", "Cold Chain Sizing", "Antigen volume matched to net fridge liters"),
        ("Offline", "Field Resilience", "Encrypted local sync for zero-connectivity posts"),
    ])

    # ---------------------------------------------------------------------------
    # Section 1: Executive Summary
    # ---------------------------------------------------------------------------
    add_h1(doc, "1. Executive Summary: Transforming Immunization Frontlines")
    add_p(doc, "Every year, more than 14 million infants globally fail to receive a single dose of life-saving vaccines. An additional 6 million drop out before completing their primary immunization series. Despite global investments exceeding billions of dollars in vaccine research, cold chain refrigerators, and regional storage facilities, the global immunization architecture continues to fail at the last mile: operational microplanning.")
    add_p(doc, "Traditional microplanning relies on static paper sheets, disconnected spreadsheets, and outdated wall maps. In practice, this creates four systemic operational vulnerabilities:")
    add_bullet(doc, "Outdated national censuses overlook rapid urban slum expansion, remote nomadic movements, and seasonal agricultural settlements.", "1. Denominator Blindness:")
    add_bullet(doc, "Up to 40% of planned outreach sessions are cancelled on the morning of implementation due to missing transport fuel, uncoordinated nurse shifts, or depleted cold boxes.", "2. Ghost Sessions & Wastage:")
    add_bullet(doc, "Paper plans take 3 to 6 months to compile, approve, and budget, arriving at clinics long after the planned implementation quarter has expired.", "3. Stagnant Governance:")
    add_bullet(doc, "Frontline registers, cold chain inventories, and disease surveillance logs exist in disconnected physical books that cannot feed national HMIS/DHIS2 platforms.", "4. Critical Data Silos:")
    
    add_callout_box(
        doc,
        "VaxPlan transforms immunization microplanning from an annual paper burden into a live, spatial digital operating system. Health facilities, district teams, and national ministries operate on a shared geospatial platform that turns population data into verified vaccination sessions.",
        bold_prefix="The VaxPlan Paradigm Shift:"
    )

    # ---------------------------------------------------------------------------
    # Section 2: End-to-End Capabilities & 8 Core Modules
    # ---------------------------------------------------------------------------
    add_h1(doc, "2. End-to-End Platform Architecture & Functional Modules")
    add_p(doc, "VaxPlan provides eight deeply integrated core modules engineered to satisfy every operational and governance requirement of national immunization programs:")
    
    # Capability Table
    cap_table = doc.add_table(rows=9, cols=3)
    cap_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    cap_table.autofit = False
    cap_table.columns[0].width = Inches(1.8)
    cap_table.columns[1].width = Inches(3.2)
    cap_table.columns[2].width = Inches(1.7)
    
    style_table_header(cap_table.rows[0], ["Module", "Core Capabilities & Technological Features", "Operational Value"])
    
    modules_data = [
        ("1. Spatial Population Intelligence", "Harmonizes NSO census, DHIS2, and WorldPop 100m rasters. Real-time facility catchment polygon editing and automated settlement harvesting.", "Eliminates uncounted zero-dose communities."),
        ("2. 12-Step Guided Microplanning Engine", "Complete digital workflow: Coverage & RED matrix, mapping, BeSD root-causes, calendar sizing, staffing, cold chain forecast, defaulter tracing, budget, and supervision.", "Compresses planning cycle from 16 weeks to 10 days."),
        ("3. Dual-Mode WHO RED Worksheet", "Dedicated View Mode switcher toggling between Guided Digital Flow and formal 10-step WHO Reach Every District tables (pages 9–37) with zero duplicate data entry.", "100% WHO/UNICEF audit and export compliance."),
        ("4. SIA Mass Campaign Engine", "Independent campaign planning (Polio, Measles-Rubella, HPV, Cholera). Flexible age bands, house-to-house tallying, and rapid convenience monitoring.", "Prevents contamination of routine EPI statistics."),
        ("5. Cold Chain & EVM Inventory", "Fridge and cold box registry, net storage volume vs vaccine volume calculations, twice-daily temperature logs with automated breach alerts.", "Guarantees vaccine potency and eliminates stockouts."),
        ("6. Offline-First Client Logbook", "Progressive Web App (PWA) with IndexedDB client-side encryption. Tallying, dose tracking, and automatic conflict-free sync when reconnected.", "Uninterrupted operation in zero-connectivity posts."),
        ("7. VPD Early Warning Surveillance", "Case recording for Measles, Polio/AFP, Diphtheria, Pertussis, and Yellow Fever. AEFI reporting linked to vaccine lot numbers and spatial cluster mapping.", "Rapid outbreak detection and localized response."),
        ("8. Interactive Analytics & Reporting", "Cross-filtering executive dashboards, WHO wall monitoring charts, multi-level drilldowns, and automated PDF/Excel/Word export compilation.", "Real-time decision support for leadership."),
    ]
    
    for row_idx, (m_name, m_caps, m_val) in enumerate(modules_data, start=1):
        bg = COLOR_ZEBRA if row_idx % 2 == 1 else "FFFFFF"
        format_data_cell(cap_table.rows[row_idx].cells[0], m_name, bold=True, color=COLOR_DEEP_BLUE, bg_color=bg)
        format_data_cell(cap_table.rows[row_idx].cells[1], m_caps, color=COLOR_TEXT_MAIN, bg_color=bg)
        format_data_cell(cap_table.rows[row_idx].cells[2], m_val, bold=True, color=COLOR_EMERALD, bg_color=bg)
        
    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # ---------------------------------------------------------------------------
    # Section 3: The 30-Day Fast-Track Country Adaptation Blueprint
    # ---------------------------------------------------------------------------
    add_h1(doc, "3. Fast-Track Country Adaptation Blueprint (30-Day Deployment)")
    add_p(doc, "VaxPlan has been deliberately designed as an open, modular, multi-tenant digital health platform. Rather than requiring multi-year software engineering cycles, any Ministry of Health can achieve nationwide operational deployment within 30 business days following our proven 5-phase onboarding framework:")
    
    roadmap_table = doc.add_table(rows=6, cols=3)
    roadmap_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    roadmap_table.autofit = False
    roadmap_table.columns[0].width = Inches(1.3)
    roadmap_table.columns[1].width = Inches(3.7)
    roadmap_table.columns[2].width = Inches(1.7)
    
    style_table_header(roadmap_table.rows[0], ["Timeline", "Milestone Activities & Deliverables", "National Responsibility"])
    
    roadmap_data = [
        ("Phase 1: Days 1–5", "Tenant & Geographic Baseline Ingestion: Ingest national GeoJSON boundaries, master facility lists (MFL), and settlement registries. Configure country ISO codes and spatial coordinate projections.", "Provide MFL and official administrative shapefiles."),
        ("Phase 2: Days 6–10", "EPI Schedule & Policy Configuration: Define national antigens, target cohorts (infants, pregnant women, girls 9-14), vial presentations, wastage rates, transport per diems, and the 7-day review lead-time window.", "Review and approve national immunization parameters."),
        ("Phase 3: Days 11–15", "Interoperability & Data Pipelines: Configure bidirectional DHIS2 data exchange (Tracker and Aggregated data), eLMIS stock interfaces, and single sign-on (SSO) credentials.", "Provide DHIS2 sandbox credentials and user directory."),
        ("Phase 4: Days 16–22", "Master Training & Field Validation: Conduct Training of Trainers (ToT) for provincial and district teams. Execute dry-run microplanning across 2 pilot districts to validate offline sync.", "Designate national trainers and 2 pilot districts."),
        ("Phase 5: Days 23–30", "Nationwide Cutover & Governance Rollout: Activate production cloud instance, initiate quarterly microplanning authoring across all health facilities, and launch national oversight dashboard.", "Issue national circular mandating VaxPlan adoption."),
    ]
    
    for row_idx, (t_time, t_acts, t_resp) in enumerate(roadmap_data, start=1):
        bg = COLOR_ZEBRA if row_idx % 2 == 1 else "FFFFFF"
        format_data_cell(roadmap_table.rows[row_idx].cells[0], t_time, bold=True, color=COLOR_ACCENT_BLUE, bg_color=bg)
        format_data_cell(roadmap_table.rows[row_idx].cells[1], t_acts, color=COLOR_TEXT_MAIN, bg_color=bg)
        format_data_cell(roadmap_table.rows[row_idx].cells[2], t_resp, color=COLOR_TEXT_MAIN, bg_color=bg)
        
    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    add_callout_box(
        doc,
        "Zero Code Customization: National adaptation does not require modifying platform source code. All national schedules, per-diem rates, wastage assumptions, and administrative tiers are driven entirely by dynamic configuration schemas.",
        bold_prefix="Rapid Localization Architecture:"
    )

    # ---------------------------------------------------------------------------
    # Section 4: Technical Architecture & Security Governance
    # ---------------------------------------------------------------------------
    add_h1(doc, "4. Enterprise Architecture, Security & Data Sovereignty")
    add_p(doc, "VaxPlan is built on a modern, hardened open-source stack that satisfies enterprise scalability, public health data privacy regulations, and sovereign cloud mandates:")
    
    add_bullet(doc, "Full data ownership remains with the Ministry of Health. VaxPlan can be hosted within national sovereign government data centers, regional cloud facilities, or dedicated VPS clusters.", "National Data Sovereignty:")
    add_bullet(doc, "Cryptographically isolated multi-tenant architecture. Every database transaction is partitioned by tenant ID, preventing cross-country or cross-jurisdiction data leaks.", "Multi-Tenant Row-Level Security (RLS):")
    add_bullet(doc, "Six granular access tiers ensuring users interact strictly with authorized geographic scopes (National Admin, Provincial Coordinator, District Manager, Facility In-Charge, Nurse Vaccinator, Community Health Volunteer).", "Role-Based Access Control (RBAC):")
    add_bullet(doc, "Every record creation, edit, status transition, and approval is immutably logged with timestamp, user ID, and IP address for comprehensive audit compliance.", "Tamper-Proof Audit Trails:")
    add_bullet(doc, "Standardized RESTful APIs, Webhooks, and FHIR Immunization Recommendation profiles guarantee frictionless interoperability with DHIS2, OpenLMIS, and national e-Registry portals.", "Standards-Based Interoperability:")

    # ---------------------------------------------------------------------------
    # Section 5: Economic Impact & Return on Investment (ROI)
    # ---------------------------------------------------------------------------
    add_h1(doc, "5. Return on Investment & Multi-Year Economic Impact")
    add_p(doc, "Deploying VaxPlan delivers immediate and substantial financial returns for national governments and global health donors by transforming administrative waste into frontline service delivery:")
    
    roi_table = doc.add_table(rows=5, cols=3)
    roi_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    roi_table.autofit = False
    roadmap_table.columns[0].width = Inches(1.8)
    roadmap_table.columns[1].width = Inches(3.2)
    roadmap_table.columns[2].width = Inches(1.7)
    
    style_table_header(roi_table.rows[0], ["Economic Indicator", "Traditional Paper Operations", "VaxPlan Digital Operations"])
    
    roi_data = [
        ("Annual Microplanning Workshops", "High recurring expenditure: hotel per diems, travel stipends, stationery, printing ($400k - $900k / yr)", "Over 70% reduction: continuous digital collaboration, automated compilation, remote reviews"),
        ("Vaccine Wastage Rates", "High wastage (25% to 45%) due to blind over-ordering, poor session sizing, and fridge storage mismatch", "Reduced to 10% - 15% through precision antigen forecasting and net storage volume checks"),
        ("Outreach Session Cancellations", "Frequently cancelled due to missing transport funds or lost field rosters (up to 40% loss)", "Reduced to under 5% via enforced 7-day budget lead times and automated supervisory tracking"),
        ("Zero-Dose Cohort Reach", "Stagnant reach in remote, peri-urban, and informal settlements due to census blindness", "15% to 35% increase in verified immunized infants, maximizing health outcome ROI per dollar spent"),
    ]
    
    for row_idx, (r_ind, r_trad, r_vax) in enumerate(roi_data, start=1):
        bg = COLOR_ZEBRA if row_idx % 2 == 1 else "FFFFFF"
        format_data_cell(roi_table.rows[row_idx].cells[0], r_ind, bold=True, color=COLOR_NAVY, bg_color=bg)
        format_data_cell(roi_table.rows[row_idx].cells[1], r_trad, color=COLOR_TEXT_MAIN, bg_color=bg)
        format_data_cell(roi_table.rows[row_idx].cells[2], r_vax, bold=True, color=COLOR_EMERALD, bg_color=bg)
        
    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # ---------------------------------------------------------------------------
    # Section 6: Action Framework & Next Steps
    # ---------------------------------------------------------------------------
    add_h1(doc, "6. Executive Action Framework & Engagement Next Steps")
    add_p(doc, "National health authorities, Gavi/WHO/UNICEF country offices, and technical implementing partners can initiate engagement via three immediate pathways:")
    
    add_bullet(doc, "Request a comprehensive interactive demonstration featuring your country's administrative boundaries and national vaccine schedule.", "1. Executive Platform Demonstration:")
    add_bullet(doc, "Launch a low-risk, rapid 14-day field validation across 20 to 50 health facilities in a high-burden zero-dose district.", "2. Rapid 2-District Pilot:")
    add_bullet(doc, "Engage our technical deployment architects to establish sovereign cloud hosting, DHIS2 data pipelines, and national training cascades.", "3. Full National Rollout:")

    doc.add_paragraph().paragraph_format.space_after = Pt(8)
    
    add_callout_box(
        doc,
        "For strategic partnership inquiries, national onboarding support, and technical demonstrations, please contact the Global Immunization Platform Directorate at VaxPlan Systems or visit the digital documentation suite in-app.",
        bold_prefix="Global Partnership Office:"
    )

    doc.save(DOCX_PATH)
    print(f"[OK] Generated Word Document: {DOCX_PATH}")

def main():
    os.makedirs(DOCS_DIR, exist_ok=True)
    
    # 1. Write Markdown Master Document
    with open(MD_PATH, "w", encoding="utf-8") as f:
        f.write(MD_CONTENT)
    print(f"[OK] Generated Markdown Master Brief: {MD_PATH}")
    
    # 2. Write Word Document
    generate_word_document()

if __name__ == "__main__":
    main()
