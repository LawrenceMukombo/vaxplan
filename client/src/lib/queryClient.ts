import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { offlineDb, enqueueOutbox } from "./offlineDb";
import { loadActiveTenant } from "./tenantCache";
import {
  broadcastLogout,
  clearClientAuthStorage,
  getValidOfflineUser,
  hasValidOfflineSession,
  recordOnlineAuthSession,
} from "./authSession";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorMsg = res.statusText || `HTTP ${res.status}`;
    try {
      const text = await res.text();
      if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
        errorMsg = `Server error (${res.status}): Endpoint unavailable or server initializing.`;
      } else {
        try {
          const json = JSON.parse(text);
          if (json.errors && Array.isArray(json.errors) && json.errors.length > 0) {
            const formatted = json.errors
              .map((e: any) => typeof e === "string" ? e : (e.message ? `${e.path && Array.isArray(e.path) && e.path.length > 0 ? e.path.join(".") + ": " : ""}${e.message}` : JSON.stringify(e)))
              .join("; ");
            errorMsg = json.message ? `${json.message}: ${formatted}` : formatted;
          } else {
            errorMsg = json.message || json.error || text;
          }
        } catch {
          errorMsg = text || errorMsg;
        }
      }
    } catch {
      // fallback to statusText
    }

    if (typeof errorMsg === "string" && (errorMsg.trim().startsWith("[") || errorMsg.trim().startsWith("{"))) {
      try {
        const parsed = JSON.parse(errorMsg);
        if (Array.isArray(parsed)) {
          errorMsg = parsed
            .map((e: any) => typeof e === "string" ? e : (e.message ? `${e.path && Array.isArray(e.path) && e.path.length > 0 ? e.path.join(".") + ": " : ""}${e.message}` : JSON.stringify(e)))
            .join("; ");
        } else if (typeof parsed === "object" && parsed !== null) {
          errorMsg = parsed.message || parsed.error || errorMsg;
        }
      } catch {
        // ignore
      }
    }

    throw new Error(errorMsg);
  }
}

