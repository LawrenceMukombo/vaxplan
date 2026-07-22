import React from "react";
import { User } from "lucide-react";

export function MapLegend() {
  return (
    <div className="absolute bottom-6 left-6 z-[1000] bg-white/95 backdrop-blur-sm p-3 rounded-lg border shadow-lg text-xs">
      <div className="font-semibold mb-2.5 text-[11px] uppercase tracking-wider text-muted-foreground">Legend</div>
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded-full bg-blue-600 border-2 border-white shadow-sm shrink-0" />
          <span>Health Facility</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white rounded-full border-[1.5px] border-blue-600 p-[2px] pr-1 shadow-sm shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0" />
            <div className="flex -ml-1">
              <User className="w-3 h-3 text-amber-500 fill-amber-500 stroke-white stroke-[1.5px]" />
              <User className="w-3 h-3 text-amber-500 fill-amber-500 stroke-white stroke-[1.5px] -ml-[5px]" />
            </div>
          </div>
          <span>Facility w/ Unassigned CHVs</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white rounded-full border-[1.5px] border-green-600 p-[2px] shadow-sm shrink-0">
            <div className="flex -ml-0.5">
              <User className="w-3 h-3 text-green-600 fill-green-600 stroke-white stroke-[1.5px]" />
              <User className="w-3 h-3 text-green-600 fill-green-600 stroke-white stroke-[1.5px] -ml-[5px]" />
            </div>
          </div>
          <span>Community (Covered)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-600 border-2 border-white shadow-sm shrink-0" />
          <span>Community (Service Gap)</span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="w-4 h-[2px] bg-green-500 shrink-0" />
          <span>Assigned Link</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 border-t-2 border-dashed border-red-500 shrink-0" />
          <span>Unassigned Gap Link</span>
        </div>
      </div>
    </div>
  );
}
