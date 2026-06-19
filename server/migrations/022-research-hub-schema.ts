/**
 * Migration 022 — research_hub_schema
 *
 * Creates the tables for research documents, pilot activities, pilot updates,
 * implementation lessons, download assets, research interest submissions,
 * and download events.
 *
 * Safe to re-run: uses IF NOT EXISTS and checks table content before seeding.
 */
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export async function up(db: NodePgDatabase<any>): Promise<void> {
  // 1. Create Tables
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS research_documents (
      id                   SERIAL PRIMARY KEY,
      tenant_id            VARCHAR NOT NULL,
      title                VARCHAR(255) NOT NULL,
      slug                 VARCHAR(255) NOT NULL,
      abstract             TEXT,
      document_type        VARCHAR(100) NOT NULL,
      authors              VARCHAR(255),
      organizations        VARCHAR(255),
      publication_date     VARCHAR(20),
      year                 INTEGER,
      version              VARCHAR(50) DEFAULT '1.0.0',
      country              VARCHAR(100),
      region               VARCHAR(100),
      language             VARCHAR(50) DEFAULT 'en',
      tags                 JSONB DEFAULT '[]'::jsonb,
      status               VARCHAR(50) NOT NULL DEFAULT 'Draft',
      visibility           VARCHAR(50) NOT NULL DEFAULT 'Public',
      file_url             VARCHAR(512),
      file_name            VARCHAR(255),
      file_type            VARCHAR(100),
      file_size            INTEGER,
      thumbnail_url        VARCHAR(512),
      citation_text        TEXT,
      doi                  VARCHAR(100),
      license              VARCHAR(100) DEFAULT 'CC BY 4.0',
      is_featured          BOOLEAN NOT NULL DEFAULT FALSE,
      download_count       INTEGER NOT NULL DEFAULT 0,
      created_by_user_id   VARCHAR REFERENCES users(id) ON DELETE SET NULL,
      updated_by_user_id   VARCHAR REFERENCES users(id) ON DELETE SET NULL,
      published_by_user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      published_at         TIMESTAMPTZ,
      archived_at          TIMESTAMPTZ
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS pilot_activities (
      id                   SERIAL PRIMARY KEY,
      tenant_id            VARCHAR NOT NULL,
      title                VARCHAR(255) NOT NULL,
      slug                 VARCHAR(255) NOT NULL,
      summary              TEXT,
      country              VARCHAR(100) NOT NULL,
      province             VARCHAR(100),
      district             VARCHAR(100),
      facility             VARCHAR(255),
      communities          TEXT,
      latitude             NUMERIC(9,6),
      longitude            NUMERIC(9,6),
      start_date           VARCHAR(20),
      end_date             VARCHAR(20),
      status               VARCHAR(50) NOT NULL DEFAULT 'Planned',
      pilot_type           VARCHAR(100),
      partners             VARCHAR(255),
      ministry_focal_point VARCHAR(255),
      technical_lead       VARCHAR(255),
      objectives           TEXT,
      research_questions   TEXT,
      methodology          TEXT,
      indicators           JSONB DEFAULT '[]'::jsonb,
      baseline_findings    TEXT,
      achievements         TEXT,
      challenges           TEXT,
      lessons_learned      TEXT,
      recommendations      TEXT,
      ethics_status        VARCHAR(100),
      visibility           VARCHAR(50) NOT NULL DEFAULT 'Public',
      is_featured          BOOLEAN NOT NULL DEFAULT FALSE,
      created_by_user_id   VARCHAR REFERENCES users(id) ON DELETE SET NULL,
      updated_by_user_id   VARCHAR REFERENCES users(id) ON DELETE SET NULL,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      published_at         TIMESTAMPTZ
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS pilot_updates (
      id                   SERIAL PRIMARY KEY,
      pilot_id             INTEGER NOT NULL REFERENCES pilot_activities(id) ON DELETE CASCADE,
      title                VARCHAR(255) NOT NULL,
      update_date          VARCHAR(20) NOT NULL,
      update_type          VARCHAR(100),
      description          TEXT,
      achievements         TEXT,
      challenges           TEXT,
      next_steps           TEXT,
      attachments          JSONB DEFAULT '[]'::jsonb,
      created_by_user_id   VARCHAR REFERENCES users(id) ON DELETE SET NULL,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS implementation_lessons (
      id                   SERIAL PRIMARY KEY,
      tenant_id            VARCHAR NOT NULL,
      title                VARCHAR(255) NOT NULL,
      slug                 VARCHAR(255) NOT NULL,
      category             VARCHAR(100) NOT NULL,
      context              TEXT,
      what_was_tested      TEXT,
      what_worked          TEXT,
      what_did_not_work    TEXT,
      recommendation       TEXT,
      pilot_id             INTEGER REFERENCES pilot_activities(id) ON DELETE SET NULL,
      document_id          INTEGER REFERENCES research_documents(id) ON DELETE SET NULL,
      tags                 JSONB DEFAULT '[]'::jsonb,
      status               VARCHAR(50) NOT NULL DEFAULT 'Published',
      visibility           VARCHAR(50) NOT NULL DEFAULT 'Public',
      author               VARCHAR(255),
      created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS download_assets (
      id                   SERIAL PRIMARY KEY,
      tenant_id            VARCHAR NOT NULL,
      title                VARCHAR(255) NOT NULL,
      slug                 VARCHAR(255) NOT NULL,
      description          TEXT,
      category             VARCHAR(100) NOT NULL,
      recommended_audience VARCHAR(255),
      file_url             VARCHAR(512),
      file_name            VARCHAR(255),
      file_type            VARCHAR(100),
      file_size            INTEGER,
      version              VARCHAR(50) DEFAULT '1.0.0',
      status               VARCHAR(50) NOT NULL DEFAULT 'Published',
      visibility           VARCHAR(50) NOT NULL DEFAULT 'Public',
      download_count       INTEGER NOT NULL DEFAULT 0,
      created_by_user_id   VARCHAR REFERENCES users(id) ON DELETE SET NULL,
      updated_by_user_id   VARCHAR REFERENCES users(id) ON DELETE SET NULL,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS research_interest_submissions (
      id                   SERIAL PRIMARY KEY,
      tenant_id            VARCHAR NOT NULL,
      full_name            VARCHAR(255) NOT NULL,
      organization         VARCHAR(255),
      role                 VARCHAR(255),
      email                VARCHAR(255) NOT NULL,
      country              VARCHAR(100),
      area_of_interest     VARCHAR(255),
      message              TEXT,
      consent              BOOLEAN NOT NULL DEFAULT FALSE,
      status               VARCHAR(50) NOT NULL DEFAULT 'pending',
      created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS research_download_events (
      id                   SERIAL PRIMARY KEY,
      document_id          INTEGER REFERENCES research_documents(id) ON DELETE CASCADE,
      asset_id             INTEGER REFERENCES download_assets(id) ON DELETE CASCADE,
      user_id              VARCHAR REFERENCES users(id) ON DELETE SET NULL,
      ip_hash              VARCHAR(64),
      user_agent           TEXT,
      downloaded_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // 2. Create Indexes
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_research_doc_tenant ON research_documents(tenant_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_research_doc_status ON research_documents(status);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_pilot_act_tenant ON pilot_activities(tenant_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_pilot_act_status ON pilot_activities(status);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_pilot_upd_pilot ON pilot_updates(pilot_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_impl_lesson_tenant ON implementation_lessons(tenant_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_download_asset_tenant ON download_assets(tenant_id);`);

  // 3. Seed Sample Data if research_documents is empty
  const docCount = await db.execute(sql`SELECT COUNT(*) as count FROM research_documents`);
  const count = Number(docCount.rows[0]?.count || 0);

  if (count === 0) {
    const tenantRows = await db.execute(sql`SELECT id FROM tenants LIMIT 1`);
    const tenantId = tenantRows.rows[0]?.id || "default-tenant-uuid";

    // A. Seed Documents
    await db.execute(sql`
      INSERT INTO research_documents (
        tenant_id, title, slug, abstract, document_type, authors, organizations,
        publication_date, year, version, country, region, tags, status, visibility,
        citation_text, doi, is_featured, download_count
      ) VALUES
      (
        ${tenantId},
        'VaxPlan White Paper: GIS-enabled digital public infrastructure for immunization microplanning and zero-dose identification',
        'vaxplan-white-paper',
        'This white paper details VaxPlan design principles, GIS data layer alignment, and zero-dose community mapping outcomes across initial country pilots.',
        'White Paper',
        'L. Mukombo, E. Vance, A. Patel',
        'VaxPlan Research Group',
        '2026-01-15',
        2026,
        '1.2.0',
        'Zambia',
        'Southern Africa',
        '["GIS", "Zero-Dose", "DPI", "WHO Principles"]'::jsonb,
        'Published',
        'Public',
        'Mukombo, L., Vance, E., & Patel, A. (2026). VaxPlan White Paper: GIS-enabled digital public infrastructure for immunization microplanning. VaxPlan Research Hub.',
        '10.1234/vaxplan.wp.2026',
        true,
        245
      ),
      (
        ${tenantId},
        'GIS-enabled Immunization Microplanning: Product Brief and Field Feasibility Study',
        'gis-microplanning-product-brief',
        'A comprehensive summary of software integrations, map caching capabilities, and field feasibility scores from rural health centres.',
        'Research Paper',
        'G. Carter, S. Ndhlovu',
        'Ministry of Health, Clinton Health Access Initiative',
        '2026-03-10',
        2026,
        '1.0.0',
        'Zambia',
        'Lusaka Province',
        '["Field Study", "Feasibility", "Offline-First", "eLMIS"]'::jsonb,
        'Published',
        'Public',
        'Carter, G., & Ndhlovu, S. (2026). GIS-enabled Immunization Microplanning Product Brief. VaxPlan Research Hub.',
        '10.1234/vaxplan.pb.2026',
        true,
        189
      ),
      (
        ${tenantId},
        'Technical Architecture Brief: Offline-First Synchronisation and Multi-Tenant Deployment Patterns',
        'technical-architecture-brief',
        'Deep-dive into VaxPlan IndexedDB outbox queue, conflict reconciliation, and regional database scaling paradigms on resource-constrained networks.',
        'Technical Documentation',
        'J. Doe, T. Smith',
        'VaxPlan Engineering Team',
        '2026-04-20',
        2026,
        '2.1.0',
        'Global',
        'Global',
        '["Engineering", "Offline-Sync", "IndexedDB", "Postgres"]'::jsonb,
        'Published',
        'Public',
        'Doe, J., & Smith, T. (2026). VaxPlan Technical Architecture Brief. VaxPlan Research Hub.',
        '10.1234/vaxplan.arch.2026',
        false,
        132
      ),
      (
        ${tenantId},
        'Zero-Dose Settlement Intelligence: Utilizing Remote Sensing and Settlement Datasets to Locate Unreached Children',
        'zero-dose-settlement-intelligence',
        'This case study highlights how integrating GRID3 settlement overlays and satellite-derived structures within VaxPlan identifies unmapped communities.',
        'Case Study',
        'R. Mwanza, Y. Park',
        'Gavi Zero-Dose Learning Hub',
        '2026-05-05',
        2026,
        '1.0.0',
        'PNG',
        'Pacific',
        '["GRID3", "Remote-Sensing", "Satellite", "Equity"]'::jsonb,
        'Published',
        'Public',
        'Mwanza, R., & Park, Y. (2026). Zero-Dose Settlement Intelligence Brief. VaxPlan Research Hub.',
        '10.1234/vaxplan.zd.2026',
        true,
        98
      ),
      (
        ${tenantId},
        'Standards Alignment Matrix: HL7 FHIR, OpenHIE, and DHIS2 Interoperability Guidelines',
        'standards-alignment-matrix',
        'Detailed documentation of mapped data values, immunisation registries interoperability, and FHIR resource structures matching WHO Digital Adaptation Kits.',
        'Standards Alignment Documents',
        'Interoperability Committee',
        'Digital Public Goods Alliance',
        '2026-02-18',
        2026,
        '1.1.0',
        'Global',
        'Global',
        '["HL7 FHIR", "DHIS2", "Interoperability", "OpenHIE"]'::jsonb,
        'Published',
        'Public',
        'Interoperability Committee (2026). Standards Alignment Matrix. VaxPlan Research Hub.',
        '10.1234/vaxplan.std.2026',
        false,
        76
      );
    `);

    // B. Seed Pilots
    await db.execute(sql`
      INSERT INTO pilot_activities (
        tenant_id, title, slug, summary, country, province, district, facility,
        communities, latitude, longitude, start_date, end_date, status, pilot_type,
        partners, ministry_focal_point, technical_lead, objectives, research_questions,
        methodology, indicators, baseline_findings, achievements, challenges,
        lessons_learned, recommendations, ethics_status, visibility, is_featured
      ) VALUES
      (
        ${tenantId},
        'Zambia Prototype Pilot: Catchment Mapping and Session Outreach in Chibombo District',
        'zambia-chibombo-pilot',
        'Deploying VaxPlan to optimize catchment mapping and vaccination sessions in 15 facilities, comparing NSO population projections against local head counts.',
        'Zambia',
        'Central Province',
        'Chibombo',
        'Chibombo Health Centre, Liteta Hospital, Mwachisompola Rural Health Centre',
        'Kamaila, Shimukuni, Kanyama, Chikobo, Chansangu villages',
        -14.6800,
        28.1200,
        '2025-06-01',
        '2026-05-31',
        'Completed',
        'Field Implementation',
        'MoH Zambia, CHAI, UNICEF',
        'Dr. Patricia Chimba (Director Public Health)',
        'Leonard Mukombo (Lead UX Architect)',
        'Evaluate GIS microplanning user adoption; identify zero-dose clusters; measure stock out duration changes.',
        'Can community catchment boundary visualization reduce missed settlement rates? How does offline synchronization perform in connectivity-dead zones?',
        'Mixed-methods implementation study: user training, digital catchment mapping sessions, and post-pilot facility focus groups.',
        '[{"name": "GIS catchment mapping completed", "target": "100%", "actual": "100%"}, {"name": "Outreach sessions held as planned", "target": "85%", "actual": "91%"}]'::jsonb,
        'Catchment boundaries were outdated (hand-drawn paper maps from 2012); estimated zero-dose rate in remote wards was 18%.',
        'Completed mapping of 58 settlements; successfully scheduled and recorded 224 outreach session day plans; fully resolved 14 boundary overlaps.',
        'Extremely poor cellular signal at Mwachisompola required staff to operate completely offline for up to 5 days.',
        'Offline queueing works perfectly, but users need clearer warning banners when viewing un-synchronized local conflict states.',
        'Integrate local basemap tiles into the tablet builds before deployment to mitigate offline loading lag.',
        'Approved by Zambia National Health Research Authority (NHRA-0032/25)',
        'Public',
        true
      ),
      (
        ${tenantId},
        'PNG GIS Microplanning and Zero-Dose Settlement Identification in Morobe Province',
        'png-morobe-pilot',
        'Utilizing satellite imagery overlays to map hard-to-reach unmapped hamlets and evaluate vaccine delivery coverage.',
        'PNG',
        'Morobe Province',
        'Lae',
        'Malahang Health Centre, Butibam Clinic',
        'Apo, Kamkumung, Yanga settlement villages',
        -6.7200,
        147.0000,
        '2026-02-15',
        '2026-11-30',
        'Active',
        'Zero-Dose Campaign',
        'PNG National Department of Health, WHO, Gates Foundation',
        'Mr. John Kep (EPI Coordinator)',
        'Y. Park (Senior GIS Specialist)',
        'Identify unmapped communities, implement real-time stock balances tracking, integrate DHIS2 reporting.',
        'Does the integration of high-resolution remote sensing layers increase zero-dose infant tracking?',
        'Satellite building footprint datasets are pre-loaded in VaxPlan; field teams trace villages and trigger outreach recommendations.',
        '[{"name": "Hamlets discovered", "target": "15", "actual": "19"}, {"name": "Under-1 fully immunized", "target": "80%", "actual": "68%"}]'::jsonb,
        'Over 10 communities did not appear on administrative map lists; baseline immunisation coverage was 48%.',
        'Found 19 previously unreached settlements; mapped 340 children; started bi-weekly outreach mobile runs.',
        'Mountainous terrain and dense canopy limit GPS accuracy to ~30 meters, complicating pinpoint boundary drawing.',
        'GPS smoothing algorithms in the app are essential for accurate catchment draw tracking.',
        'Enable visual grid indicators to help surveyors locate child coordinates under canopy covers.',
        'Approved by PNG Medical Research Advisory Committee (MRAC-2026.04)',
        'Public',
        true
      );
    `);

    // C. Seed Lessons
    await db.execute(sql`
      INSERT INTO implementation_lessons (
        tenant_id, title, slug, category, context, what_was_tested, what_worked,
        what_did_not_work, recommendation, pilot_id, document_id, tags, status, visibility, author
      ) VALUES
      (
        ${tenantId},
        'Zambia Catchment Boundary Overlaps: Collaborative GIS Conflict Resolution',
        'zambia-catchment-overlaps-lesson',
        'GIS microplanning',
        'During the Chibombo pilot, drawing digital boundaries revealed 14 overlapping village catchments where adjacent facilities both claimed service coverage.',
        'Visual interactive boundary negotiation in the VaxPlan GIS module.',
        'Gathering health workers from adjacent facilities in the same room to drag and snap boundaries on the screen resolved disputes in under 2 hours.',
        'Trying to auto-reconcile conflicts using simple centroid distances or administrative polygons caused severe worker pushback.',
        'Facilitate peer-to-peer mapping workshops rather than using automated top-down spatial partitioning.',
        1,
        2,
        '["Boundary", "Resolution", "Zambia", "GIS"]'::jsonb,
        'Published',
        'Public',
        'L. Mukombo'
      ),
      (
        ${tenantId},
        'Offline-First Data Synchronization in Low-Bandwidth Mountainous Facilities',
        'offline-sync-low-bandwidth-lesson',
        'Offline-first deployment',
        'Staff in remote clinics had to input clinical and stock logs offline, syncing only when visiting the district store.',
        'VaxPlan IndexedDB queue synchronization on reconnect.',
        'Transactions queued cleanly. The automatic background sync triggers as soon as a 3G link is detected, with zero data loss.',
        'Session expiry during offline state caused sync fail alerts upon reconnecting without clear instructions to log in again.',
        'Implement automatic token prolongations and provide a clear "Re-authenticate to sync" toast notification.',
        2,
        3,
        '["Offline", "Sync", "IndexedDB", "PNG"]'::jsonb,
        'Published',
        'Public',
        'T. Smith'
      );
    `);

    // D. Seed Assets
    await db.execute(sql`
      INSERT INTO download_assets (
        tenant_id, title, slug, description, category, recommended_audience,
        file_url, file_name, file_type, file_size, version, status, visibility, download_count
      ) VALUES
      (
        ${tenantId},
        'VaxPlan Product and Technology White Paper',
        'vaxplan-white-paper-pdf',
        'The primary publication describing VaxPlan features, GIS microplanning design, and pilot case studies.',
        'White Paper',
        'Ministries of Health, Donors, Researchers',
        '/uploads/research/vaxplan-white-paper-2026.pdf',
        'vaxplan-white-paper-2026.pdf',
        'application/pdf',
        1850422,
        '1.2.0',
        'Published',
        'Public',
        421
      ),
      (
        ${tenantId},
        'Pilot Readiness Assessment Toolkit',
        'pilot-readiness-toolkit',
        'Excel checklist covering hardware requirements, offline map caching preparation, user roles, and GIS boundary data checklist.',
        'Templates',
        'EPI Programme Managers, Implementation Partners',
        '/uploads/research/pilot-readiness-assessment.xlsx',
        'pilot-readiness-assessment.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        124800,
        '2.0.0',
        'Published',
        'Public',
        308
      ),
      (
        ${tenantId},
        'Country Deployment and Onboarding Checklist',
        'country-onboarding-checklist',
        'Word template describing standard steps for database setup, DHIS2 schema alignment, and local training timeline scheduling.',
        'Templates',
        'Ministry of Health, GIS Specialists, National Administrators',
        '/uploads/research/country-onboarding-checklist.docx',
        'country-onboarding-checklist.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        98200,
        '1.1.0',
        'Published',
        'Public',
        198
      ),
      (
        ${tenantId},
        'VaxPlan GIS Microplanning Presentation Deck',
        'gis-microplanning-deck',
        'PowerPoint slides presenting VaxPlan value proposition, zero-dose maps, and evidence summaries for donor presentations.',
        'Presentation Decks',
        'Donors, National Managers, WHO Representatives',
        '/uploads/research/vaxplan-presentation-deck.pptx',
        'vaxplan-presentation-deck.pptx',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        4120800,
        '1.0.0',
        'Published',
        'Public',
        256
      );
    `);
  }
}

export async function down(db: NodePgDatabase<any>): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS research_download_events;`);
  await db.execute(sql`DROP TABLE IF EXISTS research_interest_submissions;`);
  await db.execute(sql`DROP TABLE IF EXISTS download_assets;`);
  await db.execute(sql`DROP TABLE IF EXISTS implementation_lessons;`);
  await db.execute(sql`DROP TABLE IF EXISTS pilot_updates;`);
  await db.execute(sql`DROP TABLE IF EXISTS pilot_activities;`);
  await db.execute(sql`DROP TABLE IF EXISTS research_documents;`);
}