// ─── Offline Database Query Router ──────────────────────────────────────────
async function getOfflineData(url: string): Promise<any> {
  const cleanUrl = url.startsWith("/") ? url : `/${url}`;
  
  // Extract path and query params
  const [pathname, searchStr] = cleanUrl.split("?");
  const searchParams = new URLSearchParams(searchStr || "");

  // Scope all entity reads to the active tenant so that platform admins
  // who browse multiple countries never see records from a previous country.
  const _activeTenantId = ((): string | null => {
    try { return loadActiveTenant()?.id ?? null; } catch { return null; }
  })();
  const _byTenant = async <T>(table: { toArray(): Promise<T[]>; where(idx: string): { equals(v: string): { toArray(): Promise<T[]> } } }): Promise<T[]> =>
    _activeTenantId ? table.where("tenantId").equals(_activeTenantId).toArray() : table.toArray();

  if (pathname === "/api/regions") {
    return await _byTenant(offlineDb.regions);
  }
  if (pathname === "/api/provinces") {
    return await _byTenant(offlineDb.provinces);
  }
  if (pathname === "/api/districts") {
    return await _byTenant(offlineDb.districts);
  }
  if (pathname === "/api/llgs") {
    return await _byTenant(offlineDb.llgs);
  }
  if (pathname === "/api/facilities") {
    return await _byTenant(offlineDb.facilities);
  }
  if (pathname === "/api/villages") {
    return await _byTenant(offlineDb.villages);
  }
  if (pathname === "/api/clients") {
    const facilityId = searchParams.get("facilityId");
    if (facilityId) {
      return await offlineDb.clients.where("facilityId").equals(Number(facilityId)).toArray();
    }
    return await _byTenant(offlineDb.clients);
  }
  if (pathname === "/api/vaccines/config" || pathname === "/api/vaccines") {
    return await _byTenant(offlineDb.vaccineConfigs);
  }
  if (pathname === "/api/population") {
    const records = await _byTenant<any>(offlineDb.populationData);
    const [offlineVillages, offlineFacilities] = await Promise.all([
      _byTenant<any>(offlineDb.villages),
      _byTenant<any>(offlineDb.facilities),
    ]);
    const villageById = new Map(offlineVillages.map((v: any) => [Number(v.id), v]));
    const facilityById = new Map(offlineFacilities.map((f: any) => [Number(f.id), f]));
    const source = searchParams.get("source");
    const year = searchParams.get("year");
    const provinceId = searchParams.get("provinceId");
    const districtId = searchParams.get("districtId");
    const villageId = searchParams.get("villageId");
    const facilityId = searchParams.get("facilityId");
    const excludeVillages = searchParams.get("excludeVillages") === "true" && source !== "worldpop";

    return records.filter((record: any) => {
      if (source && String(record.source ?? "").toLowerCase() !== source.toLowerCase()) return false;
      if (year && Number(record.year) !== Number(year)) return false;
      if (provinceId && Number(record.provinceId) !== Number(provinceId)) return false;
      if (districtId && Number(record.districtId) !== Number(districtId)) return false;
      if (villageId && Number(record.villageId) !== Number(villageId)) return false;
      if (facilityId && Number(record.facilityId) !== Number(facilityId)) return false;
      if (excludeVillages && record.villageId != null) return false;
      return true;
    }).map((record: any) => {
      const metadata =
        record.metadata && typeof record.metadata === "object" && !Array.isArray(record.metadata)
          ? record.metadata
          : {};
      const village = record.villageId ? villageById.get(Number(record.villageId)) : null;
      const facility =
        record.facilityId
          ? facilityById.get(Number(record.facilityId))
          : village?.assignedFacilityId
            ? facilityById.get(Number(village.assignedFacilityId))
            : null;
      const communityName =
        village?.name ??
        record._geoCommunityName ??
        record._geoVillageName ??
        record.villageName ??
        metadata.communityName ??
        metadata.villageName ??
        metadata.catchmentName ??
        null;
      const facilityName =
        facility?.name ??
        record._geoFacilityName ??
        record.facilityName ??
        metadata.facilityName ??
        metadata.healthFacilityName ??
        metadata.hfName ??
        null;

      return {
        ...record,
        _geoCommunityName: communityName,
        _geoVillageName: communityName,
        _geoFacilityName: facilityName,
        metadata: {
          ...metadata,
          ...(communityName ? { communityName, villageName: communityName } : {}),
          ...(facilityName ? { facilityName } : {}),
          ...(facility?.hmisCode ? { facilityHmisCode: facility.hmisCode } : {}),
        },
      };
    });
  }
  if (pathname === "/api/stock/ledger") {
    const facilityId = searchParams.get("facilityId");
    if (facilityId) {
      return await offlineDb.stockTransactions.where("facilityId").equals(Number(facilityId)).toArray();
    }
    return await _byTenant(offlineDb.stockTransactions);
  }
  if (pathname === "/api/monthly-reports") {
    const facilityId = searchParams.get("facilityId");
    if (facilityId) {
      return await offlineDb.monthlyReports.where("facilityId").equals(Number(facilityId)).toArray();
    }
    return await _byTenant(offlineDb.monthlyReports);
  }
  if (pathname === "/api/sessions" || pathname === "/api/session-plans") {
    return await _byTenant(offlineDb.sessionPlans);
  }
  if (pathname === "/api/session-day-plans") {
    return await _byTenant(offlineDb.sessionDayPlans);
  }
  if (pathname === "/api/sessions/villages") {
    return await _byTenant(offlineDb.sessionVillageLinks);
  }
  if (pathname === "/api/microplans") {
    return await _byTenant(offlineDb.microplans);
  }
  if (pathname === "/api/budget-items") {
    return await _byTenant(offlineDb.budgetItems);
  }
  if (pathname === "/api/mobilization") {
    return await _byTenant(offlineDb.mobilizationActivities);
  }
  if (pathname === "/api/supervision-visits") {
    const facilityId = searchParams.get("facilityId");
    const status = searchParams.get("status");
    let rows = await _byTenant(offlineDb.supervisionVisits);
    if (facilityId) rows = rows.filter((r: any) => Number(r.facilityId) === Number(facilityId));
    if (status && status !== "all") rows = rows.filter((r: any) => r.status === status);
    return rows;
  }
  if (pathname === "/api/supervision-checklist-templates") {
    return await offlineDb.supervisionTemplates.toArray();
  }
  if (pathname === "/api/cold-chain") {
    const facilityId = searchParams.get("facilityId");
    if (facilityId) {
      return await offlineDb.coldChainEquipment.where("facilityId").equals(Number(facilityId)).toArray();
    }
    return await _byTenant(offlineDb.coldChainEquipment);
  }
  if (pathname === "/api/gis-polygons") {
    return await _byTenant(offlineDb.gisPolygons);
  }
  if (pathname === "/api/settlements") {
    return await _byTenant(offlineDb.settlements);
  }

  // Handle dynamic / parameterized endpoints
  const microplanDetailRegex = /^\/api\/microplans\/([^/]+)$/;
  const matchMicroplan = pathname.match(microplanDetailRegex);
  if (matchMicroplan) {
    const rawId = matchMicroplan[1];
    const id = isNaN(Number(rawId)) ? rawId : Number(rawId);
    return (await offlineDb.microplans.get(id as any)) || null;
  }

  const supervisionDetailRegex = /^\/api\/supervision-visits\/([^/]+)$/;
  const matchSupervision = pathname.match(supervisionDetailRegex);
  if (matchSupervision) {
    const rawId = matchSupervision[1];
    const id = isNaN(Number(rawId)) ? rawId : Number(rawId);
    return (await offlineDb.supervisionVisits.get(id as any)) || null;
  }

  const clientsVaccinationsRegex = /^\/api\/clients\/([^/]+)\/vaccinations$/;
  const matchVaccinations = pathname.match(clientsVaccinationsRegex);
  if (matchVaccinations) {
    const clientId = matchVaccinations[1];
    return await offlineDb.clientVaccinations.where("clientId").equals(clientId).toArray();
  }

  const facilityCatchmentRegex = /^\/api\/facilities\/([^/]+)\/catchments$/;
  const matchCatchment = pathname.match(facilityCatchmentRegex);
  if (matchCatchment) {
    const fid = Number(matchCatchment[1]);
    if (!isNaN(fid)) {
      return await offlineDb.gisPolygons.where("facilityId").equals(fid).toArray();
    }
    return [];
  }

  if (pathname === "/api/auth/user") {
    return getValidOfflineUser();
  }

  if (pathname === "/api/me/tenant") {
    const tenantIdRow = await offlineDb.syncMeta.get("tenantId");
    const tenantId = tenantIdRow?.value || "1";
    // Resolve dynamically based on offline active tenant ID as well as URL path fallbacks
    const isZambia = tenantId === "2" || tenantId === "4bb7abba-11cd-4c99-96c2-eedc8a4dfd06" || (typeof window !== "undefined" && (window.location.hostname.includes("zambia") || window.location.href.includes("ZMB")));
    const isSSD = tenantId === "3" || tenantId === "705728db-4892-49d7-9b67-35aa67c7574b" || (typeof window !== "undefined" && (window.location.hostname.includes("sudan") || window.location.href.includes("SSD")));
    const isZAF = tenantId === "4" || tenantId === "c43e2923-b2d9-4175-a1a8-ff6b0cd58810" || (typeof window !== "undefined" && (window.location.hostname.includes("south-africa") || window.location.href.includes("ZAF")));

    // Original Code (Mock returning Zambia vs South Sudan with 4-level/5-level mismatch):
    /*
    const isZambia = tenantId === "2" || (typeof window !== "undefined" && (window.location.hostname.includes("zambia") || window.location.href.includes("ZMB")));
    return {
      id: Number(tenantId) || tenantId,
      name: isZambia ? "Republic of Zambia Ministry of Health" : "Republic of South Sudan Ministry of Health",
      countryCode: isZambia ? "ZMB" : "SSD",
      settings: {
        skipRegionLevel: isZambia,
        adminLevelLabels: {
          level1: isZambia ? "Province" : "Region",
          level2: isZambia ? "District" : "Province",
          level3: isZambia ? "Facility" : "District",
          level4: isZambia ? "Ward" : "LLG",
          level5: "Village"
        }
      }
    };
    */

    /*
    // Updated Code: Fully aligned offline dynamic mock tenant details for PNG, SSD, and Zambia
    return {
      id: Number(tenantId) || tenantId,
      name: isZambia 
        ? "Republic of Zambia Ministry of Health" 
        : isSSD 
          ? "Republic of South Sudan Ministry of Health" 
          : "Papua New Guinea National Department of Health",
      countryCode: isZambia ? "ZMB" : isSSD ? "SSD" : "PNG",
      settings: {
        skipRegionLevel: true, // skip region level for all countries to start Level 1 at Province/State
        adminLevelLabels: {
          level1: "Region",
          level2: isZambia ? "Province" : isSSD ? "State" : "Province",
          level3: isZambia ? "District" : isSSD ? "County" : "District",
          level4: isZambia ? "Ward" : isSSD ? "Payam" : "LLG",
          level5: "Village"
        }
      }
    };
    */

    // Refactored Code: Fully aligned offline dynamic mock tenant details for PNG, SSD, Zambia, and South Africa (ZAF)
    return {
      id: Number(tenantId) || tenantId,
      name: isZambia 
        ? "Republic of Zambia Ministry of Health" 
        : isSSD 
          ? "Republic of South Sudan Ministry of Health" 
          : isZAF
            ? "Republic of South Africa National Department of Health"
            : "Papua New Guinea National Department of Health",
      countryCode: isZambia ? "ZMB" : isSSD ? "SSD" : isZAF ? "ZAF" : "PNG",
      settings: {
        skipRegionLevel: true, // skip region level for all countries to start Level 1 at Province/State
        adminLevelLabels: {
          level1: "Region",
          level2: isZambia ? "Province" : isSSD ? "State" : isZAF ? "Province" : "Province",
          level3: isZambia ? "District" : isSSD ? "County" : isZAF ? "District" : "District",
          level4: isZambia ? "Ward" : isSSD ? "Payam" : isZAF ? "Sub-district" : "LLG",
          level5: "Village"
        }
      }
    };
  }

  if (pathname === "/api/public/tenants") {
    /*
    return [
      { id: 1, name: "South Sudan EPI", countryCode: "SSD" },
      { id: 2, name: "Zambia EPI", countryCode: "ZMB" }
    ];
    */
    return [
      { id: "8c2f81fb-06f3-4688-90ea-e9ae27d73191", name: "Papua New Guinea National Department of Health", countryCode: "PNG" },
      { id: "705728db-4892-49d7-9b67-35aa67c7574b", name: "Republic of South Sudan Ministry of Health", countryCode: "SSD" },
      { id: "4bb7abba-11cd-4c99-96c2-eedc8a4dfd06", name: "Republic of Zambia Ministry of Health", countryCode: "ZMB" },
      { id: "c43e2923-b2d9-4175-a1a8-ff6b0cd58810", name: "Republic of South Africa National Department of Health", countryCode: "ZAF" }
    ];
  }

  if (pathname === "/api/users") {
    return [];
  }

  throw new Error(`Offline query mapping not found for URL: ${url}`);
}

