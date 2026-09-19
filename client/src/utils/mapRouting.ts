/**
 * Haversine formula to calculate the straight-line distance between two coordinates in kilometers.
 */
export function calculateHaversineDistance(
  lat1: number, lon1: number, 
  lat2: number, lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface RouteResponse {
  distanceKm: number;      // Actual road distance
  durationMinutes: number; // OSRM's default car duration
  geometry: [number, number][]; // Array of [lat, lng] for Leaflet Polyline
}

/**
 * Fetches routing data from the public OSRM API.
 * Note: OSRM expects coordinates in [Longitude, Latitude] order!
 */
export async function fetchOsrmRoute(
  startLat: number, startLng: number,
  endLat: number, endLng: number
): Promise<RouteResponse | null> {
  const rounded = [startLat, startLng, endLat, endLng].map((value) => value.toFixed(5));
  const cacheKey = `road-route:${rounded.join(":")}`;
  let tenantId = "global";
  try {
    const active = JSON.parse(localStorage.getItem("vaxplan_active_tenant") || "null");
    tenantId = String(active?.id || tenantId);
    const { getCachedGisData } = await import("@/lib/offlineDb");
    const cached = await getCachedGisData(cacheKey, tenantId);
    if (!navigator.onLine && cached) return cached as RouteResponse;
  } catch {
    // Cache lookup is best effort; online routing can still proceed.
  }
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
      return null;
    }

    const route = data.routes[0];
    
    // Convert GeoJSON [lng, lat] back to Leaflet's [lat, lng]
    const geometry = route.geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);

    const result: RouteResponse = {
      distanceKm: route.distance / 1000,
      durationMinutes: route.duration / 60,
      geometry,
    };
    try {
      const { setCachedGisData } = await import("@/lib/offlineDb");
      await setCachedGisData(cacheKey, tenantId, { geojson: result });
    } catch {
      // A route is still useful even if the cache quota is exhausted.
    }
    return result;
  } catch (error) {
    try {
      const { getCachedGisData } = await import("@/lib/offlineDb");
      const cached = await getCachedGisData(cacheKey, tenantId);
      if (cached) return cached as RouteResponse;
    } catch {
      // no cached route
    }
    console.error("OSRM Routing Error:", error);
    return null;
  }
}

/**
 * Estimates travel time based on distance and average speed (km/h).
 */
export function estimateTravelTime(distanceKm: number, speedKmh: number): string {
  const hours = distanceKm / speedKmh;
  const mins = Math.round(hours * 60);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}
