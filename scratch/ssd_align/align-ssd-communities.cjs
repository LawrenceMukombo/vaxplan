const fs = require("fs");
const path = require("path");
const XLSX = require("@e965/xlsx");

const ROOT = "C:/vaxplan";
const DOWNLOADS = "C:/Users/Mukombo/Downloads";
const OUT_DIR = path.join(ROOT, "scratch", "ssd_align");
const BACKUP_DIR = path.join(OUT_DIR, "backups");

function loadEnv() {
  const envText = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
  for (const line of envText.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let value = m[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[m[1]] = value;
  }
}

function readSheet(file, sheetName) {
  const wb = XLSX.readFile(file);
  const sheet = sheetName || wb.SheetNames[0];
  return XLSX.utils.sheet_to_json(wb.Sheets[sheet], { defval: null, raw: false });
}

function norm(value) {
  return String(value ?? "").trim();
}

function key(value) {
  return norm(value).toLowerCase().replace(/\s+/g, " ");
}

function toNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toBool(value) {
  const s = key(value);
  return ["true", "yes", "y", "1", "htr", "hard to reach"].includes(s);
}

function haversineKm(aLat, aLng, bLat, bLng) {
  if ([aLat, aLng, bLat, bLng].some((v) => !Number.isFinite(Number(v)))) return null;
  const r = 6371;
  const dLat = ((Number(bLat) - Number(aLat)) * Math.PI) / 180;
  const dLng = ((Number(bLng) - Number(aLng)) * Math.PI) / 180;
  const lat1 = (Number(aLat) * Math.PI) / 180;
  const lat2 = (Number(bLat) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

function sqlString(value) {
  return value == null ? null : String(value);
}

async function insertBatch(client, table, columns, rows, batchSize = 500) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const values = [];
    const placeholders = batch.map((row, rowIndex) => {
      const slots = columns.map((col, colIndex) => {
        values.push(row[col]);
        return `$${rowIndex * columns.length + colIndex + 1}`;
      });
      return `(${slots.join(",")})`;
    });
    await client.query(
      `insert into ${table} (${columns.join(",")}) values ${placeholders.join(",")}`,
      values
    );
  }
}

async function main() {
  loadEnv();
  const pg = await import("pg");
  const { Pool } = pg.default || pg;
  let connectionString = process.env.DATABASE_URL;
  if ((connectionString.includes("supabase.co") || connectionString.includes("upstash.io")) && !connectionString.includes("sslmode=")) {
    connectionString += connectionString.includes("?") ? "&sslmode=require" : "?sslmode=require";
  }
  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const report = {
    stamp,
    sourceFiles: {
      populatedPlaces: path.join(DOWNLOADS, "ssd_populatedplaces_tabulardata.xlsx"),
      vaxPlanCommunities: path.join(DOWNLOADS, "South_Sudan_VaxPlan_Communities_Complete.xlsx"),
    },
  };

  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });

    const tenant = (await client.query(
      "select id, name, code from tenants where code='SSD' or name ilike '%south sudan%' limit 1"
    )).rows[0];
    if (!tenant) throw new Error("South Sudan tenant was not found.");
    report.tenant = tenant;

    const populatedRows = readSheet(report.sourceFiles.populatedPlaces, "SS_pt");
    const communityRows = readSheet(report.sourceFiles.vaxPlanCommunities, "VaxPlan_Import");
    const communityByCode = new Map();
    for (const row of communityRows) {
      const code = norm(row.code);
      if (code) communityByCode.set(code, row);
    }

    const provinces = await client.query("select id,name,code from provinces where tenant_id=$1", [tenant.id]);
    const districts = await client.query("select id,name,code,province_id from districts where tenant_id=$1", [tenant.id]);
    const llgs = await client.query("select id,name,code,district_id from llgs where tenant_id=$1", [tenant.id]);
    const facilities = await client.query("select id,name,hmis_code,district_id,latitude,longitude from facilities where tenant_id=$1", [tenant.id]);
    const villageSnapshot = await client.query("select * from villages where tenant_id=$1", [tenant.id]);
    const settlementSnapshot = await client.query("select * from settlements_master where tenant_id=$1", [tenant.id]);

    const backupPath = path.join(BACKUP_DIR, `ssd-communities-pre-${stamp}.json`);
    fs.writeFileSync(backupPath, JSON.stringify({
      tenant,
      villages: villageSnapshot.rows,
      settlements_master: settlementSnapshot.rows,
    }, null, 2));
    report.backupPath = backupPath;

    const provinceByCode = new Map(provinces.rows.map((p) => [key(p.code), p]));
    const districtByCode = new Map(districts.rows.map((d) => [key(d.code), d]));
    const districtByName = new Map(districts.rows.map((d) => [key(d.name), d]));
    const rajaDistrict = districtByName.get(key("Raja"));
    if (rajaDistrict) districtByName.set(key("Raga"), rajaDistrict);
    const llgByCode = new Map(llgs.rows.filter((l) => l.code).map((l) => [key(l.code), l]));
    const facilitiesByHmis = new Map(facilities.rows.map((f) => [key(f.hmis_code), f]));
    const facilitiesByDistrict = new Map();
    for (const f of facilities.rows) {
      if (!facilitiesByDistrict.has(f.district_id)) facilitiesByDistrict.set(f.district_id, []);
      facilitiesByDistrict.get(f.district_id).push(f);
    }

    const tmpRows = [];
    const skipped = [];
    const seenCodes = new Set();
    for (const row of populatedRows) {
      const pcode = norm(row.pcode);
      if (!pcode || seenCodes.has(pcode)) continue;
      seenCodes.add(pcode);
      const name = norm(row.featureNam || row.name);
      const lat = toNum(row.POINT_Y);
      const lng = toNum(row.POINT_X);
      const district = districtByCode.get(key(row.admin2Pcod)) || districtByName.get(key(row.admin2Name));
      if (!name || !district || lat == null || lng == null) {
        skipped.push({ pcode, name, reason: "missing name, coordinates, or county/district match" });
        continue;
      }

      const llg = llgByCode.get(key(row.admin3Pcod));
      const community = communityByCode.get(pcode);
      let facility = community?.facility_hmis_code ? facilitiesByHmis.get(key(community.facility_hmis_code)) : null;
      let distance = null;
      if (facility && facility.latitude != null && facility.longitude != null) {
        distance = haversineKm(lat, lng, Number(facility.latitude), Number(facility.longitude));
      }
      if (!facility) {
        let best = null;
        for (const candidate of facilitiesByDistrict.get(district.id) || []) {
          const d = haversineKm(lat, lng, Number(candidate.latitude), Number(candidate.longitude));
          if (d == null) continue;
          if (!best || d < best.distance) best = { facility: candidate, distance: d };
        }
        if (best) {
          facility = best.facility;
          distance = best.distance;
        }
      }

      const htr = community ? toBool(community.is_hard_to_reach) : distance != null && distance >= 5;
      const seasonal = htr ? "limited" : "all-season";
      const transport = distance != null && distance <= 2 ? "walking" : "motorbike";
      const travel = distance == null ? null : Math.max(1, Math.round((distance / (transport === "walking" ? 4 : 25)) * 60));
      const province = provinceByCode.get(key(row.admin1Pcod));
      tmpRows.push({
        pcode,
        name,
        district_id: district.id,
        llg_id: llg?.id || null,
        assigned_facility_id: facility?.id || null,
        latitude: lat,
        longitude: lng,
        distance_to_facility: distance == null ? null : Number(distance.toFixed(2)),
        travel_time_minutes: travel,
        is_hard_to_reach: htr,
        seasonal_accessibility: seasonal,
        transport_mode: transport,
        insecurity_level: community?.insecurity_level ? Number(community.insecurity_level) || null : null,
        comments: sqlString(community?.comments || `Source: South Sudan populated places ${pcode}; ${row.admin3Name || "unknown payam"}, ${row.admin2Name || "unknown county"}, ${row.admin1Name || "unknown state"}.`),
        province_name: norm(row.admin1Name),
        district_name: norm(row.admin2Name),
        llg_name: norm(row.admin3Name),
        place_type: norm(row.popPlace_1) || "settlement",
      });
    }

    report.source = {
      populatedPlaceRows: populatedRows.length,
      vaxPlanCommunityRows: communityRows.length,
      preparedRows: tmpRows.length,
      skippedRows: skipped.length,
      skippedSample: skipped.slice(0, 25),
    };

    await client.query("begin");
    await client.query("create temp table tmp_ssd_places (pcode text primary key, name text not null, district_id integer not null, llg_id integer, assigned_facility_id integer, latitude numeric not null, longitude numeric not null, distance_to_facility numeric, travel_time_minutes integer, is_hard_to_reach boolean, seasonal_accessibility text, transport_mode text, insecurity_level integer, comments text, province_name text, district_name text, llg_name text, place_type text) on commit drop");
    await insertBatch(client, "tmp_ssd_places", [
      "pcode",
      "name",
      "district_id",
      "llg_id",
      "assigned_facility_id",
      "latitude",
      "longitude",
      "distance_to_facility",
      "travel_time_minutes",
      "is_hard_to_reach",
      "seasonal_accessibility",
      "transport_mode",
      "insecurity_level",
      "comments",
      "province_name",
      "district_name",
      "llg_name",
      "place_type",
    ], tmpRows);
    await client.query("create index tmp_ssd_places_name_district_idx on tmp_ssd_places (lower(name), district_id)");

    const updatedByCode = await client.query(`
      update villages v
      set name=t.name,
          district_id=t.district_id,
          llg_id=t.llg_id,
          assigned_facility_id=coalesce(t.assigned_facility_id, v.assigned_facility_id),
          latitude=t.latitude,
          longitude=t.longitude,
          distance_to_facility=t.distance_to_facility,
          travel_time_minutes=t.travel_time_minutes,
          is_hard_to_reach=t.is_hard_to_reach,
          seasonal_accessibility=t.seasonal_accessibility,
          transport_mode=t.transport_mode::transport_mode,
          insecurity_level=t.insecurity_level,
          comments=t.comments,
          settlement_type=t.place_type,
          detection_source='ssd_populated_places',
          last_verified=now(),
          updated_at=now()
      from tmp_ssd_places t
      where v.tenant_id=$1::varchar and v.code=t.pcode
    `, [tenant.id]);

    const updatedByUniqueName = { rowCount: 0 };

    const insertedVillages = await client.query(`
      insert into villages (
        tenant_id, name, code, district_id, llg_id, assigned_facility_id, latitude, longitude,
        distance_to_facility, travel_time_minutes, is_hard_to_reach, seasonal_accessibility,
        transport_mode, insecurity_level, comments, settlement_type, high_risk, high_risk_reason,
        detection_source, is_mapped_in_hmis, last_verified, created_at, updated_at
      )
      select
        $1::varchar, name, pcode, district_id, llg_id, assigned_facility_id, latitude, longitude,
        distance_to_facility, travel_time_minutes, is_hard_to_reach, seasonal_accessibility,
        transport_mode::transport_mode, insecurity_level, comments, place_type,
        coalesce(is_hard_to_reach, false),
        case when is_hard_to_reach then 'Flagged hard-to-reach from South Sudan community import or distance threshold' else null end,
        'ssd_populated_places', true, now(), now(), now()
      from tmp_ssd_places t
      where not exists (
        select 1 from villages v
        where v.tenant_id=$1::varchar and v.code=t.pcode
      )
    `, [tenant.id]);

    await client.query("delete from settlements_master where tenant_id=$1 and source in ('geonames','ssd_populated_places')", [tenant.id]);
    const insertedSettlements = await client.query(`
      insert into settlements_master (
        tenant_id, name, place_type, latitude, longitude, geojson, province_name, district_name,
        ward_name, health_catchment, population_estimate, under5_population, building_count,
        source, source_confidence, nearest_health_facility, distance_to_facility_km,
        estimated_travel_time, accessibility_score, hard_to_reach, validation_status,
        district_id, linked_facility_id, nearest_facility_id, distance_to_linked_facility_km,
        estimated_walking_time_minutes, estimated_driving_time_minutes, travel_mode_planning,
        dry_season_travel_time_minutes, rainy_season_travel_time_minutes, link_status,
        link_method, link_confidence, link_notes, service_status, risk_level, is_active,
        created_at, updated_at
      )
      select
        $1::varchar, n.name, coalesce(n.place_type, 'settlement'), n.latitude, n.longitude,
        jsonb_build_object('type','Point','coordinates',jsonb_build_array(n.longitude, n.latitude)),
        n.province_name, n.district_name, n.llg_name,
        null, 0, 0, 0, 'ssd_populated_places', 0.95,
        f.name, n.distance_to_facility, n.travel_time_minutes,
        case when n.distance_to_facility is null then null when n.distance_to_facility <= 2 then 90 when n.distance_to_facility <= 5 then 75 when n.distance_to_facility <= 10 then 55 else 35 end,
        coalesce(n.is_hard_to_reach, false), 'approved',
        n.district_id, n.assigned_facility_id, n.assigned_facility_id, n.distance_to_facility,
        case when n.distance_to_facility is null then null else greatest(1, round((n.distance_to_facility / 4.0) * 60)::int) end,
        case when n.distance_to_facility is null then null else greatest(1, round((n.distance_to_facility / 25.0) * 60)::int) end,
        n.transport_mode,
        n.travel_time_minutes,
        case when n.travel_time_minutes is null then null else ceil(n.travel_time_minutes * 1.7)::int end,
        case when n.assigned_facility_id is null then 'unassigned' else 'linked' end,
        case when n.assigned_facility_id is null then null else 'facility_hmis_or_nearest_county_facility' end,
        case when n.assigned_facility_id is null then null else 0.85 end,
        'Source pcode: ' || n.pcode || '; payam: ' || coalesce(n.llg_name, 'unknown') || '; county: ' || coalesce(n.district_name, 'unknown'),
        case when n.assigned_facility_id is null then 'unserved' else 'mapped' end,
        case when coalesce(n.is_hard_to_reach, false) then 'high' when n.distance_to_facility > 10 then 'medium' else 'low' end,
        true, now(), now()
      from tmp_ssd_places n
      left join facilities f on f.id=n.assigned_facility_id
    `, [tenant.id]);

    await client.query("commit");

    const counts = {
      villages: (await client.query("select count(*)::int total, count(*) filter (where detection_source='ssd_populated_places')::int official_source, count(*) filter (where code !~ '^DEMO-')::int non_demo_codes from villages where tenant_id=$1", [tenant.id])).rows[0],
      settlementsMaster: (await client.query("select source, count(*)::int from settlements_master where tenant_id=$1 group by source order by source", [tenant.id])).rows,
    };

    report.results = {
      updatedByCode: updatedByCode.rowCount,
      updatedByUniqueName: updatedByUniqueName.rowCount,
      insertedVillages: insertedVillages.rowCount,
      insertedSettlements: insertedSettlements.rowCount,
      counts,
    };

    const reportPath = path.join(OUT_DIR, `ssd-community-settlement-report-${stamp}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ ok: true, reportPath, results: report.results }, null, 2));
  } catch (error) {
    try {
      await client.query("rollback");
    } catch (_) {
      // Ignore rollback errors after connection failures.
    }
    console.error(error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();