/* Original Code commented out for backward-compatibility and strict traceability:
// ─── Offline Database Mutation Router ───────────────────────────────────────
async function writeToIndexedDB(method: string, url: string, data: any): Promise<void> {
  const cleanUrl = url.startsWith("/") ? url : `/${url}`;
  const [pathname] = cleanUrl.split("?");
  const segments = pathname.split("/").filter(Boolean);
  
  if (segments[0] !== "api") return;
  const resource = segments[1];
  const idStr = segments[2];

  let table: any = null;
  if (resource === "regions") table = offlineDb.regions;
  else if (resource === "provinces") table = offlineDb.provinces;
  else if (resource === "districts") table = offlineDb.districts;
  else if (resource === "llgs") table = offlineDb.llgs;
  else if (resource === "facilities") table = offlineDb.facilities;
  else if (resource === "villages") table = offlineDb.villages;
  else if (resource === "clients") {
    if (segments[3] === "vaccinations") {
      table = offlineDb.clientVaccinations;
    } else {
      table = offlineDb.clients;
    }
  } 
  else if (resource === "sessionPlans" || resource === "sessions") {
    table = offlineDb.sessionPlans;
  } else if (resource === "session-day-plans" || resource === "sessionDayPlans") {
    table = offlineDb.sessionDayPlans;
  }
  else if (resource === "budgetItems" || resource === "budget-items") {
    table = offlineDb.budgetItems;
  } else if (resource === "mobilization") {
    table = offlineDb.mobilizationActivities;
  } else if (resource === "stock") {
    if (segments[2] === "transaction") {
      table = offlineDb.stockTransactions;
    }
  } else if (resource === "monthly-reports") {
    table = offlineDb.monthlyReports;
  } else if (resource === "microplans") {
    table = offlineDb.microplans;
  } else if (resource === "supervision-visits") {
    table = offlineDb.supervisionVisits;
  } else if (resource === "supervision-checklist-templates") {
    table = offlineDb.supervisionTemplates;
  } else if (resource === "cold-chain") {
    table = offlineDb.coldChainEquipment;
  } else if (resource === "gis-polygons") {
    table = offlineDb.gisPolygons;
  } else if (resource === "settlements") {
    table = offlineDb.settlements;
  } else if (resource === "population") {
    table = offlineDb.populationData;
  } else if (resource === "vaccines") {
    if (segments[2] === "config") {
      table = offlineDb.vaccineConfigs;
    }
  }

  if (!table) return;

  const id = idStr ? (isNaN(Number(idStr)) ? idStr : Number(idStr)) : data?.id;

  if (method === "POST") {
    await table.put({ ...data, _syncedAt: Date.now() });
  } else if (method === "PUT" || method === "PATCH") {
    if (id !== undefined) {
      const existing = await table.get(id);
      await table.put({ ...existing, ...data, _syncedAt: Date.now() });
    }
  } else if (method === "DELETE") {
    if (id !== undefined) {
      await table.delete(id);
    }
  }
}

async function handleOfflineMutation(method: string, url: string, data: any): Promise<any> {
  const cleanUrl = url.startsWith("/") ? url : `/${url}`;
  const [pathname] = cleanUrl.split("?");

  if (pathname === "/api/me/switch-tenant") {
    const targetId = String(data.tenantId);
    await offlineDb.syncMeta.put({ key: "tenantId", value: targetId });
    return { success: true };
  }

  const tenantRow = await offlineDb.syncMeta.get("tenantId");
  const tenantId = tenantRow?.value || "1";
  const segments = pathname.split("/").filter(Boolean);
  const resource = segments[1];

  let itemData = { ...data };
  if (method === "POST" && !itemData.id) {
    if (resource === "clients") {
      itemData.id = crypto.randomUUID();
    } else {
      itemData.id = Math.floor(Date.now() + Math.random() * 1000);
    }
    itemData.tenantId = tenantId;
    itemData._localOnly = true;
  }

  await writeToIndexedDB(method, url, itemData);

  await enqueueOutbox({
    tenantId,
    entityType: resource,
    method: method as any,
    url: cleanUrl,
    body: JSON.stringify(itemData),
    localId: itemData.id ? String(itemData.id) : undefined,
  });

  // Dynamic status refresh in background
  setTimeout(() => {
    import("./syncEngine").then(({ syncEngine }) => {
      syncEngine.refreshPendingCount(tenantId);
    });
  }, 100);

  return itemData;
}
*/

