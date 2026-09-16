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
]);

export function isPublicUnauthenticatedPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname);
}

/**
 * Return the only address that may remain visible for a signed-out visitor.
 * Query strings and fragments are always removed because they can contain
 * facility IDs, reporting periods, record IDs, or redirect destinations.
 */
export function unauthenticatedCanonicalPath(pathname: string): string {
  if (pathname === "/" || pathname === "/landing") return "/";
  return isPublicUnauthenticatedPath(pathname) ? pathname : "/login";
}
