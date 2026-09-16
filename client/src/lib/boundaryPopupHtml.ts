import { escapeHtml } from "@shared/html";

export function buildBoundaryPopupInfoHtml(ctx: any, lat: number, lng: number): string {
  const villages = Array.isArray(ctx.nearbyVillages) ? ctx.nearbyVillages : [];
  const nearbyHtml = villages.length
    ? villages.map((v: any) => `<div class="flex justify-between items-center text-[10px] border-b border-border/40 pb-0.5 last:border-0"><span class="truncate max-w-[110px] ${v.isHardToReach ? "text-amber-600 font-medium" : "text-foreground"}">${escapeHtml(v.name)} ${v.isHardToReach ? "(HTR)" : ""}</span><span class="text-muted-foreground font-mono shrink-0">${Number(v.population || 0)} pop (${Number(v.distance || 0)}km)</span></div>`).join("")
    : `<p class="text-[9px] italic text-muted-foreground">No villages within 10km</p>`;

  return `<div class="space-y-2 text-[11px] leading-snug">
    <div class="bg-primary/5 border border-primary/10 rounded p-1.5 space-y-0.5">
      <div class="flex justify-between items-center text-[9px] text-muted-foreground"><span>CLICK COORDINATES</span><span class="font-mono">${lat.toFixed(5)}, ${lng.toFixed(5)}</span></div>
      ${ctx.polygonName ? `<div class="text-[10px] font-bold text-primary flex justify-between items-center gap-1.5 mt-0.5"><span class="truncate">${escapeHtml(ctx.polygonName)}</span>${ctx.polygonPopulation ? `<span class="text-emerald-600 font-bold shrink-0">~ ${Number(ctx.polygonPopulation).toLocaleString()} pop</span>` : ""}</div>` : ""}
    </div>
    <div class="space-y-1"><span class="font-bold text-[9px] text-muted-foreground uppercase block">Aggressive Gridded Population</span><div class="grid grid-cols-3 gap-1 text-center font-mono text-[10px]">
      <div class="bg-muted p-1 rounded"><span class="text-[8px] text-muted-foreground block">1km</span><strong class="text-xs text-foreground pop-1k-val">${Number(ctx.pop1k || 0).toLocaleString()}</strong></div>
      <div class="bg-muted p-1 rounded"><span class="text-[8px] text-muted-foreground block">2km</span><strong class="text-xs text-foreground pop-2k-val">${Number(ctx.pop2k || 0).toLocaleString()}</strong></div>
      <div class="bg-muted p-1 rounded"><span class="text-[8px] text-muted-foreground block">3km</span><strong class="text-xs text-foreground pop-3k-val">${Number(ctx.pop3k || 0).toLocaleString()}</strong></div>
    </div></div>
    <div class="space-y-1"><span class="font-bold text-[9px] text-muted-foreground uppercase block">Catchment Proximity</span><div class="space-y-1 text-[10px]">
      <div class="flex justify-between items-center bg-muted/40 p-1 rounded px-1.5"><span class="text-muted-foreground truncate max-w-[150px]">HF: ${escapeHtml(ctx.nearestFacility?.name || "None")}</span><span class="font-mono font-bold shrink-0">${ctx.nearestFacility ? `${Number(ctx.nearestFacility.distance)}km` : "—"}</span></div>
      <div class="flex justify-between items-center bg-muted/40 p-1 rounded px-1.5"><span class="text-muted-foreground truncate max-w-[150px]">Session: ${escapeHtml(ctx.nearestPlan?.name || "None")}</span><span class="font-mono font-bold shrink-0">${ctx.nearestPlan ? `${Number(ctx.nearestPlan.distance)}km` : "—"}</span></div>
    </div></div>
    <div class="space-y-1"><span class="font-bold text-[9px] text-muted-foreground uppercase block">Nearby Communities</span><div class="space-y-1 max-h-[70px] overflow-y-auto">${nearbyHtml}</div></div>
    ${ctx.isHTR ? `<div class="bg-amber-500/10 border border-amber-500/20 text-amber-700 rounded p-1.5 text-[9px] flex items-start gap-1 font-medium"><span>!</span><span>Hard-to-Reach (HTR) designated zone.</span></div>` : ""}
  </div>`;
}

