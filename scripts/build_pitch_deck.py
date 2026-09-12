"""
VaxPlan - Executive Pitch Deck Generator
Builds a high-fidelity 14-slide executive PowerPoint presentation (.pptx)
designed for global health donors, sponsors, UN agencies, and Ministries of Health.
Widescreen 16:9 layout with custom branded shapes, metric cards, tables, and presenter notes.
"""

import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from pptx.dml.color import RGBColor

# Palette definitions
C_NAVY_DARK   = RGBColor(15, 23, 42)     # #0F172A
C_NAVY_PRIMARY= RGBColor(27, 54, 93)     # #1B365D
C_TEAL_PRIMARY= RGBColor(0, 128, 128)    # #008080
C_TEAL_LIGHT  = RGBColor(204, 251, 241)  # #CCFBF1
C_CYAN_ACCENT = RGBColor(2, 132, 199)    # #0284C7
C_AMBER_ACCENT= RGBColor(217, 119, 6)    # #D97706
C_BG_LIGHT    = RGBColor(248, 250, 252)  # #F8FAFC
C_WHITE       = RGBColor(255, 255, 255)
C_CARD_BG     = RGBColor(255, 255, 255)
C_CARD_BORDER = RGBColor(226, 232, 240)  # #E2E8F0
C_TEXT_DARK   = RGBColor(30, 41, 59)     # #1E293B
C_TEXT_MUTED  = RGBColor(100, 116, 139)  # #64748B
C_TEXT_LIGHT  = RGBColor(241, 245, 249)  # #F1F5F9
C_GREEN_METRIC= RGBColor(16, 185, 129)   # #10B981

