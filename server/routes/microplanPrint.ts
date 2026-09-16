import { escapeHtml } from "@shared/html";

export type MicroplanPrintOptions = {
  title: string;
  format: string;
  latitude: number;
  longitude: number;
  zoom: number;
};

export function buildMicroplanPrintHtml(options: MicroplanPrintOptions): string {
  const sizes: Record<string, { width: string; height: string }> = {
    A4: { width: "210mm", height: "297mm" }, A3: { width: "297mm", height: "420mm" },
    A2: { width: "420mm", height: "594mm" }, A1: { width: "594mm", height: "841mm" },
    A0: { width: "841mm", height: "1189mm" },
  };
  const format = sizes[options.format] ? options.format : "A4";
  const size = sizes[format];
  const title = escapeHtml(options.title);
  const titleJson = JSON.stringify(options.title).replaceAll("<", "\\u003c");
  const lat = Number.isFinite(options.latitude) ? options.latitude : -6.314;
  const lng = Number.isFinite(options.longitude) ? options.longitude : 143.956;
  const zoom = Number.isInteger(options.zoom) && options.zoom >= 0 && options.zoom <= 22 ? options.zoom : 12;

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<title>${title} — ${format} Map Print</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#fff}@page{size:${format} portrait;margin:10mm}.page{width:${size.width};min-height:${size.height};padding:10mm;display:flex;flex-direction:column}.header{margin-bottom:4mm;border-bottom:1px solid #ccc;padding-bottom:3mm}.header h1{font-size:14pt;font-weight:700}.header p{font-size:8pt;color:#666}#map{flex:1;min-height:200mm;border:1px solid #ccc;border-radius:2mm}.footer{margin-top:3mm;font-size:7pt;color:#888;display:flex;justify-content:space-between}@media print{.no-print{display:none}}</style>
</head><body><div class="page"><div class="header"><h1>${title}</h1>
<p>Format: ${format} &nbsp;|&nbsp; Generated: ${new Date().toLocaleDateString("en-GB")} &nbsp;|&nbsp; Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)} &nbsp;|&nbsp; Zoom: ${zoom}</p></div>
<button class="no-print" onclick="window.print()" style="margin-bottom:4mm;padding:6px 16px;background:#1a56db;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:10pt;">Print / Save as PDF</button>
<div id="map"></div><div class="footer"><span>VaxPlan — Health Facility Microplan</span><span>© OpenStreetMap contributors</span></div></div>
<script>document.addEventListener('DOMContentLoaded',function(){var map=L.map('map',{zoomControl:false,attributionControl:true}).setView([${lat},${lng}],${zoom});L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap contributors',maxZoom:18}).addTo(map);L.marker([${lat},${lng}]).addTo(map).bindPopup(${titleJson}).openPopup();setTimeout(function(){if(window.location.search.includes('autoprint=1'))window.print()},3000)});</script>
</body></html>`;
}

