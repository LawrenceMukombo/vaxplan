import L from "leaflet";

export const MARKER_COLORS = {
  blue: "#2563eb",
  green: "#10b981",
  amber: "#f59e0b",
  red: "#ef4444",
  rose: "#e11d48",
  white: "#ffffff",
} as const;

export type PinColor = "blue" | "green" | "amber" | "red";
export type OutlinePinColor = "rose" | "green";

const buildFilledPinSvg = (fill: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="35" viewBox="0 0 24 35" fill="none">` +
  `<path d="M12 0C5.37 0 0 5.37 0 12c0 9.3 12 23 12 23s12-13.7 12-23c0-6.63-5.37-12-12-12z" fill="${fill}"/>` +
  `<circle cx="12" cy="12" r="4.5" fill="${MARKER_COLORS.white}"/>` +
  `</svg>`;

const buildOutlinePinSvg = (stroke: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
  `<path d="M21 10a9 9 0 1 0-18 0 c0 7 9 13 9 13s9-6 9-13Z"/>` +
  `<circle cx="12" cy="10" r="3"/>` +
  `</svg>`;

const buildFacilityCircleSvg = (fill: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">` +
  `<circle cx="9" cy="9" r="8" fill="${fill}" stroke="${MARKER_COLORS.white}" stroke-width="1.5" />` +
  `<path d="M9 5v8M5 9h8" stroke="${MARKER_COLORS.white}" stroke-width="2.2" stroke-linecap="round" />` +
  `</svg>`;

const toDataUri = (svg: string): string => {
  const encoded =
    typeof window === "undefined"
      ? Buffer.from(svg, "utf-8").toString("base64")
      : window.btoa(svg);
  return `data:image/svg+xml;base64,${encoded}`;
};

const FILLED_PIN_COLORS: Record<PinColor, string> = {
  blue: MARKER_COLORS.blue,
  green: MARKER_COLORS.green,
  amber: MARKER_COLORS.amber,
  red: MARKER_COLORS.red,
};

const OUTLINE_PIN_COLORS: Record<OutlinePinColor, string> = {
  rose: MARKER_COLORS.rose,
  green: MARKER_COLORS.green,
};

export const FILLED_PIN_DATA_URIS: Record<PinColor, string> = {
  blue: toDataUri(buildFilledPinSvg(FILLED_PIN_COLORS.blue)),
  green: toDataUri(buildFilledPinSvg(FILLED_PIN_COLORS.green)),
  amber: toDataUri(buildFilledPinSvg(FILLED_PIN_COLORS.amber)),
  red: toDataUri(buildFilledPinSvg(FILLED_PIN_COLORS.red)),
};

export const OUTLINE_PIN_DATA_URIS: Record<OutlinePinColor, string> = {
  rose: toDataUri(buildOutlinePinSvg(OUTLINE_PIN_COLORS.rose)),
  green: toDataUri(buildOutlinePinSvg(OUTLINE_PIN_COLORS.green)),
};

export const FACILITY_CIRCLE_GREEN_DATA_URI = toDataUri(
  buildFacilityCircleSvg(MARKER_COLORS.green)
);

export interface IconSize {
  iconSize: [number, number];
  iconAnchor: [number, number];
  popupAnchor: [number, number];
}

export const FILLED_PIN_SIZE_24x35: IconSize = {
  iconSize: [24, 35],
  iconAnchor: [12, 35],
  popupAnchor: [0, -35],
};

export const FILLED_PIN_SIZE_20x29: IconSize = {
  iconSize: [20, 29],
  iconAnchor: [10, 29],
  popupAnchor: [0, -29],
};

export const OUTLINE_PIN_SIZE_24x30: IconSize = {
  iconSize: [24, 30],
  iconAnchor: [12, 30],
  popupAnchor: [0, -30],
};

export const FACILITY_CIRCLE_SIZE_18: IconSize = {
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -9],
};

/**
 * Override the Leaflet default icon with the shared blue offline pin so any
 * <Marker> that does not specify a custom icon still renders without needing
 * network access to the Leaflet CDN. Safe to call multiple times.
 */
export function applyDefaultLeafletPinIcon(): void {
  if (typeof window === "undefined") return;
  delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
  const proto = L.Icon.Default.prototype.options;
  proto.iconUrl = FILLED_PIN_DATA_URIS.blue;
  proto.iconRetinaUrl = FILLED_PIN_DATA_URIS.blue;
  proto.shadowUrl = "";
  proto.iconSize = FILLED_PIN_SIZE_24x35.iconSize;
  proto.iconAnchor = FILLED_PIN_SIZE_24x35.iconAnchor;
  proto.popupAnchor = FILLED_PIN_SIZE_24x35.popupAnchor;
}

export function createFilledPinIcon(
  color: PinColor,
  size: IconSize = FILLED_PIN_SIZE_24x35
): L.Icon {
  return L.icon({ iconUrl: FILLED_PIN_DATA_URIS[color], ...size });
}

export function createOutlinePinIcon(
  color: OutlinePinColor,
  size: IconSize = OUTLINE_PIN_SIZE_24x30
): L.Icon {
  return L.icon({ iconUrl: OUTLINE_PIN_DATA_URIS[color], ...size });
}


const renderHumans = (count: number, color: string) => {
  const maxToDraw = Math.min(count, 5);
  const svgs = Array(maxToDraw).fill(`<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-left: -4px;"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`).join('');
  const overflow = count > 5 ? `<span style="font-size: 9px; font-weight: bold; color: ${color}; margin-left: 2px;">+${count - 5}</span>` : '';
  return `<div style="display: flex; align-items: center; padding-left: 4px;">${svgs}${overflow}</div>`;
};

export function createFacilityCircleIcon(unassignedCount: number = 0): L.DivIcon {
  if (unassignedCount > 0) {
    return L.divIcon({
      html: `
        <div style="display: flex; align-items: center; background: white; border-radius: 12px; border: 1.5px solid #2563eb; padding: 2px 4px 2px 2px; box-shadow: 0 0 4px rgba(0,0,0,0.3);">
          <div style="background-color: #2563eb; width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0;"></div>
        ${renderHumans(unassignedCount, '#f59e0b')}
        </div>
      `,
      className: "",
      iconSize: [(unassignedCount > 5 ? 60 : 20 + unassignedCount * 8), 20],
      iconAnchor: [10, 10],
    });
  }
  return L.divIcon({
    html: `<div style="background-color: #2563eb; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`,
    className: "",
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

export function createVillageWithChvsIcon(chvCount: number): L.DivIcon {
  return L.divIcon({
    html: `
      <div style="display: inline-flex; align-items: center; background-color: white; border-radius: 12px; border: 1.5px solid #16a34a; padding: 2px; box-shadow: 0 0 2px rgba(0,0,0,0.3);">
        ${renderHumans(chvCount, '#16a34a')}
      </div>
    `,
    className: "",
    iconSize: [(chvCount > 5 ? 50 : 8 + chvCount * 8), 20],
    iconAnchor: [(chvCount > 5 ? 25 : 4 + chvCount * 4), 10],
  });
}

export function createGapVillageIcon(): L.DivIcon {
  return L.divIcon({
    html: `<div style="background-color: #dc2626; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(220,38,38,0.8);"></div>`,
    className: "",
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}