// ─── Offline Database Mutation Router ───────────────────────────────────────
async function writeToIndexedDB(method: string, url: string, data: any): Promise<void> {
  const cleanUrl = url.startsWith("/") ? url : `/${url}`;
  const [pathname] = cleanUrl.split("?");
  const segments = pathname.split("/").filter(Boolean);
  
  if (segments[0] !== "api") return;
  const resource = segments[1];
  const idStr = segments[2];
  const isBulk = segments[segments.length - 1] === "bulk";

  let table: any = null;
  if (resource === "regions") table = offlineDb.regions;
  else if (resource === "provinces") table = offlineDb.provinces;
  else if (resource === "districts") table = offlineDb.districts;
  else if (resource === "llgs") table = offlineDb.llgs;
  else if (resource === "facilities") table = offlineDb.facilities;
  else if (resource === "villages") table = offlineDb.villages;
  else if (resource === "clients") {
    if (segments[3] === "vaccinations") {
      table = offlineDb.clientVaccinations;
    } else {
      table = offlineDb.clients;
    }
  } 
  else if (resource === "sessionPlans" || resource === "sessions") {
    if (segments[2] === "days" || segments[2] === "day-plans") {
      table = offlineDb.sessionDayPlans;
    } else {
      table = offlineDb.sessionPlans;
    }
  } else if (resource === "session-day-plans" || resource === "sessionDayPlans") {
    table = offlineDb.sessionDayPlans;
  }
  else if (resource === "budgetItems" || resource === "budget-items") {
    table = offlineDb.budgetItems;
  } else if (resource === "mobilization") {
    table = offlineDb.mobilizationActivities;
  } else if (resource === "stock") {
    if (segments[2] === "transaction") {
      table = offlineDb.stockTransactions;
    }
  } else if (resource === "monthly-reports") {
    table = offlineDb.monthlyReports;
  } else if (resource === "population") {
    if (segments[2] === "estimate-polygon" || segments[2] === "worldpop-point") {
      return;
    }
    if (segments[2] === "import") {
      if (data && Array.isArray(data.records)) {
        for (const record of data.records) {
          await offlineDb.populationData.put({ ...record, _syncedAt: Date.now() });
        }
      }
      return;
    }
    table = offlineDb.populationData;
  } else if (resource === "vaccines") {
    if (segments[2] === "config") {
      table = offlineDb.vaccineConfigs;
    }
  }

  if (!table) return;

  if (method === "POST" && isBulk) {
    if (data && Array.isArray(data.results)) {
      for (const result of data.results) {
        if (result.ok && result.data) {
          await table.put({ ...result.data, _syncedAt: Date.now() });
        }
      }
    }
    return;
  }

  const id = idStr ? (isNaN(Number(idStr)) ? idStr : Number(idStr)) : data?.id;

  if (method === "POST") {
    await table.put({ ...data, _syncedAt: Date.now() });
  } else if (method === "PUT" || method === "PATCH") {
    if (id !== undefined) {
      const existing = await table.get(id);
      await table.put({ ...existing, ...data, _syncedAt: Date.now() });
    }
  } else if (method === "DELETE") {
    if (id !== undefined) {
      await table.delete(id);
    }
  }
}

