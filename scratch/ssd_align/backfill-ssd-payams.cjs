const fs = require("fs");

function loadEnv() {
  const envText = fs.readFileSync("C:/vaxplan/.env", "utf8");
  for (const line of envText.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let value = m[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[m[1]] = value;
  }
}

function key(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function ringContains(point, ring) {
  const x = point[0];
  const y = point[1];
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = Number(ring[i][0]);
    const yi = Number(ring[i][1]);
    const xj = Number(ring[j][0]);
    const yj = Number(ring[j][1]);
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInPolygon(point, geometry) {
  if (!geometry) return false;
  if (geometry.type === "Polygon") {
    if (!ringContains(point, geometry.coordinates[0] || [])) return false;
    for (let i = 1; i < geometry.coordinates.length; i++) {
      if (ringContains(point, geometry.coordinates[i])) return false;
    }
    return true;
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some((polygon) => pointInPolygon(point, { type: "Polygon", coordinates: polygon }));
  }
  return false;
}

function bboxOfGeometry(geometry) {
  const bbox = [Infinity, Infinity, -Infinity, -Infinity];
  const visit = (coords) => {
    if (!Array.isArray(coords)) return;
    if (typeof coords[0] === "number" && typeof coords[1] === "number") {
      bbox[0] = Math.min(bbox[0], coords[0]);
      bbox[1] = Math.min(bbox[1], coords[1]);
      bbox[2] = Math.max(bbox[2], coords[0]);
      bbox[3] = Math.max(bbox[3], coords[1]);
      return;
    }
    coords.forEach(visit);
  };
  visit(geometry?.coordinates);
  return bbox.every(Number.isFinite) ? bbox : null;
}

function inBbox(point, bbox) {
  return bbox && point[0] >= bbox[0] && point[0] <= bbox[2] && point[1] >= bbox[1] && point[1] <= bbox[3];
}

function sqlLiteral(value) {
  if (value == null) return "null";
  return `'${String(value).replace(/'/g, "''")}'`;
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
  try {
    const tenant = (await client.query("select id from tenants where code='SSD' limit 1")).rows[0];
    if (!tenant) throw new Error("SSD tenant not found");
    const boundary = (await client.query("select geojson from admin_boundaries where tenant_id=$1 and admin_level=3 limit 1", [tenant.id])).rows[0]?.geojson;
    if (!boundary?.features?.length) throw new Error("SSD ADM3 boundary FeatureCollection not found");
    const llgs = (await client.query("select id,name,code,district_id from llgs where tenant_id=$1", [tenant.id])).rows;
    const llgByCode = new Map(llgs.map((l) => [key(l.code), l]));
    const llgByNameDistrict = new Map(llgs.map((l) => [`${key(l.name)}|${l.district_id}`, l]));

    const features = boundary.features.map((feature) => {
      const props = feature.properties || {};
      const code = props.admin3_pcode || props.admin3Pcod || props.ADM3_PCODE || props.ADM3PCODE || props.pcode || props.code;
      const name = props.admin3_name || props.adm3_ref_name || props.admin3Name || props.ADM3_EN || props.ADM3_NAME || props.name || props.Name;
      const countyCode = props.admin2_pcode || props.admin2Pcod || props.ADM2_PCODE || props.ADM2PCODE;
      return {
        code,
        name,
        countyCode,
        geometry: feature.geometry,
        bbox: bboxOfGeometry(feature.geometry),
      };
    });

    const districts = (await client.query("select id,code from districts where tenant_id=$1", [tenant.id])).rows;
    const districtByCode = new Map(districts.map((d) => [key(d.code), d]));

    const villages = (await client.query(
      "select id,code,name,district_id,latitude,longitude from villages where tenant_id=$1 and detection_source='ssd_populated_places' and llg_id is null and latitude is not null and longitude is not null",
      [tenant.id]
    )).rows;

    const updates = [];
    for (const village of villages) {
      const point = [Number(village.longitude), Number(village.latitude)];
      const matches = features.filter((f) => inBbox(point, f.bbox) && pointInPolygon(point, f.geometry));
      if (!matches.length) continue;
      let llg = null;
      for (const match of matches) {
        llg = llgByCode.get(key(match.code));
        if (!llg && match.name) {
          const district = match.countyCode ? districtByCode.get(key(match.countyCode)) : null;
          llg = llgByNameDistrict.get(`${key(match.name)}|${district?.id || village.district_id}`);
        }
        if (llg) break;
      }
      if (llg) updates.push({ id: village.id, llgId: llg.id });
    }

    await client.query("begin");
    for (let i = 0; i < updates.length; i += 1000) {
      const batch = updates.slice(i, i + 1000);
      const values = batch.map((u) => `(${u.id},${u.llgId})`).join(",");
      await client.query(`
        update villages v
        set llg_id=u.llg_id, updated_at=now()
        from (values ${values}) as u(id,llg_id)
        where v.id=u.id
      `);
    }
    await client.query("commit");
    console.log(JSON.stringify({ ok: true, candidates: villages.length, updated: updates.length }, null, 2));
  } catch (error) {
    try { await client.query("rollback"); } catch (_) {}
    console.error(error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