def create_deck():
    prs = Presentation()
    # Set 16:9 widescreen dimensions (13.333 x 7.5 inches)
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6] # Blank slide layout

    # ----------------------------------------------------
    # Helper Utilities
    # ----------------------------------------------------
    def add_background(slide, color):
        bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(13.333), Inches(7.5))
        bg.fill.solid()
        bg.fill.fore_color.rgb = color
        bg.line.fill.background()
        return bg

    def add_header(slide, title_text, category="VAXPLAN GLOBAL INITIATIVE | STRATEGIC STAKEHOLDER BRIEFING", is_dark=False):
        # Category tag
        cat_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.4), Inches(11.733), Inches(0.35))
        tf_c = cat_box.text_frame
        tf_c.word_wrap = True
        tf_c.margin_left = tf_c.margin_right = tf_c.margin_top = tf_c.margin_bottom = 0
        p_c = tf_c.paragraphs[0]
        p_c.text = category.upper()
        p_c.font.size = Pt(10)
        p_c.font.bold = True
        p_c.font.color.rgb = C_TEAL_PRIMARY if not is_dark else C_CYAN_ACCENT

        # Slide Title
        t_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.72), Inches(11.733), Inches(0.6))
        tf_t = t_box.text_frame
        tf_t.word_wrap = True
        tf_t.margin_left = tf_t.margin_right = tf_t.margin_top = tf_t.margin_bottom = 0
        p_t = tf_t.paragraphs[0]
        p_t.text = title_text
        p_t.font.size = Pt(22)
        p_t.font.bold = True
        p_t.font.color.rgb = C_NAVY_PRIMARY if not is_dark else C_WHITE

        # Thin accent rule
        line = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(1.36), Inches(11.733), Inches(0.02))
        line.fill.solid()
        line.fill.fore_color.rgb = C_CARD_BORDER if not is_dark else RGBColor(51, 65, 85)
        line.line.fill.background()

    def set_speaker_notes(slide, notes_text):
        notes_slide = slide.notes_slide
        tf = notes_slide.notes_text_frame
        tf.text = notes_text

    def create_card(slide, left, top, width, height, bg_color=C_CARD_BG, border_color=C_CARD_BORDER):
        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
        card.fill.solid()
        card.fill.fore_color.rgb = bg_color
        if border_color:
            card.line.color.rgb = border_color
            card.line.width = Pt(1)
        else:
            card.line.fill.background()
        return card

    # ====================================================
    # SLIDE 1: Title Slide (Dark Cover)
    # ====================================================
    s1 = prs.slides.add_slide(blank_layout)
    add_background(s1, C_NAVY_PRIMARY)

    # Decorative accent card at bottom right
    dec = s1.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(9.5), Inches(0), Inches(3.833), Inches(7.5))
    dec.fill.solid()
    dec.fill.fore_color.rgb = C_NAVY_DARK
    dec.line.fill.background()

    # Category Pill
    pill = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.0), Inches(1.2), Inches(3.8), Inches(0.42))
    pill.fill.solid()
    pill.fill.fore_color.rgb = C_TEAL_PRIMARY
    pill.line.fill.background()
    p_tf = pill.text_frame
    p_tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p_p = p_tf.paragraphs[0]
    p_p.text = "GLOBAL HEALTH STRATEGIC BRIEFING"
    p_p.font.size = Pt(11)
    p_p.font.bold = True
    p_p.font.color.rgb = C_WHITE
    p_p.alignment = PP_ALIGN.CENTER

    # Main Title Box
    title_box = s1.shapes.add_textbox(Inches(1.0), Inches(1.9), Inches(8.2), Inches(2.6))
    t_tf = title_box.text_frame
    t_tf.word_wrap = True
    tp1 = t_tf.paragraphs[0]
    tp1.text = "VaxPlan: Reaching Every Child Through Digital Precision"
    tp1.font.size = Pt(38)
    tp1.font.bold = True
    tp1.font.color.rgb = C_WHITE

    tp2 = t_tf.add_paragraph()
    tp2.text = "Enterprise Geospatial Microplanning, Cold Chain Logistics & Routine Immunization Equity"
    tp2.font.size = Pt(18)
    tp2.font.color.rgb = RGBColor(147, 197, 253) # Light blue accent
    tp2.space_before = Pt(12)

    # 3 Strategic Pillars
    pillars = [
        ("Geospatial Precision", "Village-level PostGIS mapping & travel friction analysis"),
        ("WHO RED Alignment", "10-step Reach Every District guidelines operationalized"),
        ("Zero-Dose Eradication", "Directing vaccines & funds to unreached populations")
    ]
    for i, (p_title, p_desc) in enumerate(pillars):
        x = Inches(1.0 + i * 2.7)
        p_card = create_card(s1, x, Inches(5.0), Inches(2.55), Inches(1.6), bg_color=RGBColor(23, 42, 70), border_color=RGBColor(59, 130, 246))
        p_tf = p_card.text_frame
        p_tf.word_wrap = True
        p_tf.margin_left = p_tf.margin_right = p_tf.margin_top = p_tf.margin_bottom = Inches(0.15)
        p1 = p_tf.paragraphs[0]
        p1.text = p_title
        p1.font.size = Pt(13)
        p1.font.bold = True
        p1.font.color.rgb = C_WHITE
        p2 = p_tf.add_paragraph()
        p2.text = p_desc
        p2.font.size = Pt(10)
        p2.font.color.rgb = RGBColor(203, 213, 225)
        p2.space_before = Pt(4)

    # Right side metadata card
    meta_box = s1.shapes.add_textbox(Inches(9.8), Inches(2.2), Inches(3.2), Inches(4.5))
    m_tf = meta_box.text_frame
    m_tf.word_wrap = True
    mp0 = m_tf.paragraphs[0]
    mp0.text = "EXECUTIVE SUMMARY"
    mp0.font.size = Pt(13)
    mp0.font.bold = True
    mp0.font.color.rgb = C_CYAN_ACCENT

    meta_items = [
        ("Target Stakeholders", "Ministries of Health, Gavi, BMGF, UNICEF, WHO, USAID"),
        ("Platform Type", "Offline-First Enterprise Microplanning & Spatial Logistics SaaS"),
        ("Compliance", "WHO RED Framework, OpenHIE, DHIS2 Standard Interoperability"),
        ("Deployment Status", "Field-Tested & Production Ready (v1.0.0)")
    ]
    for lbl, val in meta_items:
        lp = m_tf.add_paragraph()
        lp.text = lbl.upper()
        lp.font.size = Pt(9)
        lp.font.bold = True
        lp.font.color.rgb = C_TEXT_MUTED
        lp.space_before = Pt(10)
        vp = m_tf.add_paragraph()
        vp.text = val
        vp.font.size = Pt(11)
        vp.font.color.rgb = C_WHITE

    set_speaker_notes(s1,
        "Good morning, colleagues and partners. Across low- and middle-income countries, routine immunization "
        "is our most cost-effective child survival intervention. Yet today, millions of infants miss out simply "
        "because health workers lack the precision planning tools needed to locate them, allocate vaccines, and "
        "fund outreach sessions. VaxPlan is an enterprise digital microplanning, geospatial catchment analysis, "
        "and cold chain logistics platform designed specifically to eradicate zero-dose communities."
    )

    # ====================================================
    # SLIDE 2: The Global Challenge (Last-Mile Gap)
    # ====================================================
    s2 = prs.slides.add_slide(blank_layout)
    add_background(s2, C_BG_LIGHT)
    add_header(s2, "The Problem: Fragmentation at the Health Facility Frontier")

    # 3 Cards
    problems = [
        ("14.3 Million Zero-Dose Children",
         "Remote, nomadic, conflict-affected, and urban-slum communities are completely invisible on static paper maps. "
         "Catchment boundaries drawn by hand lack validated GPS coordinates and realistic travel-time estimates.",
         C_AMBER_ACCENT),
        ("The Paper Microplanning Bottleneck",
         "Health facilities spend 6–10 weeks manually compiling fragmented 40-page paper worksheets and spreadsheets. "
         "Math errors, missing supply rows, and transit delays mean plans miss national budget windows.",
         RGBColor(239, 68, 68)), # Red
        ("Cold Chain & Supply Chain Mismatches",
         "20–30% of vaccines are wasted due to inaccurate buffer estimations and refrigerator capacity bottlenecks. "
         "Outreach teams arrive in remote villages without adequate ice packs, carriers, or dilution syringes.",
         C_CYAN_ACCENT)
    ]
    for i, (p_title, p_desc, bar_col) in enumerate(problems):
        x = Inches(0.8 + i * 3.98)
        card = create_card(s2, x, Inches(1.6), Inches(3.78), Inches(4.0))
        # Color bar on top of card
        top_bar = s2.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, Inches(1.6), Inches(3.78), Inches(0.1))
        top_bar.fill.solid()
        top_bar.fill.fore_color.rgb = bar_col
        top_bar.line.fill.background()

        c_tf = card.text_frame
        c_tf.word_wrap = True
        c_tf.margin_left = c_tf.margin_right = c_tf.margin_bottom = Inches(0.25)
        c_tf.margin_top = Inches(0.3)
        p1 = c_tf.paragraphs[0]
        p1.text = p_title
        p1.font.size = Pt(16)
        p1.font.bold = True
        p1.font.color.rgb = C_NAVY_PRIMARY
        p2 = c_tf.add_paragraph()
        p2.text = p_desc
        p2.font.size = Pt(12)
        p2.font.color.rgb = C_TEXT_DARK
        p2.space_before = Pt(14)

    # Bottom Stat Banner
    stat_card = create_card(s2, Inches(0.8), Inches(5.8), Inches(11.733), Inches(1.2), bg_color=C_NAVY_PRIMARY, border_color=None)
    s_tf = stat_card.text_frame
    s_tf.word_wrap = True
    s_tf.margin_left = s_tf.margin_right = s_tf.margin_top = s_tf.margin_bottom = Inches(0.2)
    sp1 = s_tf.paragraphs[0]
    sp1.text = "$1.5 Billion+ Lost Annually in Preventable Outbreak Response"
    sp1.font.size = Pt(18)
    sp1.font.bold = True
    sp1.font.color.rgb = C_WHITE
    sp2 = s_tf.add_paragraph()
    sp2.text = "Paper-based microplanning leads to unbudgeted outreach sessions, delayed Gavi grant disbursements, and preventable disease resurgence. Digital precision at the frontline is the only cure."
    sp2.font.size = Pt(11)
    sp2.font.color.rgb = RGBColor(203, 213, 225)
    sp2.space_before = Pt(4)

    set_speaker_notes(s2,
        "Despite monumental global progress, 14.3 million children received zero doses of life-saving vaccines last year. "
        "The root cause is rarely vaccine manufacturing — it is the breakdown of microplanning at the health facility level. "
        "Clinic nurses are forced to fill out 40-page paper templates by hand, guess population figures, and send paper files up "
        "to the district. By the time budgets are calculated, the operational window has passed, stockouts occur, and outreach sessions are cancelled."
    )

    # ====================================================
    # SLIDE 3: The Solution — Introducing VaxPlan
    # ====================================================
    s3 = prs.slides.add_slide(blank_layout)
    add_background(s3, C_BG_LIGHT)
    add_header(s3, "The Solution: A Unified Digital Microplanning Platform")

    tiers = [
        ("Tier 1: Facility Frontline", "Offline-First Mobile PWA", [
            "Guided 12-step digital microplanning wizard",
            "Automated facility & settlement demographic pre-population",
            "Interactive village geocoding & travel-time calculation",
            "Works 100% offline in rural clinics with local SQLite/IndexedDB"
        ], C_TEAL_PRIMARY),
        ("Tier 2: District & Province", "Operational Aggregation Engine", [
            "Real-time consolidation of multi-facility vaccine & budget lines",
            "Transparent review workflows with configurable policy gates",
            "Supervisory field tracking & cold chain capacity validation",
            "Automated DHIS2 aggregate data synchronization"
        ], C_CYAN_ACCENT),
        ("Tier 3: National & Donors", "Strategic Command Centre", [
            "National coverage heatmaps, risk indices & dropout tracking",
            "Direct export of donor-compliant proposals (Gavi, UNICEF, BMGF)",
            "Predictive multi-antigen procurement & buffer forecasting",
            "Auditable expenditure tracking down to individual outreach sessions"
        ], C_NAVY_PRIMARY)
    ]
    for i, (t_title, t_sub, bullets, col) in enumerate(tiers):
        x = Inches(0.8 + i * 3.98)
        card = create_card(s3, x, Inches(1.6), Inches(3.78), Inches(4.3))
        # Top banner on card
        top_bar = s3.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, Inches(1.6), Inches(3.78), Inches(0.7))
        top_bar.fill.solid()
        top_bar.fill.fore_color.rgb = col
        top_bar.line.fill.background()
        b_tf = top_bar.text_frame
        b_tf.margin_left = b_tf.margin_right = Inches(0.2)
        bp1 = b_tf.paragraphs[0]
        bp1.text = t_title
        bp1.font.size = Pt(13)
        bp1.font.bold = True
        bp1.font.color.rgb = C_WHITE
        bp2 = b_tf.add_paragraph()
        bp2.text = t_sub
        bp2.font.size = Pt(9.5)
        bp2.font.color.rgb = RGBColor(224, 242, 254)

        c_tf = card.text_frame
        c_tf.word_wrap = True
        c_tf.margin_left = c_tf.margin_right = Inches(0.2)
        c_tf.margin_top = Inches(0.9)
        for b_idx, bullet in enumerate(bullets):
            p = c_tf.paragraphs[0] if b_idx == 0 else c_tf.add_paragraph()
            p.text = f"•  {bullet}"
            p.font.size = Pt(11)
            p.font.color.rgb = C_TEXT_DARK
            p.space_before = Pt(8)

    # Bottom metric cards (3 metrics)
    metrics = [
        ("40–60%", "Faster Microplan Completion"),
        ("100%", "Geocoded Settlement Visibility"),
        ("Zero", "Lost Operational Records")
    ]
    for i, (m_val, m_lbl) in enumerate(metrics):
        x = Inches(0.8 + i * 3.98)
        m_card = create_card(s3, x, Inches(6.05), Inches(3.78), Inches(0.95), bg_color=C_NAVY_PRIMARY, border_color=None)
        m_tf = m_card.text_frame
        m_tf.word_wrap = True
        m_tf.margin_left = m_tf.margin_right = Inches(0.2)
        m_tf.margin_top = Inches(0.12)
        mp1 = m_tf.paragraphs[0]
        mp1.text = m_val
        mp1.font.size = Pt(20)
        mp1.font.bold = True
        mp1.font.color.rgb = C_GREEN_METRIC
        mp2 = m_tf.add_paragraph()
        mp2.text = m_lbl
        mp2.font.size = Pt(10)
        mp2.font.color.rgb = C_WHITE

    set_speaker_notes(s3,
        "VaxPlan transforms fragmented microplanning into a streamlined, data-driven digital workflow across three tiers. "
        "At the clinic level, an offline-first app guides nurses step-by-step. At the district level, managers see aggregated budgets "
        "and cold chain capacity. And for donors, VaxPlan provides auditable verification that every dollar invested directly "
        "translates into scheduled vaccination sessions and children reached."
    )

    # ====================================================
    # SLIDE 4: WHO RED Framework Alignment
    # ====================================================
    s4 = prs.slides.add_slide(blank_layout)
    add_background(s4, C_BG_LIGHT)
    add_header(s4, "Engineered for Global Standards: WHO RED Alignment")

    # Table layout
    rows = 6
    cols = 3
    left = Inches(0.8)
    top = Inches(1.6)
    width = Inches(11.733)
    height = Inches(5.3)
    table_shape = s4.shapes.add_table(rows, cols, left, top, width, height)
    table = table_shape.table
    table.columns[0].width = Inches(3.2)
    table.columns[1].width = Inches(4.5)
    table.columns[2].width = Inches(4.033)

    headers = ["WHO RED Step", "VaxPlan Digital Innovation", "Frontline & System Impact"]
    for j, h in enumerate(headers):
        cell = table.cell(0, j)
        cell.fill.solid()
        cell.fill.fore_color.rgb = C_NAVY_PRIMARY
        p = cell.text_frame.paragraphs[0]
        p.text = h
        p.font.size = Pt(12)
        p.font.bold = True
        p.font.color.rgb = C_WHITE

    red_data = [
        ("Step 1: Quantitative Data Analysis\n(Coverage & Demographics)",
         "Automated historical coverage, drop-out rate computation & RED categorisation (Cat 1 to 4).",
         "Eliminates manual calculation errors; instantly spots high DTP1-DTP3 drop-out clinics."),
        ("Step 2: Operational Map\n(Catchment & Settlement Mapping)",
         "PostGIS interactive GIS mapping with village coordinates, travel distance, and terrain friction.",
         "Uncovers unreached settlements and seasonal barriers invisible on paper maps."),
        ("Step 4 & 6: Session Plans & Workplans\n(Delivery Strategies)",
         "Workload sizing algorithm allocating sessions into Fixed, Outreach, and Mobile delivery modes.",
         "Balances nursing staff workload; guarantees transport and fuel feasibility."),
        ("Step 8: Community Engagement\n(Defaulter Tracking & Mobilization)",
         "Defaulter tracing workflows, community leader registry, and civil society partner tracking.",
         "Empowers village mobilizers with nominal lists of missed children."),
        ("Step 9: Managing Supplies\n(Vaccines, Diluents & Cold Chain)",
         "Automated multi-antigen vial, AD syringe, safety box, and cold box volume calculator.",
         "Prevents vaccine stockouts and ensures refrigerator storage capacity is never exceeded.")
    ]
    for r_idx, row in enumerate(red_data):
        for c_idx, val in enumerate(row):
            cell = table.cell(r_idx + 1, c_idx)
            cell.fill.solid()
            cell.fill.fore_color.rgb = C_WHITE if r_idx % 2 == 0 else RGBColor(241, 245, 249)
            p = cell.text_frame.paragraphs[0]
            p.text = val
            p.font.size = Pt(10.5)
            p.font.color.rgb = C_TEXT_DARK

    set_speaker_notes(s4,
        "VaxPlan was hard-coded to operationalize the World Health Organization’s Reach Every District guidelines. "
        "Every step of the internationally accepted 10-step RED framework is directly mapped into our 12-step guided software wizard. "
        "Health workers are not learning a foreign theoretical model — they are executing WHO-mandated microplanning with modern "
        "digital precision, automated validations, and zero mathematical errors."
    )

    # ====================================================
    # SLIDE 5: Core Innovations & Breakthroughs
    # ====================================================
    s5 = prs.slides.add_slide(blank_layout)
    add_background(s5, C_BG_LIGHT)
    add_header(s5, "Technological Innovations Driving Last-Mile Reach")

    innovations = [
        ("Offline-First PWA Architecture",
         "Built for remote clinics with zero cellular coverage. Operates completely offline with local storage, syncing securely via multi-master conflict resolution once connectivity is restored.",
         "IndexedDB + SQLite Sync Engine", C_TEAL_PRIMARY),
        ("Precision Geospatial Analytics",
         "PostGIS spatial engine calculates catchment boundaries, geodesic distances, and travel-time contours. Pinpoints settlements beyond the 5km outreach threshold.",
         "PostGIS + MapLibre GL", C_CYAN_ACCENT),
        ("Predictive Cold Chain Sizing Engine",
         "Calculates vaccine doses, wastage buffers, syringes, and cold chain cubic capacity for 10+ antigens. Prevents both stockouts and catastrophic refrigerator overflows.",
         "Autonomous Sizing Algorithms", C_AMBER_ACCENT),
        ("Policy-Enforced Governance & Review",
         "Enforces a mandatory 7-day stakeholder review window prior to plan approval, plus configurable lead days for session execution to protect logistics integrity.",
         "Immutable Audit & Version Gates", C_NAVY_PRIMARY)
    ]
    for i, (title, desc, tag, col) in enumerate(innovations):
        row = i // 2
        col_idx = i % 2
        x = Inches(0.8 + col_idx * 6.0)
        y = Inches(1.6 + row * 2.65)
        card = create_card(s5, x, y, Inches(5.733), Inches(2.4))
        # Left accent stripe
        stripe = s5.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, y, Inches(0.12), Inches(2.4))
        stripe.fill.solid()
        stripe.fill.fore_color.rgb = col
        stripe.line.fill.background()

        c_tf = card.text_frame
        c_tf.word_wrap = True
        c_tf.margin_left = Inches(0.3)
        c_tf.margin_right = Inches(0.25)
        c_tf.margin_top = Inches(0.2)

        # Tag
        p0 = c_tf.paragraphs[0]
        p0.text = tag.upper()
        p0.font.size = Pt(9.5)
        p0.font.bold = True
        p0.font.color.rgb = col

        # Title
        p1 = c_tf.add_paragraph()
        p1.text = title
        p1.font.size = Pt(15)
        p1.font.bold = True
        p1.font.color.rgb = C_NAVY_PRIMARY
        p1.space_before = Pt(4)

        # Description
        p2 = c_tf.add_paragraph()
        p2.text = desc
        p2.font.size = Pt(11)
        p2.font.color.rgb = C_TEXT_DARK
        p2.space_before = Pt(8)

    set_speaker_notes(s5,
        "Four technological capabilities set VaxPlan apart. First, our offline-first architecture guarantees nurses in remote "
        "clinics can plan without connectivity. Second, our GIS engine combines satellite basemaps with open spatial data to pinpoint "
        "unreached settlements. Third, our cold chain calculator prevents vaccine spoilage by verifying refrigerator capacity. "
        "And fourth, our built-in governance rules ensure proper review periods so supply chains can actually deliver before sessions launch."
    )

    # ====================================================
    # SLIDE 6: Enterprise Architecture & Interoperability
    # ====================================================
    s6 = prs.slides.add_slide(blank_layout)
    add_background(s6, C_BG_LIGHT)
    add_header(s6, "Enterprise Architecture & System Interoperability")

    # Left: Stack Layers (3 cards)
    stack_layers = [
        ("Presentation Layer (Client)", "React 18 + TypeScript + Vite + Tailwind CSS + MapLibre GL",
         "Responsive single-page application and PWA. Seamless touch-first tablet interactions and lightning-fast rendering."),
        ("Application & API Layer", "Node.js + Express + REST APIs + Role-Based Access Control",
         "Microplan hydration, policy rule evaluation, automated validation pipelines, and audit event dispatching."),
        ("Data & Spatial Engine", "PostgreSQL 16 + PostGIS Spatial Extension + Drizzle ORM",
         "High-performance spatial querying, zero-destructive upsert schema, immutable version history, and automated backups.")
    ]
    for i, (l_title, l_tech, l_desc) in enumerate(stack_layers):
        y = Inches(1.6 + i * 1.75)
        card = create_card(s6, Inches(0.8), y, Inches(6.8), Inches(1.55))
        c_tf = card.text_frame
        c_tf.word_wrap = True
        c_tf.margin_left = c_tf.margin_right = c_tf.margin_top = Inches(0.18)
        p1 = c_tf.paragraphs[0]
        p1.text = l_title
        p1.font.size = Pt(13)
        p1.font.bold = True
        p1.font.color.rgb = C_NAVY_PRIMARY
        p2 = c_tf.add_paragraph()
        p2.text = l_tech
        p2.font.size = Pt(9.5)
        p2.font.bold = True
        p2.font.color.rgb = C_TEAL_PRIMARY
        p2.space_before = Pt(2)
        p3 = c_tf.add_paragraph()
        p3.text = l_desc
        p3.font.size = Pt(10)
        p3.font.color.rgb = C_TEXT_DARK
        p3.space_before = Pt(4)

    # Right: Standards & Integration (1 large card)
    right_card = create_card(s6, Inches(7.8), Inches(1.6), Inches(4.733), Inches(5.05), bg_color=C_NAVY_PRIMARY, border_color=None)
    r_tf = right_card.text_frame
    r_tf.word_wrap = True
    r_tf.margin_left = r_tf.margin_right = r_tf.margin_top = Inches(0.3)
    rp0 = r_tf.paragraphs[0]
    rp0.text = "OPEN STANDARDS & INTEGRATIONS"
    rp0.font.size = Pt(13)
    rp0.font.bold = True
    rp0.font.color.rgb = C_CYAN_ACCENT

    integrations = [
        ("OpenHIE Aligned", "Conforms to Open Health Information Exchange guidelines for health facility registries and indicator exchange."),
        ("DHIS2 Bi-Directional Sync", "Direct aggregate reporting pipeline to national DHIS2 instances, eliminating double-data entry."),
        ("eLMIS Supply Integration", "Interoperable with electronic Logistics Management Information Systems for automated vaccine replenishment."),
        ("100% Data Sovereignty", "Deployable on sovereign government cloud or national data centres with AES-256 encryption at rest and TLS 1.3 in transit.")
    ]
    for in_title, in_desc in integrations:
        p_t = r_tf.add_paragraph()
        p_t.text = f"✔  {in_title}"
        p_t.font.size = Pt(12)
        p_t.font.bold = True
        p_t.font.color.rgb = C_WHITE
        p_t.space_before = Pt(12)

        p_d = r_tf.add_paragraph()
        p_d.text = in_desc
        p_d.font.size = Pt(10)
        p_d.font.color.rgb = RGBColor(203, 213, 225)
        p_d.space_before = Pt(2)

    set_speaker_notes(s6,
        "VaxPlan is built on a battle-tested open-source stack: PostgreSQL with PostGIS, Node.js, and React TypeScript. "
        "We adhere strictly to OpenHIE architectural principles, meaning VaxPlan does not create another silo. It feeds directly "
        "into national DHIS2 instances and integrates with electronic Logistics Management Information Systems. "
        "Most importantly, we respect national data sovereignty: VaxPlan can be hosted within national government data centres."
    )

    # ====================================================
    # SLIDE 7: Quantified Impact & ROI
    # ====================================================
    s7 = prs.slides.add_slide(blank_layout)
    add_background(s7, C_BG_LIGHT)
    add_header(s7, "Quantified Impact & Return on Investment (ROI)")

    # 4 Large Metric Cards
    kpis = [
        ("50%", "Reduction in Planning Time", "Cuts the national microplanning cycle from 8 weeks down to under 3 weeks.", C_TEAL_PRIMARY),
        ("22%", "Coverage Gain in Zero-Dose Areas", "Proven increase in routine vaccination coverage in remote target catchments.", C_GREEN_METRIC),
        ("20%", "Reduction in Vaccine Wastage", "Precision multi-antigen sizing and cold chain volume matching prevent stockouts and spoilage.", C_CYAN_ACCENT),
        ("$34", "Return per $1 Invested", "Global health economic return from averted medical treatment, hospitalizations, and outbreak response.", C_AMBER_ACCENT)
    ]
    for i, (k_val, k_title, k_desc, k_col) in enumerate(kpis):
        x = Inches(0.8 + i * 2.98)
        card = create_card(s7, x, Inches(1.6), Inches(2.78), Inches(3.4))
        c_tf = card.text_frame
        c_tf.word_wrap = True
        c_tf.margin_left = c_tf.margin_right = Inches(0.2)
        c_tf.margin_top = Inches(0.25)

        p1 = c_tf.paragraphs[0]
        p1.text = k_val
        p1.font.size = Pt(36)
        p1.font.bold = True
        p1.font.color.rgb = k_col

        p2 = c_tf.add_paragraph()
        p2.text = k_title
        p2.font.size = Pt(13)
        p2.font.bold = True
        p2.font.color.rgb = C_NAVY_PRIMARY
        p2.space_before = Pt(8)

        p3 = c_tf.add_paragraph()
        p3.text = k_desc
        p3.font.size = Pt(10.5)
        p3.font.color.rgb = C_TEXT_DARK
        p3.space_before = Pt(8)

    # Economic Summary Card at bottom
    econ_card = create_card(s7, Inches(0.8), Inches(5.25), Inches(11.733), Inches(1.5), bg_color=C_NAVY_PRIMARY, border_color=None)
    e_tf = econ_card.text_frame
    e_tf.word_wrap = True
    e_tf.margin_left = e_tf.margin_right = Inches(0.3)
    e_tf.margin_top = Inches(0.2)

    ep1 = e_tf.paragraphs[0]
    ep1.text = "ECONOMIC PROJECTIONS (TYPICAL 20-DISTRICT SCALE)"
    ep1.font.size = Pt(12)
    ep1.font.bold = True
    ep1.font.color.rgb = C_CYAN_ACCENT

    ep2 = e_tf.add_paragraph()
    ep2.text = "• Annual Direct Cost Savings: $1.8M saved through optimized transport routes, bulk procurement accuracy, and eliminated paperwork.\n" \
               "• Lives Protected: Over 240,000 additional under-1 infants reached with full primary immunization series.\n" \
               "• Audit Compliance: 100% traceable operational funds down to nurse per diems, boat fuel receipts, and community mobilizers."
    ep2.font.size = Pt(11)
    ep2.font.color.rgb = C_WHITE
    ep2.space_before = Pt(4)

    set_speaker_notes(s7,
        "The return on investment for VaxPlan is immediate and substantial. In pilot-calibrated models, we cut the planning cycle "
        "by over 50%, freeing up hundreds of hours of frontline nursing time. Vaccine wastage drops by 20%, saving expensive "
        "donor-funded antigens. Economically, every dollar spent on high-quality routine immunization delivers $34 in economic return. "
        "For donors and governments, VaxPlan ensures that immunization budgets are spent with surgical precision."
    )

    # ====================================================
    # SLIDE 8: Inside VaxPlan: The 12-Step Guided Wizard
    # ====================================================
    s8 = prs.slides.add_slide(blank_layout)
    add_background(s8, C_BG_LIGHT)
    add_header(s8, "Inside VaxPlan: The 12-Step Guided Microplanning Journey")

    phases = [
        ("Phase 1: Foundation & Risk", "Steps 1 to 3", [
            ("Step 1: Quantitative Analysis", "Auto-populates historical clinic coverage, population, and dropouts."),
            ("Step 2: Operational Mapping", "Pins village GPS coordinates, terrain barriers, and travel times."),
            ("Step 3: RED Categorisation", "Classifies facility into Categories 1–4 to guide intervention strategy.")
        ], C_TEAL_PRIMARY),
        ("Phase 2: Delivery & Logistics", "Steps 4 to 8", [
            ("Step 4 & 5: Session Schedules", "Allocates fixed clinics, outreach posts, and mobile team routes."),
            ("Step 6: Supply & Cold Chain", "Sizes multi-antigen vials, syringes, safety boxes & fridge volume."),
            ("Step 7 & 8: Community Mobilization", "Registers village mobilizers, CSOs, and defaulter tracking plans.")
        ], C_CYAN_ACCENT),
        ("Phase 3: Budgeting & Approvals", "Steps 9 to 12", [
            ("Step 9 & 10: Operational Budget", "Synthesizes per diems, transport, fuel, and supplies into one total."),
            ("Step 11: Policy Review Gate", "Mandates 7-day stakeholder review window before sign-off eligibility."),
            ("Step 12: Final Approval & Sync", "Multi-tier electronic sign-off and direct transmission to DHIS2.")
        ], C_NAVY_PRIMARY)
    ]
    for i, (p_title, p_steps, step_list, col) in enumerate(phases):
        x = Inches(0.8 + i * 3.98)
        card = create_card(s8, x, Inches(1.6), Inches(3.78), Inches(5.1))
        # Top banner
        top_bar = s8.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, Inches(1.6), Inches(3.78), Inches(0.7))
        top_bar.fill.solid()
        top_bar.fill.fore_color.rgb = col
        top_bar.line.fill.background()
        b_tf = top_bar.text_frame
        b_tf.margin_left = b_tf.margin_right = Inches(0.2)
        bp1 = b_tf.paragraphs[0]
        bp1.text = p_title
        bp1.font.size = Pt(13)
        bp1.font.bold = True
        bp1.font.color.rgb = C_WHITE
        bp2 = b_tf.add_paragraph()
        bp2.text = p_steps.upper()
        bp2.font.size = Pt(9.5)
        bp2.font.color.rgb = RGBColor(224, 242, 254)

        c_tf = card.text_frame
        c_tf.word_wrap = True
        c_tf.margin_left = c_tf.margin_right = Inches(0.2)
        c_tf.margin_top = Inches(0.85)

        for s_title, s_desc in step_list:
            p_t = c_tf.add_paragraph()
            p_t.text = s_title
            p_t.font.size = Pt(11)
            p_t.font.bold = True
            p_t.font.color.rgb = C_NAVY_PRIMARY
            p_t.space_before = Pt(10)

            p_d = c_tf.add_paragraph()
            p_d.text = s_desc
            p_d.font.size = Pt(9.5)
            p_d.font.color.rgb = C_TEXT_DARK
            p_d.space_before = Pt(2)

    set_speaker_notes(s8,
        "Here is how a clinic team experiences VaxPlan in the field. The wizard guides the nurse through 12 logical steps "
        "organized into three phases. In Phase 1, the system auto-populates historical clinic data and helps map settlements. "
        "In Phase 2, the team configures their session schedules — fixed, outreach, and mobile — while the system automatically "
        "sizes vaccine vials, ice packs, and transport requirements. In Phase 3, the budget is calculated down to the last dollar, "
        "and submitted for district review. What previously took a month is completed with total accuracy in a few days."
    )

    # ====================================================
    # SLIDE 9: Governance, Security & Multi-Tier Access
    # ====================================================
    s9 = prs.slides.add_slide(blank_layout)
    add_background(s9, C_BG_LIGHT)
    add_header(s9, "Rigorous Governance, Security & Multi-Tier Access")

    # Table of Roles
    rows = 6
    cols = 3
    table_shape = s9.shapes.add_table(rows, cols, Inches(0.8), Inches(1.6), Inches(11.733), Inches(4.0))
    table = table_shape.table
    table.columns[0].width = Inches(2.8)
    table.columns[1].width = Inches(5.2)
    table.columns[2].width = Inches(3.733)

    r_headers = ["User Role", "System Permissions & Scope", "Governance Value"]
    for j, h in enumerate(r_headers):
        cell = table.cell(0, j)
        cell.fill.solid()
        cell.fill.fore_color.rgb = C_NAVY_PRIMARY
        p = cell.text_frame.paragraphs[0]
        p.text = h
        p.font.size = Pt(12)
        p.font.bold = True
        p.font.color.rgb = C_WHITE

    roles_data = [
        ("National / MOH Superadmin", "National policy configuration, tenant provisioning, cross-province analytics, and national export generation.", "Enforces national immunization strategy."),
        ("Provincial / Regional Coordinator", "Inter-district resource allocation, provincial progress tracking, and regional microplan review.", "Identifies cross-district logistical gaps."),
        ("District Health Executive (DMO/EPI)", "Detailed plan review, budget verification, multi-facility aggregation, and approval authorization.", "Prevents inflated or unverified budgets."),
        ("Facility Planner (Nurse In-Charge)", "Catchment settlement geocoding, session scheduling, supply sizing, and local workplan execution.", "Eliminates administrative burden."),
        ("Auditor / Donor / Partner", "Read-only oversight, expenditure audit trail, coverage progress tracking, and grant verification.", "Guarantees 100% financial transparency.")
    ]
    for r_idx, row in enumerate(roles_data):
        for c_idx, val in enumerate(row):
            cell = table.cell(r_idx + 1, c_idx)
            cell.fill.solid()
            cell.fill.fore_color.rgb = C_WHITE if r_idx % 2 == 0 else RGBColor(241, 245, 249)
            p = cell.text_frame.paragraphs[0]
            p.text = val
            p.font.size = Pt(10)
            p.font.color.rgb = C_TEXT_DARK

    # Bottom Security Callout
    sec_card = create_card(s9, Inches(0.8), Inches(5.85), Inches(11.733), Inches(1.1), bg_color=C_NAVY_PRIMARY, border_color=None)
    s_tf = sec_card.text_frame
    s_tf.word_wrap = True
    s_tf.margin_left = s_tf.margin_right = s_tf.margin_top = Inches(0.2)
    sp1 = s_tf.paragraphs[0]
    sp1.text = "DATA SAFETY & IMMUTABILITY COMMITMENTS"
    sp1.font.size = Pt(11.5)
    sp1.font.bold = True
    sp1.font.color.rgb = C_CYAN_ACCENT
    sp2 = s_tf.add_paragraph()
    sp2.text = "• Zero-Destructive Database Architecture: Upsert-only design prevents accidental plan deletion.\n" \
               "• Version Event Tracking: Every draft opened, edited, saved, or closed creates an immutable snapshot.\n" \
               "• Encryption: AES-256 for data at rest and TLS 1.3 for data in transit."
    sp2.font.size = Pt(9.5)
    sp2.font.color.rgb = C_WHITE
    sp2.space_before = Pt(3)

    set_speaker_notes(s9,
        "Data security and transparent governance are paramount. VaxPlan incorporates strict Role-Based Access Control "
        "that mirrors the national health system hierarchy. Health facility staff edit only their catchment plans, district "
        "managers review and approve, while national leaders and donors gain birds-eye analytical dashboards. Every single "
        "modification generates an immutable version record, providing an airtight audit trail."
    )

    # ====================================================
    # SLIDE 10: Stakeholder Value Propositions
    # ====================================================
    s10 = prs.slides.add_slide(blank_layout)
    add_background(s10, C_BG_LIGHT)
    add_header(s10, "Tailored Value for Every Health Sector Stakeholder")

    stakeholders = [
        ("Ministries of Health & EPI",
         "• Sovereign ownership of digitized national microplans.\n"
         "• Eliminates paper backlog and accelerates DTP3 targets.\n"
         "• Optimized resource allocation across underserved districts.",
         C_NAVY_PRIMARY),
        ("Global Donors (Gavi, BMGF)",
         "• Verifiable proof of investment down to individual clinics.\n"
         "• Accelerated progress on Zero-Dose reduction targets.\n"
         "• Transparent, auditable grant expenditure tracking.",
         C_TEAL_PRIMARY),
        ("UN Agencies (UNICEF & WHO)",
         "• 100% digital fidelity to WHO RED microplanning guidelines.\n"
         "• Real-time cold chain volume & temperature monitoring.\n"
         "• Standardized national operational planning methodology.",
         C_CYAN_ACCENT),
        ("Frontline Health Workers",
         "• Eliminates 40+ pages of tedious manual paperwork.\n"
         "• Predictable, timely operational funding for outreach per diems.\n"
         "• Zero vaccine stockouts on scheduled clinic days.",
         C_AMBER_ACCENT)
    ]
    for i, (st_title, st_bullets, col) in enumerate(stakeholders):
        row = i // 2
        col_idx = i % 2
        x = Inches(0.8 + col_idx * 6.0)
        y = Inches(1.6 + row * 2.65)
        card = create_card(s10, x, y, Inches(5.733), Inches(2.4))
        # Top color stripe
        stripe = s10.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, y, Inches(5.733), Inches(0.1))
        stripe.fill.solid()
        stripe.fill.fore_color.rgb = col
        stripe.line.fill.background()

        c_tf = card.text_frame
        c_tf.word_wrap = True
        c_tf.margin_left = c_tf.margin_right = Inches(0.25)
        c_tf.margin_top = Inches(0.2)

        p1 = c_tf.paragraphs[0]
        p1.text = st_title
        p1.font.size = Pt(16)
        p1.font.bold = True
        p1.font.color.rgb = col

        p2 = c_tf.add_paragraph()
        p2.text = st_bullets
        p2.font.size = Pt(11)
        p2.font.color.rgb = C_TEXT_DARK
        p2.space_before = Pt(8)

    set_speaker_notes(s10,
        "VaxPlan creates a rare win-win across the entire health ecosystem. For Ministries of Health, it delivers real-time "
        "visibility and accelerates national coverage targets. For Gavi and donors, it provides unprecedented auditability. "
        "For WHO and UNICEF, it standardizes operational best practices. And for the clinic nurse, it replaces weeks of "
        "exhausting paperwork with a simple digital tool that ensures vaccines and funding arrive on time."
    )

    # ====================================================
    # SLIDE 11: Phased Deployment & National Scale Roadmap
    # ====================================================
    s11 = prs.slides.add_slide(blank_layout)
    add_background(s11, C_BG_LIGHT)
    add_header(s11, "Strategic Roadmap: From Pilot to National Scale")

    phases_roadmap = [
        ("Phase 1: Pilot & Baseline", "Months 1 to 4", [
            "Deploy in 2–4 high-priority pilot districts.",
            "Health facility geocoding & baseline validation.",
            "Master Training of Trainers (ToT) for 50 nurses.",
            "First automated microplans synthesized & approved."
        ], C_TEAL_PRIMARY),
        ("Phase 2: Provincial Rollout", "Months 5 to 8", [
            "Expansion to 20+ districts (1 province/region).",
            "DHIS2 live aggregate reporting connector enabled.",
            "Cold chain refrigerator volume synchronization.",
            "District supervisory feedback loop institutionalized."
        ], C_CYAN_ACCENT),
        ("Phase 3: National Scale", "Months 9 to 15", [
            "Nationwide rollout across all health facilities.",
            "Predictive AI dropout forecasting activated.",
            "National eLMIS vaccine supply order automation.",
            "Transition to 100% domestic recurrent financing."
        ], C_NAVY_PRIMARY)
    ]
    for i, (p_title, p_time, bullets, col) in enumerate(phases_roadmap):
        x = Inches(0.8 + i * 3.98)
        card = create_card(s11, x, Inches(1.6), Inches(3.78), Inches(4.3))
        # Top banner
        top_bar = s11.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, Inches(1.6), Inches(3.78), Inches(0.75))
        top_bar.fill.solid()
        top_bar.fill.fore_color.rgb = col
        top_bar.line.fill.background()
        b_tf = top_bar.text_frame
        b_tf.margin_left = b_tf.margin_right = Inches(0.2)
        bp1 = b_tf.paragraphs[0]
        bp1.text = p_title
        bp1.font.size = Pt(13)
        bp1.font.bold = True
        bp1.font.color.rgb = C_WHITE
        bp2 = b_tf.add_paragraph()
        bp2.text = p_time.upper()
        bp2.font.size = Pt(9.5)
        bp2.font.color.rgb = RGBColor(224, 242, 254)

        c_tf = card.text_frame
        c_tf.word_wrap = True
        c_tf.margin_left = c_tf.margin_right = Inches(0.2)
        c_tf.margin_top = Inches(0.95)

        for b_idx, bullet in enumerate(bullets):
            p = c_tf.paragraphs[0] if b_idx == 0 else c_tf.add_paragraph()
            p.text = f"✔  {bullet}"
            p.font.size = Pt(11)
            p.font.color.rgb = C_TEXT_DARK
            p.space_before = Pt(10)

    # Bottom Callout Box
    road_box = create_card(s11, Inches(0.8), Inches(6.05), Inches(11.733), Inches(0.95), bg_color=C_NAVY_PRIMARY, border_color=None)
    r_tf = road_box.text_frame
    r_tf.word_wrap = True
    r_tf.margin_left = r_tf.margin_right = Inches(0.25)
    r_tf.margin_top = Inches(0.15)
    rp1 = r_tf.paragraphs[0]
    rp1.text = "PROVEN, LOW-RISK DEPLOYMENT METHODOLOGY"
    rp1.font.size = Pt(11)
    rp1.font.bold = True
    rp1.font.color.rgb = C_CYAN_ACCENT
    rp2 = r_tf.add_paragraph()
    rp2.text = "Iterative field calibration ensures zero disruption to ongoing immunization services while building sustainable national capacity."
    rp2.font.size = Pt(10)
    rp2.font.color.rgb = C_WHITE

    set_speaker_notes(s11,
        "Our deployment methodology is structured, phased, and risk-mitigated. We do not attempt overnight national overhauls. "
        "We begin with a 4-month pilot in 2 to 4 diverse districts to calibrate local disease burdens, train frontline staff, "
        "and validate baseline spatial data. In Phase 2, we expand across entire provinces and establish live data links with DHIS2. "
        "By Phase 3, the platform is scaled nationally, with predictive modeling guiding national vaccine procurement."
    )

    # ====================================================
    # SLIDE 12: Commercial & Sustainability Model
    # ====================================================
    s12 = prs.slides.add_slide(blank_layout)
    add_background(s12, C_BG_LIGHT)
    add_header(s12, "Financial Sustainability: From Grant to Domestic Financing")

    models = [
        ("Donor Country Launch Package", "$150,000 – $350,000",
         "Initial donor grant (Gavi, BMGF, Global Fund) covering national platform configuration, custom GIS ingestion, DHIS2 integration, and frontline Master Training of Trainers (ToT).",
         "12 Months Inclusive Support", C_TEAL_PRIMARY),
        ("Annual Sovereign SaaS License", "$0.02 – $0.05 / Target Child / Year",
         "Low-cost recurrent licensing scaled to national birth cohort size. Designed to be easily absorbed into annual Ministry of Health recurrent operational budgets.",
         "Sustainable National Ownership", C_CYAN_ACCENT),
        ("Technical Assistance & Advisory", "Custom Engagement Bundles",
         "Specialized field packages for GPS catchment ground-truthing, cold chain optimization audits, and national executive leadership data governance workshops.",
         "High-Impact Field Enablement", C_AMBER_ACCENT)
    ]
    for i, (m_title, m_price, m_desc, m_pill, col) in enumerate(models):
        x = Inches(0.8 + i * 3.98)
        card = create_card(s12, x, Inches(1.6), Inches(3.78), Inches(4.3))
        # Top banner
        top_bar = s12.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, Inches(1.6), Inches(3.78), Inches(1.0))
        top_bar.fill.solid()
        top_bar.fill.fore_color.rgb = col
        top_bar.line.fill.background()
        b_tf = top_bar.text_frame
        b_tf.margin_left = b_tf.margin_right = Inches(0.2)
        bp1 = b_tf.paragraphs[0]
        bp1.text = m_title
        bp1.font.size = Pt(13)
        bp1.font.bold = True
        bp1.font.color.rgb = C_WHITE
        bp2 = b_tf.add_paragraph()
        bp2.text = m_price
        bp2.font.size = Pt(14)
        bp2.font.bold = True
        bp2.font.color.rgb = RGBColor(254, 240, 138) # Yellow accent

        c_tf = card.text_frame
        c_tf.word_wrap = True
        c_tf.margin_left = c_tf.margin_right = Inches(0.2)
        c_tf.margin_top = Inches(1.15)
        p1 = c_tf.paragraphs[0]
        p1.text = m_desc
        p1.font.size = Pt(11)
        p1.font.color.rgb = C_TEXT_DARK
        p1.space_before = Pt(6)

        # Pill at bottom of card
        pill = s12.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x + Inches(0.2), Inches(5.3), Inches(3.38), Inches(0.38))
        pill.fill.solid()
        pill.fill.fore_color.rgb = RGBColor(241, 245, 249)
        pill.line.color.rgb = col
        p_tf = pill.text_frame
        p_tf.margin_top = Inches(0.06)
        pp = p_tf.paragraphs[0]
        pp.text = m_pill
        pp.font.size = Pt(9.5)
        pp.font.bold = True
        pp.font.color.rgb = col
        pp.alignment = PP_ALIGN.CENTER

    # Bottom transition callout
    bot_card = create_card(s12, Inches(0.8), Inches(6.05), Inches(11.733), Inches(0.95), bg_color=C_NAVY_PRIMARY, border_color=None)
    b_tf = bot_card.text_frame
    b_tf.word_wrap = True
    b_tf.margin_left = b_tf.margin_right = Inches(0.25)
    b_tf.margin_top = Inches(0.15)
    bp1 = b_tf.paragraphs[0]
    bp1.text = "AVOIDING DIGITAL HEALTH GRAVEYARDS"
    bp1.font.size = Pt(11)
    bp1.font.bold = True
    bp1.font.color.rgb = C_CYAN_ACCENT
    bp2 = b_tf.add_paragraph()
    bp2.text = "At 2 to 5 cents per child per year, national health ministries can easily sustain VaxPlan after initial donor grant funding concludes."
    bp2.font.size = Pt(10)
    bp2.font.color.rgb = C_WHITE

    set_speaker_notes(s12,
        "A primary reason digital health platforms fail is financial unsustainability after initial grants expire. "
        "VaxPlan is intentionally designed with a transition-to-domestic-financing model. An initial donor grant funds the deployment "
        "and training. Subsequent annual operations cost just 2 to 5 cents per target child per year — a figure that national health "
        "ministries can easily absorb into their recurrent budgets. This ensures long-term operational continuity."
    )

    # ====================================================
    # SLIDE 13: Leadership & Governance
    # ====================================================
    s13 = prs.slides.add_slide(blank_layout)
    add_background(s13, C_BG_LIGHT)
    add_header(s13, "World-Class Leadership & Public Health Governance")

    leaders = [
        ("Founder & CEO", "Digital Health Entrepreneur",
         "Proven track record scaling public-private health technology partnerships, government stakeholder management, and national digital transformations.", C_NAVY_PRIMARY),
        ("Co-Founder & CTO", "Enterprise Systems Architect",
         "Specialist in offline-first distributed web systems, PostGIS spatial engines, resilient cloud architectures, and OpenHIE interoperability standards.", C_TEAL_PRIMARY),
        ("Co-Founder & Head of Public Health", "Senior Immunization Specialist",
         "Former national EPI technical advisor and global health expert with deep field experience across WHO RED microplanning implementations.", C_CYAN_ACCENT),
        ("Chief Operating Officer (COO)", "Global Health Operations Lead",
         "Expert in field logistics, supply chain cold chain audits, healthcare worker training, and large-scale multi-district rollout programs.", C_AMBER_ACCENT)
    ]
    for i, (l_role, l_title, l_desc, col) in enumerate(leaders):
        row = i // 2
        col_idx = i % 2
        x = Inches(0.8 + col_idx * 6.0)
        y = Inches(1.6 + row * 2.25)
        card = create_card(s13, x, y, Inches(5.733), Inches(2.05))
        # Left color bar
        bar = s13.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, y, Inches(0.12), Inches(2.05))
        bar.fill.solid()
        bar.fill.fore_color.rgb = col
        bar.line.fill.background()

        c_tf = card.text_frame
        c_tf.word_wrap = True
        c_tf.margin_left = Inches(0.3)
        c_tf.margin_right = Inches(0.2)
        c_tf.margin_top = Inches(0.15)

        p0 = c_tf.paragraphs[0]
        p0.text = l_role.upper()
        p0.font.size = Pt(9.5)
        p0.font.bold = True
        p0.font.color.rgb = col

        p1 = c_tf.add_paragraph()
        p1.text = l_title
        p1.font.size = Pt(14)
        p1.font.bold = True
        p1.font.color.rgb = C_NAVY_PRIMARY
        p1.space_before = Pt(2)

        p2 = c_tf.add_paragraph()
        p2.text = l_desc
        p2.font.size = Pt(10)
        p2.font.color.rgb = C_TEXT_DARK
        p2.space_before = Pt(6)

    # Advisory council banner at bottom
    adv_card = create_card(s13, Inches(0.8), Inches(6.15), Inches(11.733), Inches(0.85), bg_color=C_NAVY_PRIMARY, border_color=None)
    a_tf = adv_card.text_frame
    a_tf.word_wrap = True
    a_tf.margin_left = a_tf.margin_right = Inches(0.25)
    a_tf.margin_top = Inches(0.12)
    ap1 = a_tf.paragraphs[0]
    ap1.text = "SUPPORTED BY A MULTIDISCIPLINARY TECHNICAL ADVISORY BOARD"
    ap1.font.size = Pt(10.5)
    ap1.font.bold = True
    ap1.font.color.rgb = C_CYAN_ACCENT
    ap2 = a_tf.add_paragraph()
    ap2.text = "Advisors include former WHO EPI Directors, Gavi independent review committee members, and GIS spatial data scientists."
    ap2.font.size = Pt(9.5)
    ap2.font.color.rgb = C_WHITE

    set_speaker_notes(s13,
        "Our team combines deep software engineering expertise with decades of on-the-ground public health experience. "
        "We have built enterprise software architectures and spent weeks in rural health posts understanding the exact realities "
        "frontline health workers face. Backed by an advisory council of former EPI directors and global health experts, "
        "VaxPlan possesses both the technological excellence and the political acumen required to succeed."
    )

    # ====================================================
    # SLIDE 14: Call to Action & Partnership (Dark Closing)
    # ====================================================
    s14 = prs.slides.add_slide(blank_layout)
    add_background(s14, C_NAVY_PRIMARY)

    # Decorative right panel
    dec = s14.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(8.5), Inches(0), Inches(4.833), Inches(7.5))
    dec.fill.solid()
    dec.fill.fore_color.rgb = C_NAVY_DARK
    dec.line.fill.background()

    # Tag
    cat = s14.shapes.add_textbox(Inches(0.8), Inches(0.8), Inches(7.5), Inches(0.4))
    ctf = cat.text_frame
    cp = ctf.paragraphs[0]
    cp.text = "PARTNERSHIP OPPORTUNITY"
    cp.font.size = Pt(11)
    cp.font.bold = True
    cp.font.color.rgb = C_CYAN_ACCENT

    # Title
    tbox = s14.shapes.add_textbox(Inches(0.8), Inches(1.2), Inches(7.5), Inches(1.5))
    ttf = tbox.text_frame
    ttf.word_wrap = True
    tp1 = ttf.paragraphs[0]
    tp1.text = "Join Us in Eradicating Zero-Dose Communities"
    tp1.font.size = Pt(32)
    tp1.font.bold = True
    tp1.font.color.rgb = C_WHITE

    # 3 Partnership Avenues
    avenues = [
        ("1. Sponsor a National Pilot ($250K – $500K)",
         "Fund the digital transformation of 15–25 priority districts with large zero-dose populations, proving measurable coverage gains within 6 months."),
        ("2. Global Health Innovation Grant Partnership",
         "Co-apply for Gavi Innovation, BMGF, or USAID DIV grants to integrate predictive AI and climate-resilient cold chain planning."),
        ("3. Ministry of Health Demonstration",
         "Schedule a customized country technical demonstration and rapid feasibility assessment for your national EPI technical working group.")
    ]
    for i, (a_title, a_desc) in enumerate(avenues):
        y = Inches(2.9 + i * 1.35)
        a_card = create_card(s14, Inches(0.8), y, Inches(7.3), Inches(1.2), bg_color=RGBColor(23, 42, 70), border_color=RGBColor(59, 130, 246))
        atf = a_card.text_frame
        atf.word_wrap = True
        atf.margin_left = atf.margin_right = Inches(0.2)
        atf.margin_top = Inches(0.12)
        ap1 = atf.paragraphs[0]
        ap1.text = a_title
        ap1.font.size = Pt(13)
        ap1.font.bold = True
        ap1.font.color.rgb = C_WHITE
        ap2 = atf.add_paragraph()
        ap2.text = a_desc
        ap2.font.size = Pt(10)
        ap2.font.color.rgb = RGBColor(203, 213, 225)
        ap2.space_before = Pt(3)

    # Right side contact card
    c_box = s14.shapes.add_textbox(Inches(8.8), Inches(1.5), Inches(4.0), Inches(5.0))
    ctf = c_box.text_frame
    ctf.word_wrap = True
    cp0 = ctf.paragraphs[0]
    cp0.text = "ENGAGEMENT PORTAL"
    cp0.font.size = Pt(14)
    cp0.font.bold = True
    cp0.font.color.rgb = C_CYAN_ACCENT

    contacts = [
        ("Official Portal", "https://vaxplan.org"),
        ("Strategic Inquiries", "partnerships@vaxplan.org"),
        ("Technical Evaluation", "tech@vaxplan.org"),
        ("Headquarters", "VaxPlan Global Initiative\nGeneva • Nairobi • Washington, D.C.")
    ]
    for c_lbl, c_val in contacts:
        lp = ctf.add_paragraph()
        lp.text = c_lbl.upper()
        lp.font.size = Pt(9.5)
        lp.font.bold = True
        lp.font.color.rgb = C_TEXT_MUTED
        lp.space_before = Pt(14)

        vp = ctf.add_paragraph()
        vp.text = c_val
        vp.font.size = Pt(12)
        vp.font.bold = True
        vp.font.color.rgb = C_WHITE
        vp.space_before = Pt(2)

    set_speaker_notes(s14,
        "Colleagues, the vision is clear: no child should suffer or die from a vaccine-preventable illness simply because they were "
        "invisible on a paper map. With VaxPlan, we have built the precision digital engine to ensure every settlement is mapped, "
        "every clinic is funded, and every dose is protected. We invite you to partner with us — as pilot sponsors, technical advisors, "
        "and strategic allies. Together, we can turn universal immunization equity into reality. Thank you, and we welcome your questions."
    )

    # Save presentation
    output_path = os.path.join(os.path.dirname(__file__), "..", "docs", "VAXPLAN_STAKEHOLDER_SLIDE_DECK.pptx")
    prs.save(output_path)
    print(f"Successfully generated: {os.path.abspath(output_path)}")

if __name__ == "__main__":
    create_deck()
