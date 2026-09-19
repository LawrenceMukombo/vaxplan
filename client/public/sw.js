/**
 * VaxPlan Service Worker
 * Enables offline-first functionality, PWA installability, and
 * Background Sync for the offline mutation outbox.
 *
 * Strategy:
 * - Static assets (JS, CSS, fonts, images): Cache-First (fast loads)
 * - Map tiles (OpenStreetMap / CartoDB): Cache-First with 500-tile LRU
 * - API calls (/api/*): Network-First with stale fallback
 * - Navigation (HTML): Network-First with offline fallback page
 * - 'sync' event (tag: outbox-flush): drain Dexie outbox via
 *   POST /api/sync/batch even when the page/PWA is closed.
 */

const CACHE_VERSION = "vaxplan-v8";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const TILES_CACHE = `${CACHE_VERSION}-tiles`;
const API_CACHE = `${CACHE_VERSION}-api`;

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/offline.html",
  "/favicon.ico",
  "/favicon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];
const TILE_HOSTS = ["tile.openstreetmap.org", "tile.openstreetmap.fr", "opentopomap.org", "server.arcgisonline.com", "basemaps.cartocdn.com", "ogc.worldpop.org"];
const MAX_TILE_CACHE_ENTRIES = 2500;

const OUTBOX_SYNC_TAG = "outbox-flush";
const OUTBOX_DB_NAME = "VaxPlanOfflineDB";
const OUTBOX_STORE = "outbox";
const CONFLICT_STORE = "conflictLog";
const SYNC_META_STORE = "syncMeta";
const OUTBOX_LEASE_KEY = "outbox-flush-lease";
const OUTBOX_LEASE_TTL_MS = 30_000;
const MAX_RETRIES = 5;
const BATCH_ENDPOINT = "/api/sync/batch";

// Reference the Workbox precache manifest token so vite-plugin-pwa
// (when configured with strategies: 'injectManifest') can swap in the
// real precache list. Safe no-op if not present.
// eslint-disable-next-line no-undef
const WB_MANIFEST = self.__WB_MANIFEST || [];

// ─── Install: pre-cache critical assets ─────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.addAll(STATIC_ASSETS);
      // Best-effort precache of build-pinned URLs from Workbox manifest.
      const manifestUrls = WB_MANIFEST.map((e) => (typeof e === "string" ? e : e.url)).filter(
        Boolean,
      );
      if (manifestUrls.length) {
        try {
          await cache.addAll(manifestUrls);
        } catch {
          /* ignore individual failures */
        }
      }
      // Notify any open clients that a new SW is waiting to activate.
      const clients = await self.clients.matchAll({ includeUncontrolled: true });
      clients.forEach((c) => c.postMessage({ type: "SW_INSTALLED", version: CACHE_VERSION }));
    })(),
  );
});

// ─── Activate: clean up old cache versions ──────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("vaxplan-") && !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
      const clients = await self.clients.matchAll();
      clients.forEach((c) => c.postMessage({ type: "SW_ACTIVATED", version: CACHE_VERSION }));
    })(),
  );
});

// Allow page to trigger immediate skipWaiting (e.g. "Reload to update" button).
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data && event.data.type === "TRIGGER_OUTBOX_FLUSH") {
    event.waitUntil(drainOutbox());
  }
});

// ─── Fetch: routing logic ───────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  if (TILE_HOSTS.some((h) => url.hostname.includes(h))) {
    event.respondWith(tileStrategy(event.request));
    return;
  }
  if (url.pathname.startsWith("/api/")) {
    // Per Task #38 spec, /api/* requests bypass the SW cache so the
    // app always sees fresh data and the outbox/Background-Sync flow
    // is the single source of truth for offline writes.
    return;
  }
  if (url.pathname.match(/\.(js|css|png|jpg|svg|ico|woff2?|ttf)$/)) {
    event.respondWith(cacheFirst(event.request, STATIC_CACHE));
    return;
  }
  event.respondWith(navigationStrategy(event.request));
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return cached || new Response("", { status: 408 });
  }
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ error: "offline", message: "No network connection" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }
}

