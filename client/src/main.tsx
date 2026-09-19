import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Service workers are supported on secure origins and localhost. Keeping the
// worker enabled on localhost is essential: field/offline acceptance tests are
// performed there before a release is deployed.

// ─── Global Fetch Interceptor for Tenant Context Persistence ─────────────────
import { resolveApiUrl, isNativeShell } from "./lib/apiBase";

const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  // In a packaged native shell (Android/Windows), rewrite relative "/api/..."
  // calls to the configured remote server. On the web this is a no-op so
  // requests stay same-origin/relative.
  if (isNativeShell()) {
    try {
      if (typeof input === "string") {
        const resolved = resolveApiUrl(input);
        if (resolved !== input) {
          input = resolved;
          // Force cross-origin credentials so the session cookie is sent
          // (overrides any caller default of "same-origin").
          init = { ...(init || {}), credentials: "include" };
        }
      } else if (input instanceof URL) {
        const resolved = resolveApiUrl(input.toString());
        if (resolved !== input.toString()) {
          input = resolved;
          init = { ...(init || {}), credentials: "include" };
        }
      } else if (input instanceof Request) {
        const resolved = resolveApiUrl(input.url);
        if (resolved !== input.url) {
          input = new Request(resolved, input);
          init = { ...(init || {}), credentials: "include" };
        }
      }
    } catch {
      /* fall through with the original input */
    }
  }

  let activeTenantId: string | null = null;
  try {
    const raw = localStorage.getItem("vaxplan_active_tenant");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.id === "string") {
        activeTenantId = parsed.id;
      } else if (parsed && typeof parsed.id === "number") {
        activeTenantId = String(parsed.id);
      } else if (typeof parsed === "string") {
        activeTenantId = parsed;
      }
    }
  } catch (e) {
    // Ignore JSON parsing errors
  }

  if (activeTenantId) {
    if (input instanceof Request) {
      if (!input.headers.has("x-tenant-id")) {
        input.headers.set("x-tenant-id", activeTenantId);
      }
    } else {
      init = init || {};
      const headers = new Headers(init.headers);
      if (!headers.has("x-tenant-id")) {
        headers.set("x-tenant-id", activeTenantId);
      }
      init.headers = headers;
    }
  }
  return originalFetch(input, init);
};

createRoot(document.getElementById("root")!).render(<App />);

// Ask the browser not to evict the field replica under ordinary storage
// pressure. Browsers may decline, so the Settings screen still reports quota.
if (navigator.storage?.persist) {
  void navigator.storage.persist().then((persisted) => {
    if (!persisted) console.warn("[VaxPlan] Persistent offline storage was not granted.");
  });
}

// ─── Dev-only Service Worker kill switch ────────────────────────────────────
// Only unregister service worker in Vite development mode (import.meta.env.DEV).
// In production builds (including localhost:5000 and production VPS), allow SW to install and cache.
if (import.meta.env.DEV && "serviceWorker" in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => Promise.all(regs.map((r) => r.unregister())))
    .catch(() => {});
}

// ─── Register PWA Service Worker (production + staging only) ─────────────────
// Surface SW lifecycle to the rest of the app via window events so
// components like InstallPrompt can offer a "Reload to update" action,
// and the Background Sync handler can find a ready registration.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        console.info("[VaxPlan SW] Registered:", reg.scope);

        // If there is already a waiting worker on first load, surface it.
        if (reg.waiting && navigator.serviceWorker.controller) {
          window.dispatchEvent(
            new CustomEvent("vaxplan:sw-update-ready", { detail: { registration: reg } }),
          );
        }

        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              console.info("[VaxPlan SW] Update installed — reload to apply");
              window.dispatchEvent(
                new CustomEvent("vaxplan:sw-update-ready", { detail: { registration: reg } }),
              );
            }
          });
        });
      })
      .catch((err) => console.warn("[VaxPlan SW] Registration failed:", err));

    // Dispatch event on SW controller change so UI can notify user without forcing a page reload
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.dispatchEvent(new CustomEvent("vaxplan:sw-controller-changed"));
    });
  });
}