async function handleOfflineMutation(method: string, url: string, data: any): Promise<any> {
  const cleanUrl = url.startsWith("/") ? url : `/${url}`;
  const [pathname] = cleanUrl.split("?");

  if (pathname === "/api/me/switch-tenant") {
    const targetId = String(data.tenantId);
    await offlineDb.syncMeta.put({ key: "tenantId", value: targetId });
    return { success: true };
  }

  const tenantRow = await offlineDb.syncMeta.get("tenantId");
  const tenantId = tenantRow?.value || "1";
  const segments = pathname.split("/").filter(Boolean);
  const resource = segments[1];
  const isBulk = segments[segments.length - 1] === "bulk";

  if (method === "POST" && pathname === "/api/population/import") {
    const items = Array.isArray((data as any)?.population) ? (data as any).population : [];
    const records = [];

    for (const item of items) {
      const itemData = { ...item };
      const metadata =
        itemData.metadata && typeof itemData.metadata === "object" && !Array.isArray(itemData.metadata)
          ? itemData.metadata
          : {};
      const communityName = itemData.villageName ?? itemData.communityName ?? metadata.communityName ?? metadata.villageName;
      const facilityName = itemData.facilityName ?? metadata.facilityName ?? metadata.healthFacilityName ?? metadata.hfName;
      itemData._geoCommunityName = itemData._geoCommunityName ?? communityName ?? null;
      itemData._geoVillageName = itemData._geoVillageName ?? communityName ?? null;
      itemData._geoFacilityName = itemData._geoFacilityName ?? facilityName ?? null;
      itemData.metadata = {
        ...metadata,
        ...(communityName ? { communityName, villageName: communityName } : {}),
        ...(facilityName ? { facilityName } : {}),
        ...(itemData.villageCode ? { villageCode: itemData.villageCode } : {}),
        ...(itemData.facilityHmisCode ? { facilityHmisCode: itemData.facilityHmisCode } : {}),
      };
      if (!itemData.id) {
        itemData.id = Math.floor(Date.now() + Math.random() * 1000);
      }
      itemData.tenantId = tenantId;
      itemData._localOnly = true;
      await offlineDb.populationData.put({ ...itemData, _syncedAt: Date.now() });
      records.push(itemData);
    }

    await enqueueOutbox({
      tenantId,
      entityType: "population",
      method: method as any,
      url: cleanUrl,
      body: JSON.stringify({ population: items }),
      localId: "population-import",
    });

    setTimeout(() => {
      import("./syncEngine").then(({ syncEngine }) => {
        syncEngine.refreshPendingCount(tenantId);
      });
    }, 100);

    return {
      success: true,
      createdCount: records.length,
      updatedCount: 0,
      skippedCount: 0,
      records,
    };
  }

  if (method === "POST" && isBulk) {
    const items = Array.isArray(data?.items) ? data.items : [];
    const results = [];
    
    let table: any = null;
    if (resource === "population") table = offlineDb.populationData;
    else if (resource === "sessionPlans" || resource === "sessions") {
      if (segments[2] === "days" || segments[2] === "day-plans") {
        table = offlineDb.sessionDayPlans;
      } else {
        table = offlineDb.sessionPlans;
      }
    } else if (resource === "session-day-plans" || resource === "sessionDayPlans") {
      table = offlineDb.sessionDayPlans;
    } else if (resource === "budgetItems" || resource === "budget-items") {
      table = offlineDb.budgetItems;
    } else if (resource === "mobilization") {
      table = offlineDb.mobilizationActivities;
    }

    for (const item of items) {
      const itemData = { ...item };
      if (!itemData.id) {
        if (resource === "clients") {
          itemData.id = crypto.randomUUID();
        } else {
          itemData.id = Math.floor(Date.now() + Math.random() * 1000);
        }
      }
      itemData.tenantId = tenantId;
      itemData._localOnly = true;

      if (table) {
        await table.put({ ...itemData, _syncedAt: Date.now() });
      }

      results.push({
        clientId: item.clientId,
        ok: true,
        id: itemData.id,
        data: itemData
      });
    }

    const bulkResponse = { results };

    await enqueueOutbox({
      tenantId,
      entityType: resource,
      method: method as any,
      url: cleanUrl,
      body: JSON.stringify({ items: results.map(r => r.data) }),
      localId: "bulk",
    });

    setTimeout(() => {
      import("./syncEngine").then(({ syncEngine }) => {
        syncEngine.refreshPendingCount(tenantId);
      });
    }, 100);

    return bulkResponse;
  }

  let itemData = { ...data };
  if (method === "POST" && !itemData.id) {
    if (resource === "clients") {
      itemData.id = crypto.randomUUID();
    } else {
      itemData.id = Math.floor(Date.now() + Math.random() * 1000);
    }
    itemData.tenantId = tenantId;
    itemData._localOnly = true;
  }

  await writeToIndexedDB(method, url, itemData);

  await enqueueOutbox({
    tenantId,
    entityType: resource,
    method: method as any,
    url: cleanUrl,
    body: JSON.stringify(itemData),
    localId: itemData.id ? String(itemData.id) : undefined,
  });

  // Dynamic status refresh in background
  setTimeout(() => {
    import("./syncEngine").then(({ syncEngine }) => {
      syncEngine.refreshPendingCount(tenantId);
    });
  }, 100);

  return itemData;
}