async function navigationStrategy(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      await cache.put(request, response.clone());
      await cache.put("/index.html", response.clone());
      await cache.put("/", response.clone());
    }
    return response;
  } catch {
    const cache = await caches.open(STATIC_CACHE);
    const cached =
      (await cache.match(request, { ignoreSearch: true })) ||
      (await cache.match("/index.html")) ||
      (await cache.match("/")) ||
      (await cache.match("/offline.html"));
    return (
      cached ||
      new Response("<!DOCTYPE html><html><head><title>VaxPlan</title></head><body>VaxPlan is loading offline...</body></html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      })
    );
  }
}

async function tileStrategy(request) {
  const cache = await caches.open(TILES_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const keys = await cache.keys();
      if (keys.length >= MAX_TILE_CACHE_ENTRIES) {
        await cache.delete(keys[0]);
      }
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("", { status: 503 });
  }
}

// ─── Background Sync: flush the offline outbox ───────────────────────────────
self.addEventListener("sync", (event) => {
  if (event.tag === OUTBOX_SYNC_TAG) {
    event.waitUntil(drainOutbox());
  }
});

async function notifyClients(type, payload = {}) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  clients.forEach((c) => c.postMessage({ type, ...payload }));
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OUTBOX_DB_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function readAllOutbox(db) {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(OUTBOX_STORE, "readonly");
      const store = tx.objectStore(OUTBOX_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    } catch (e) {
      resolve([]);
    }
  });
}

async function acquireWorkerOutboxLease(db) {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(SYNC_META_STORE, "readwrite");
      const store = tx.objectStore(SYNC_META_STORE);
      const getReq = store.get(OUTBOX_LEASE_KEY);
      getReq.onsuccess = () => {
        const now = Date.now();
        const current = getReq.result?.value;
        const expiresAt = current ? Number(current.split(":")[1]) : 0;
        if (current && expiresAt > now) {
          resolve(false);
          return;
        }
        const leaseVal = `sw:${now + OUTBOX_LEASE_TTL_MS}`;
        store.put({ key: OUTBOX_LEASE_KEY, value: leaseVal });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      };
      getReq.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

async function releaseWorkerOutboxLease(db) {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(SYNC_META_STORE, "readwrite");
      const store = tx.objectStore(SYNC_META_STORE);
      store.delete(OUTBOX_LEASE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function drainOutbox() {
  let db;
  try {
    db = await openDatabase();
  } catch {
    return;
  }
  const hasLease = await acquireWorkerOutboxLease(db);
  if (!hasLease) {
    db.close();
    return;
  }
  try {
    const items = await readAllOutbox(db);
    const pending = items.filter((i) => i.retries < MAX_RETRIES);
    if (pending.length === 0) return;

    await notifyClients("OUTBOX_FLUSH_START", { count: pending.length });

    const payload = {
      items: pending.map((item) => ({
        outboxId: item.id,
        tenantId: item.tenantId,
        entityType: item.entityType,
        method: item.method,
        url: item.url,
        body: item.body ? JSON.parse(item.body) : undefined,
        localId: item.localId,
      })),
    };

    const res = await fetch(BATCH_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      await notifyClients("OUTBOX_FLUSH_ERROR", { status: res.status });
      return;
    }

    const data = await res.json();
    const results = data.results || [];

    const tx = db.transaction([OUTBOX_STORE, CONFLICT_STORE], "readwrite");
    const outboxStore = tx.objectStore(OUTBOX_STORE);
    const conflictStore = tx.objectStore(CONFLICT_STORE);

    for (const r of results) {
      if (r.success) {
        outboxStore.delete(r.outboxId);
      } else {
        const item = pending.find((i) => i.id === r.outboxId);
        if (item) {
          item.retries += 1;
          item.lastError = r.error;
          if (item.retries >= MAX_RETRIES) {
            conflictStore.put({
              tenantId: item.tenantId,
              entityType: item.entityType,
              entityId: item.localId || String(item.id),
              clientValue: item.body || "",
              serverValue: JSON.stringify({ error: r.error }),
              resolvedAt: Date.now(),
            });
          }
          outboxStore.put(item);
        }
      }
    }

    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });

    await notifyClients("OUTBOX_FLUSH_COMPLETE", { results });
  } catch (err) {
    await notifyClients("OUTBOX_FLUSH_ERROR", { message: err.message });
  } finally {
    await releaseWorkerOutboxLease(db);
    db.close();
  }
}
