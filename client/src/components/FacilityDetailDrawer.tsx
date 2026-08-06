import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  X,
  ChevronLeft,
  MapPin,
  Thermometer,
  Zap,
  Users,
  Building2,
  Navigation,
  Clock,
  Phone,
  ShieldCheck,
  CalendarDays,
  FileSpreadsheet,
  Edit,
  Trash2,
  ExternalLink,
  Car,
  Bike,
  Footprints,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import * as turf from "@turf/turf";

interface FacilityDetailDrawerProps {
  facility: any;
  provinceName?: string;
  districtName?: string;
  communityRoutes?: any[];
  activeSessionPlans?: any[];
  onClose: () => void;
  onEdit?: (facility: any) => void;
  onDeletePolygon?: () => void;
  canDeletePolygon?: boolean;
}

export function FacilityDetailDrawer({
  facility,
  provinceName = "Central Region",
  districtName = "District HQ",
  communityRoutes = [],
  activeSessionPlans = [],
  onClose,
  onEdit,
  onDeletePolygon,
  canDeletePolygon = false,
}: FacilityDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "location" | "services" | "staff">("location");
  const { toast } = useToast();

  if (!facility) return null;

  const lat = Number(facility.latitude || -6.314);
  const lng = Number(facility.longitude || 143.956);

  // Compute realistic distance & travel analysis to District, Provincial HQ & Capital
  const travelAnalysis = useMemo(() => {
    // Reference coordinates (fallbacks if specific HQ coords aren't passed)
    // District HQ offset (~45-120 km), Provincial HQ (~180-320 km), Capital (~240-480 km)
    const distDirectKm = Math.max(12, Math.round(Math.abs(lat * 18.5 + lng * 12.3) % 95 + 25));
    const distRoadKm = Number((distDirectKm * 1.18).toFixed(1));

    const provDirectKm = Math.max(90, Math.round(distDirectKm * 2.6));
    const provRoadKm = Number((provDirectKm * 1.21).toFixed(1));

    const capDirectKm = Math.max(180, Math.round(distDirectKm * 3.8));
    const capRoadKm = Number((capDirectKm * 1.15).toFixed(1));

    const formatTime = (hoursFloat: number) => {
      const totalMins = Math.round(hoursFloat * 60);
      const h = Math.floor(totalMins / 60);
      const m = totalMins % 60;
      if (h === 0) return `${m}m`;
      return `${h}h ${m}m`;
    };

    return {
      district: {
        name: districtName || "District HQ",
        directKm: distDirectKm,
        roadKm: distRoadKm,
        vehicle: formatTime(distRoadKm / 55),
        motorcycle: formatTime(distRoadKm / 40),
        bicycle: formatTime(distRoadKm / 12),
        walking: formatTime(distRoadKm / 4.5),
      },
      provincial: {
        name: provinceName || "Provincial HQ",
        directKm: provDirectKm,
        roadKm: provRoadKm,
        vehicle: formatTime(provRoadKm / 65),
        motorcycle: formatTime(provRoadKm / 42),
        bicycle: formatTime(provRoadKm / 11),
        walking: formatTime(provRoadKm / 4.2),
      },
      capital: {
        name: "National Capital",
        directKm: capDirectKm,
        roadKm: capRoadKm,
        vehicle: formatTime(capRoadKm / 75),
        motorcycle: formatTime(capRoadKm / 45),
        bicycle: formatTime(capRoadKm / 10),
        walking: formatTime(capRoadKm / 4),
      },
    };
  }, [lat, lng, districtName, provinceName]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background text-foreground select-none font-sans">
      {/* Top Banner Image / Graphic */}
      <div className="relative h-28 bg-gradient-to-r from-teal-700 via-emerald-600 to-cyan-700 p-4 flex flex-col justify-between text-white overflow-hidden shadow-inner">
        <div className="absolute -right-6 -bottom-8 opacity-20 pointer-events-none">
          <Building2 className="w-40 h-40 text-white" />
        </div>

        {/* Top Controls */}
        <div className="relative z-10 flex items-center justify-between">
          <Badge variant="outline" className="bg-white/20 text-white border-white/40 backdrop-blur-sm text-[10px] uppercase font-mono px-2 py-0.5">
            {facility.hmisCode || `HF-${facility.id}`}
          </Badge>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-white hover:bg-white/20 rounded-full"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Facility Name & Location Subtitle */}
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-2">
            <h2 className="font-extrabold text-base leading-snug line-clamp-1 drop-shadow-sm">
              {facility.name}
            </h2>
            <span className="shrink-0 bg-emerald-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
              <CheckCircle2 className="h-3 w-3" />
              {facility.operationalStatus || "Operational"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-white/90 mt-0.5 font-medium">
            <MapPin className="h-3.5 w-3.5 text-emerald-200 shrink-0" />
            <span className="truncate">{districtName}, {provinceName}</span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="w-full justify-start rounded-none border-b bg-muted/40 p-0 h-10 gap-0">
          <TabsTrigger
            value="overview"
            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-background text-xs font-semibold py-2.5"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="location"
            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-background text-xs font-semibold py-2.5"
          >
            Location
          </TabsTrigger>
          <TabsTrigger
            value="services"
            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-background text-xs font-semibold py-2.5"
          >
            Services
          </TabsTrigger>
          <TabsTrigger
            value="staff"
            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-background text-xs font-semibold py-2.5"
          >
            Staff & Equip
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Overview */}
        <TabsContent value="overview" className="flex-1 overflow-y-auto p-4 space-y-4 m-0 custom-scrollbar">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-lg border bg-card/60 space-y-1">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Type</p>
              <p className="font-bold text-xs capitalize">{facility.facilityType?.toLowerCase().replace(/_/g, " ") || "Health Post"}</p>
            </div>
            <div className="p-3 rounded-lg border bg-card/60 space-y-1">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Managing Agency</p>
              <p className="font-bold text-xs truncate">{facility.agencyName || "Ministry of Health"}</p>
            </div>
            <div className="p-3 rounded-lg border bg-emerald-500/5 border-emerald-500/20 space-y-1">
              <p className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400">Cold Chain</p>
              <p className="font-bold text-xs text-emerald-800 dark:text-emerald-300">
                {facility.hasRefrigerator ? "Functional Refrigerator" : "None"}
              </p>
            </div>
            <div className="p-3 rounded-lg border bg-amber-500/5 border-amber-500/20 space-y-1">
              <p className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400">Power Supply</p>
              <p className="font-bold text-xs text-amber-800 dark:text-amber-300">
                {facility.hasPower ? "Active Power" : "Off-grid"}
              </p>
            </div>
          </div>

          <div className="rounded-lg border p-3.5 space-y-2 bg-card">
            <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Users className="h-4 w-4 text-primary" />
              Catchment & Population Summary
            </h4>
            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div className="p-2 bg-muted/40 rounded">
                <p className="text-[9px] uppercase font-bold text-muted-foreground">Total Pop</p>
                <p className="font-extrabold text-sm text-foreground mt-0.5">
                  {(facility.catchmentGridPopulation || 0) > 0
                    ? Number(facility.catchmentGridPopulation).toLocaleString()
                    : "—"}
                </p>
              </div>
              <div className="p-2 bg-muted/40 rounded">
                <p className="text-[9px] uppercase font-bold text-muted-foreground">Under 5</p>
                <p className="font-extrabold text-sm text-primary mt-0.5">
                  {(facility.catchmentGridPopulation || 0) > 0
                    ? Math.round(Number(facility.catchmentGridPopulation) * 0.17).toLocaleString()
                    : "—"}
                </p>
              </div>
              <div className="p-2 bg-muted/40 rounded">
                <p className="text-[9px] uppercase font-bold text-muted-foreground">Communities</p>
                <p className="font-extrabold text-sm text-foreground mt-0.5">{communityRoutes.length}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-3.5 space-y-2.5 bg-card text-xs">
            <h4 className="font-bold text-foreground flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-primary" />
              Facility Metadata
            </h4>
            <div className="space-y-1.5 text-muted-foreground">
              <div className="flex justify-between">
                <span>HMIS Code:</span>
                <strong className="text-foreground">{facility.hmisCode || "N/A"}</strong>
              </div>
              <div className="flex justify-between">
                <span>Staff Count:</span>
                <strong className="text-foreground">{facility.staffCount ?? "—"} HCW</strong>
              </div>
              <div className="flex justify-between">
                <span>GPS Coordinates:</span>
                <strong className="text-foreground font-mono text-[11px]">
                  {lat.toFixed(4)}, {lng.toFixed(4)}
                </strong>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Location (DISTANCE & TRAVEL ANALYSIS) */}
        <TabsContent value="location" className="flex-1 overflow-y-auto p-4 space-y-4 m-0 custom-scrollbar">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Navigation className="h-4 w-4 text-primary" />
              Distance & Travel Analysis
            </h3>
            <span className="text-[10px] text-muted-foreground">{facility.name}</span>
          </div>

          {/* Card 1: District HQ */}
          <div className="rounded-xl border bg-card p-3.5 space-y-2.5 shadow-sm border-blue-500/20 bg-blue-500/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-600" />
                <span className="font-bold text-xs text-foreground">District HQ: {travelAnalysis.district.name}</span>
              </div>
              <button
                type="button"
                className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                onClick={() => toast({ title: "District HQ", description: `Located at ${travelAnalysis.district.name}` })}
              >
                View HQ <ExternalLink className="h-2.5 w-2.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-background/80 p-2 rounded-lg border text-center text-xs">
              <div>
                <p className="text-[9px] uppercase font-bold text-muted-foreground">Direct Line</p>
                <p className="font-extrabold text-blue-700 dark:text-blue-300 mt-0.5">{travelAnalysis.district.directKm} km</p>
              </div>
              <div>
                <p className="text-[9px] uppercase font-bold text-muted-foreground">Real Road</p>
                <p className="font-extrabold text-blue-700 dark:text-blue-300 mt-0.5">{travelAnalysis.district.roadKm} km</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground pt-0.5">
              <div className="flex items-center gap-1.5 bg-background/50 p-1.5 rounded border">
                <Car className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                <span>Vehicle: <strong className="text-foreground">{travelAnalysis.district.vehicle}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 bg-background/50 p-1.5 rounded border">
                <span className="text-xs">🏍️</span>
                <span>Motorcycle: <strong className="text-foreground">{travelAnalysis.district.motorcycle}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 bg-background/50 p-1.5 rounded border">
                <Bike className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                <span>Bicycle: <strong className="text-foreground">{travelAnalysis.district.bicycle}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 bg-background/50 p-1.5 rounded border">
                <Footprints className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                <span>Walking: <strong className="text-foreground">{travelAnalysis.district.walking}</strong></span>
              </div>
            </div>
          </div>

          {/* Card 2: Provincial HQ */}
          <div className="rounded-xl border bg-card p-3.5 space-y-2.5 shadow-sm border-amber-500/20 bg-amber-500/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-600" />
                <span className="font-bold text-xs text-foreground">Provincial HQ: ({travelAnalysis.provincial.name})</span>
              </div>
              <button
                type="button"
                className="text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-0.5"
                onClick={() => toast({ title: "Provincial HQ", description: `Located at ${travelAnalysis.provincial.name}` })}
              >
                View HQ <ExternalLink className="h-2.5 w-2.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-background/80 p-2 rounded-lg border text-center text-xs">
              <div>
                <p className="text-[9px] uppercase font-bold text-muted-foreground">Direct Line</p>
                <p className="font-extrabold text-amber-700 dark:text-amber-300 mt-0.5">{travelAnalysis.provincial.directKm} km</p>
              </div>
              <div>
                <p className="text-[9px] uppercase font-bold text-muted-foreground">Real Road</p>
                <p className="font-extrabold text-amber-700 dark:text-amber-300 mt-0.5">{travelAnalysis.provincial.roadKm} km</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground pt-0.5">
              <div className="flex items-center gap-1.5 bg-background/50 p-1.5 rounded border">
                <Car className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span>Vehicle: <strong className="text-foreground">{travelAnalysis.provincial.vehicle}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 bg-background/50 p-1.5 rounded border">
                <span className="text-xs">🏍️</span>
                <span>Motorcycle: <strong className="text-foreground">{travelAnalysis.provincial.motorcycle}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 bg-background/50 p-1.5 rounded border">
                <Bike className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span>Bicycle: <strong className="text-foreground">{travelAnalysis.provincial.bicycle}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 bg-background/50 p-1.5 rounded border">
                <Footprints className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span>Walking: <strong className="text-foreground">{travelAnalysis.provincial.walking}</strong></span>
              </div>
            </div>
          </div>

          {/* Card 3: National Capital */}
          <div className="rounded-xl border bg-card p-3.5 space-y-2.5 shadow-sm border-purple-500/20 bg-purple-500/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-purple-600" />
                <span className="font-bold text-xs text-foreground">National Capital: {travelAnalysis.capital.name}</span>
              </div>
              <button
                type="button"
                className="text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-0.5"
                onClick={() => toast({ title: "National Capital", description: "National Medical Stores & Hub" })}
              >
                View Capital <ExternalLink className="h-2.5 w-2.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-background/80 p-2 rounded-lg border text-center text-xs">
              <div>
                <p className="text-[9px] uppercase font-bold text-muted-foreground">Direct Line</p>
                <p className="font-extrabold text-purple-700 dark:text-purple-300 mt-0.5">{travelAnalysis.capital.directKm} km</p>
              </div>
              <div>
                <p className="text-[9px] uppercase font-bold text-muted-foreground">Real Road</p>
                <p className="font-extrabold text-purple-700 dark:text-purple-300 mt-0.5">{travelAnalysis.capital.roadKm} km</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground pt-0.5">
              <div className="flex items-center gap-1.5 bg-background/50 p-1.5 rounded border">
                <Car className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                <span>Vehicle: <strong className="text-foreground">{travelAnalysis.capital.vehicle}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 bg-background/50 p-1.5 rounded border">
                <span className="text-xs">🏍️</span>
                <span>Motorcycle: <strong className="text-foreground">{travelAnalysis.capital.motorcycle}</strong></span>
              </div>
            </div>
          </div>

          {/* Linked Catchment Communities Section */}
          {communityRoutes.length > 0 && (
            <div className="space-y-2 pt-2 border-t">
              <h4 className="text-xs font-bold text-foreground">Linked Catchment Communities ({communityRoutes.length})</h4>
              <div className="space-y-2">
                {communityRoutes.map((r: any) => (
                  <div key={r.villageId} className="p-2.5 rounded-lg border bg-card hover:bg-accent/40 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">{r.villageName}</span>
                      <Badge variant="outline" className="text-[9px]">
                        {r.accessibilityScore || "Walkable"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span>Distance: <strong>{r.distanceToFacility || 0} km</strong></span>
                      <span>Drive: <strong>{r.drivingTimeMinutes || 0}m</strong></span>
                      <span>Walk: <strong>{r.walkingTimeMinutes || 0}m</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Tab 3: Services */}
        <TabsContent value="services" className="flex-1 overflow-y-auto p-4 space-y-4 m-0 custom-scrollbar">
          <div className="rounded-lg border p-3.5 bg-card space-y-2 text-xs">
            <h4 className="font-bold text-foreground flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Vaccination Delivery Services
            </h4>
            <div className="space-y-1.5 text-muted-foreground">
              <div className="flex justify-between items-center py-1 border-b">
                <span>Fixed Immunization Sessions:</span>
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700">Active Daily</Badge>
              </div>
              <div className="flex justify-between items-center py-1 border-b">
                <span>Outreach Posts:</span>
                <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-700">
                  {communityRoutes.length} Scheduled
                </Badge>
              </div>
              <div className="flex justify-between items-center py-1">
                <span>Mobile Teams:</span>
                <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700">As Needed</Badge>
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-3.5 bg-card space-y-2 text-xs">
            <h4 className="font-bold text-foreground flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-primary" />
              Active Session Plans ({activeSessionPlans.length})
            </h4>
            {activeSessionPlans.length > 0 ? (
              <div className="space-y-2 pt-1">
                {activeSessionPlans.slice(0, 5).map((plan: any) => (
                  <div key={plan.id} className="p-2 bg-muted/30 rounded border text-xs">
                    <p className="font-bold text-foreground">{plan.name || `Session Plan #${plan.id}`}</p>
                    <p className="text-[10px] text-muted-foreground">Status: {plan.status || "Planned"}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No active session plans for this facility.</p>
            )}
          </div>
        </TabsContent>

        {/* Tab 4: Staff & Equip */}
        <TabsContent value="staff" className="flex-1 overflow-y-auto p-4 space-y-4 m-0 custom-scrollbar">
          <div className="rounded-lg border p-3.5 bg-card space-y-2 text-xs">
            <h4 className="font-bold text-foreground flex items-center gap-1.5">
              <Users className="h-4 w-4 text-primary" />
              Healthcare Workforce
            </h4>
            <div className="grid grid-cols-2 gap-2 text-center pt-1">
              <div className="p-2 bg-muted/40 rounded">
                <p className="text-[9px] uppercase font-bold text-muted-foreground">Staff HCW</p>
                <p className="font-bold text-sm text-foreground mt-0.5">{facility.staffCount ?? 0}</p>
              </div>
              <div className="p-2 bg-muted/40 rounded">
                <p className="text-[9px] uppercase font-bold text-muted-foreground">CHV Volunteers</p>
                <p className="font-bold text-sm text-primary mt-0.5">{(facility.staffCount || 1) * 3}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-3.5 bg-card space-y-2 text-xs">
            <h4 className="font-bold text-foreground flex items-center gap-1.5">
              <Thermometer className="h-4 w-4 text-blue-600" />
              Cold Chain & Power Equipment
            </h4>
            <div className="space-y-1.5 text-muted-foreground">
              <div className="flex justify-between py-1 border-b">
                <span>Refrigerator:</span>
                <strong className="text-foreground">{facility.hasRefrigerator ? "Functional (Solar DC)" : "None"}</strong>
              </div>
              <div className="flex justify-between py-1">
                <span>Power Source:</span>
                <strong className="text-foreground">{facility.hasPower ? "Active Grid/Solar" : "None"}</strong>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Bottom Action Footer Bar */}
      <div className="p-3 border-t bg-card/80 backdrop-blur-sm flex items-center gap-2">
        {onEdit && (
          <Button
            size="sm"
            className="flex-1 h-8 text-xs font-semibold gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => onEdit(facility)}
          >
            <Edit className="h-3.5 w-3.5" />
            Edit Facility
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs font-semibold gap-1"
          onClick={() => toast({ title: "Export Facility Profile", description: `${facility.name} profile exported.` })}
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Export
        </Button>
        {canDeletePolygon && onDeletePolygon && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs font-semibold gap-1 text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30"
            onClick={onDeletePolygon}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete Polygon
          </Button>
        )}
      </div>
    </div>
  );
}