// ─── API Requests ───────────────────────────────────────────────────────────
export async function apiRequest<T = unknown>(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<T> {
  // If browser network state is offline, run mutation locally and queue in outbox
  const isOffline = !navigator.onLine;
  if (isOffline && method !== "GET") {
    if (!hasValidOfflineSession()) {
      throw new Error("Offline authentication required. Reconnect and sign in again.");
    }
    return await handleOfflineMutation(method, url, data) as T;
  }

  // True network failures (fetch rejects — no response received) fall back to
  // the offline outbox. HTTP responses (including 4xx/5xx) must be surfaced
  // to the caller so the UI can show a real error toast, NOT silently queued.
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });
  } catch (err) {
    if (method !== "GET") {
      if (!hasValidOfflineSession()) {
        throw new Error("Offline authentication required. Reconnect and sign in again.");
      }
      console.warn("Network request failed, falling back to local database write:", err);
      return await handleOfflineMutation(method, url, data) as T;
    }
    throw err;
  }

  await throwIfResNotOk(res);

  if (res.status === 204) {
    try {
      if (method === "DELETE") {
        await writeToIndexedDB(method, url, data);
      }
    } catch (e) {
      console.warn("IndexedDB cache delete failed:", e);
    }
    return undefined as T;
  }
  let resultData: any;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    resultData = await res.json();
  } else {
    const textData = await res.text();
    try {
      resultData = JSON.parse(textData);
    } catch {
      resultData = { success: true, message: textData };
    }
  }

  // After success write on server, update local IndexedDB cache in background
  try {
    if (method !== "GET") {
      await writeToIndexedDB(method, url, resultData || data);
    }
  } catch (e) {
    console.warn("IndexedDB cache update failed:", e);
  }

  return resultData;
}

