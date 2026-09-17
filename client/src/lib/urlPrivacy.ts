const PUBLIC_PATHS = new Set([
  "/",
  "/landing",
  "/login",
  "/signup",
  "/research",
  "/data-sources",
  "/help",
  "/partners",
  "/demo",
  "/partnership-concept",
  "/verify",
  "/vaxcard",
]);

export function isPublicUnauthenticatedPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/verify/") || pathname.startsWith("/vaxcard/")) return true;
  return false;
}

/**
 * Return the only address that may remain visible for a signed-out visitor.
 * Query strings and fragments are always removed because they can contain
 * facility IDs, reporting periods, record IDs, or redirect destinations,
 * except for public verification routes.
 */
export function unauthenticatedCanonicalPath(pathname: string, search: string = ""): string {
  if (pathname === "/" || pathname === "/landing") return "/";
  if (pathname.startsWith("/verify/") || pathname.startsWith("/vaxcard/")) return pathname;
  
  // Forward legacy ?verify=client-id scans directly to /verify/:id
  if (search.includes("verify=")) {
    const match = search.match(/[?&]verify=([^&]+)/);
    if (match && match[1]) {
      return `/verify/${encodeURIComponent(match[1])}`;
    }
  }

  return isPublicUnauthenticatedPath(pathname) ? pathname : "/login";
}
