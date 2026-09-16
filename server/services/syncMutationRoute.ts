export type SyncMutationRoute =
  | { kind: "client-vaccination"; clientId: string }
  | { kind: "client-vaccination-batch"; clientId: string }
  | { kind: "client" }
  | { kind: "other" };

/**
 * Classify overlapping client routes before sync dispatch.  A simple
 * startsWith("/api/clients") check is unsafe because it also captures the
 * vaccination sub-resources.
 */
export function classifySyncMutationRoute(url: string): SyncMutationRoute {
  const path = url.split(/[?#]/, 1)[0].replace(/\/+$/, "");
  const batch = path.match(/^\/api\/clients\/([^/]+)\/vaccinate-batch$/);
  if (batch) return { kind: "client-vaccination-batch", clientId: decodeURIComponent(batch[1]) };

  const single = path.match(/^\/api\/clients\/([^/]+)\/vaccinate$/);
  if (single) return { kind: "client-vaccination", clientId: decodeURIComponent(single[1]) };

  if (path === "/api/clients" || /^\/api\/clients\/[^/]+$/.test(path)) {
    return { kind: "client" };
  }
  return { kind: "other" };
}