// ─── Original TanStack React Query Configuration (Commented out to follow rule 2) ───
/*
type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      retry: false,
      networkMode: "offlineFirst",
    },
    mutations: {
      retry: false,
      networkMode: "offlineFirst",
    },
  },
});
*/

// ─── Refactored TanStack React Query with Offline-First Bridging ───────────
type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/") as string;
    const isOffline = !navigator.onLine;
    const pathname = url.split("?")[0];
    const isAuthUserQuery = pathname === "/api/auth/user";
    const isPublicQuery =
      pathname === "/api/public/tenants" ||
      pathname === "/api/auth/session-config";

    // Immediately resolve from local IndexedDB if offline
    if (isOffline) {
      try {
        if (!isAuthUserQuery && !isPublicQuery && !hasValidOfflineSession()) {
          throw new Error("Offline authentication required. Reconnect and sign in again.");
        }
        return await getOfflineData(url);
      } catch (e) {
        console.warn("Offline IndexedDB fetch failed:", e);
      }
    }

    let res: Response;
    try {
      res = await fetch(url, {
        credentials: "include",
      });
    } catch (err) {
      // Genuine network failure (fetch rejected — no response). Fall back to
      // local IndexedDB so the app stays usable when truly offline.
      try {
        console.warn("Network unreachable, falling back to local IndexedDB:", err);
        if (!isAuthUserQuery && !isPublicQuery && !hasValidOfflineSession()) {
          throw err;
        }
        return await getOfflineData(url);
      } catch (offlineErr) {
        throw err;
      }
    }

    const contentType = res.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");

    if (res.status === 401) {
      if (isAuthUserQuery) {
        // Attempt native device token session restoration before giving up
        try {
          const { restoreSessionFromDeviceToken } = await import("./deviceAuth");
          const restored = await restoreSessionFromDeviceToken();
          if (restored) {
            const retryRes = await fetch(url, { credentials: "include" });
            if (retryRes.ok) return await retryRes.json();
          }
        } catch {
          /* ignore token restore failure */
        }

        // Fall back to valid offline session user if available
        if (hasValidOfflineSession()) {
          const offlineUser = getValidOfflineUser();
          if (offlineUser) return offlineUser;
        }
      }

      if (typeof window !== "undefined") {
        clearClientAuthStorage({
          reason: "unauthenticated",
          message: "Session expired. Please sign in again.",
        });
        broadcastLogout("unauthenticated");
      }
      
      if (unauthorizedBehavior === "returnNull") {
        return null;
      }
    }

    // A clean JSON response from the server — including 4xx like 403
    // (cross-tenant write blocked) — is a real answer, not an offline
    // situation. Surface it to the caller so the toast layer sees the
    // server's actual message instead of falling through to IndexedDB.
    if (isJson) {
      if (!res.ok) {
        let message = `${res.status}`;
        try {
          const body = await res.json();
          if (body && typeof body === "object" && body.message) {
            message = `${res.status}: ${body.message}`;
          } else {
            message = `${res.status}: ${JSON.stringify(body)}`;
          }
        } catch {
          message = `${res.status}: ${res.statusText}`;
        }
        throw new Error(message);
      }
      const data = await res.json();
      if (url === "/api/auth/user" && data) {
        recordOnlineAuthSession(data);
      }
      return data;
    }

    // Non-JSON response — likely an HTML error page (Vite SPA fallback,
    // proxy error, gateway timeout, etc.). Try the IndexedDB cache so the
    // user still sees data; if that also fails, surface the original error.
    const nonJsonErr = new Error(
      `${res.status}: Server returned non-JSON (${contentType.split(";")[0] || "unknown"})`,
    );
    try {
      console.warn("Server returned non-JSON, falling back to local IndexedDB:", nonJsonErr);
      return await getOfflineData(url);
    } catch (offlineErr) {
      throw nonJsonErr;
    }
  };

export function getOfflineStaleTime(): number {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("vaxplan_offline_stale_hours");
    if (saved) {
      const hours = parseFloat(saved);
      if (!isNaN(hours)) return hours * 60 * 60 * 1000;
    }
  }
  // Default to 2 hours
  return 2 * 60 * 60 * 1000;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      /* Original staleTime function (unsupported by TanStack Query, evaluated as NaN/0 causing infinite refetch loops):
      staleTime: () => {
        const isOffline = !navigator.onLine;
        if (isOffline) {
          return getOfflineStaleTime();
        }
        // If system is online, cache resources for 5 minutes to ensure high performance and prevent refetch loops
        return 5 * 60 * 1000;
      },
      */
      // Static staleTime — 5 minutes. For offline scenarios the queryFn resolves
      // instantly from IndexedDB regardless of staleTime, so there is no need for
      // a dynamic getter here. Using a plain number avoids referential instability
      // that ES6 getters can cause in React's render cycle (which was triggering
      // "Too many re-renders" infinite loops).
      staleTime: 5 * 60 * 1000,
      retry: false,
      networkMode: "offlineFirst",
    },
    mutations: {
      retry: false,
      networkMode: "offlineFirst",
    },
  },
});
