import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Activity,
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  Database,
  Landmark,
  MapPin,
  Navigation,
  ShieldCheck,
  Users,
} from "lucide-react";
import { RadiusSelector } from "./ui/population/RadiusSelector";
import { PopulationSummaryCard } from "./ui/population/PopulationSummaryCard";
import { PopulationSourceComparisonTable } from "./ui/population/PopulationSourceComparisonTable";

interface Point {
  lat: number;
  lng: number;
}

interface LocationIntelligenceDrawerProps {
  point: Point | null;
  onClose: () => void;
  context?: any;
}

type ApiResult<T> = { data: T | null; error: string | null };

function formatNumber(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num.toLocaleString() : "0";
}

function formatDistance(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? `${num.toFixed(num < 10 ? 2 : 1)} km` : "N/A";
}

function normalizeApiDistance(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function estimateTravelMinutes(distanceKm: unknown) {
  const distance = Number(distanceKm);
  return Number.isFinite(distance) ? Math.max(1, Math.round(distance * 12)) : null;
}

function InfoCard({
  title,
  icon: Icon,
  children,
  action,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function Metric({ label, value, subtext }: { label: string; value: React.ReactNode; subtext?: string }) {
  return (
    <div className="rounded-lg border bg-muted/25 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 text-lg font-extrabold text-foreground">{value}</div>
      {subtext && <p className="mt-0.5 text-[11px] text-muted-foreground">{subtext}</p>}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/50 py-1.5 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="max-w-[65%] text-right text-xs font-semibold text-foreground">{value || "N/A"}</span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed bg-muted/20 p-3 text-sm italic text-muted-foreground">{text}</p>;
}

async function fetchJsonResult<T>(url: string): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, { credentials: "include" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { data: null, error: json?.message || "Request failed" };
    return { data: json?.data ?? json ?? null, error: null };
  } catch (error: any) {
    return { data: null, error: error?.message || "Network request failed" };
  }
}

export function LocationIntelligenceDrawer({ point, onClose, context }: LocationIntelligenceDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [radiusKm, setRadiusKm] = useState<number>(5);

  useEffect(() => {
    setIsOpen(!!point);
  }, [point]);

  const { data: locationResult, isLoading: isLoadingLocation } = useQuery<ApiResult<any>>({
    queryKey: ["/api/gis/location-intelligence", point?.lat, point?.lng, radiusKm],
    queryFn: async () => {
      if (!point) return { data: null, error: null };
      return fetchJsonResult(`/api/gis/location-intelligence?lat=${point.lat}&lng=${point.lng}&radiusKm=${radiusKm}`);
    },
    enabled: !!point,
  });

  const { data: popResult, isLoading: isLoadingPop } = useQuery<ApiResult<any>>({
    queryKey: ["/api/gis/population-intelligence", point?.lat, point?.lng, radiusKm],
    queryFn: async () => {
      if (!point) return { data: null, error: null };
      return fetchJsonResult(`/api/gis/population-intelligence?lat=${point.lat}&lng=${point.lng}&radiusKm=${radiusKm}`);
    },
    enabled: !!point,
  });

  const locationData = locationResult?.data;
  const popData = popResult?.data;
  const isLoading = isLoadingLocation || isLoadingPop;

  const fallbackPopulation = useMemo(() => {
    if (!context) return null;
    const selected = radiusKm <= 1 ? context.pop1k : radiusKm <= 3 ? context.pop3k : context.pop3k || context.pop2k || context.pop1k;
    const totalPopulation = Number(selected) || 0;
    return {
      source: "Map raster/local context",
      totalPopulation,
      under5Population: Math.round(totalPopulation * 0.17),
      method: "Local clicked-point context",
      confidence: totalPopulation > 0 ? "Moderate" : "Low",
      year: new Date().getFullYear(),
    };
  }, [context, radiusKm]);

  const populationRecommendation = popData?.recommended ?? fallbackPopulation;
  const facilities = locationData?.facilities?.length
    ? locationData.facilities
    : context?.nearestFacility
      ? [{
          id: context.nearestFacility.id,
          name: context.nearestFacility.name,
          facilityType: context.nearestFacility.facilityType,
          type: context.nearestFacility.facilityType,
          status: context.nearestFacility.raw?.operationalStatus || "active",
          distance_km: context.nearestFacility.distance,
          hasRefrigerator: context.nearestFacility.hasRefrigerator,
          hasPower: context.nearestFacility.hasPower,
          staffCount: context.nearestFacility.staffCount,
          operatingHours: context.nearestFacility.operatingHours,
        }]
      : [];
  const communities = locationData?.communities?.length
    ? locationData.communities
    : [
        ...(context?.nearestVillage ? [{
          id: context.nearestVillage.id,
          name: context.nearestVillage.name,
          population: context.nearestVillage.population,
          under5: context.nearestVillage.under5Population,
          is_hard_to_reach: context.nearestVillage.isHardToReach,
          distance_km: context.nearestVillage.distance,
          settlementType: context.nearestVillage.settlementType,
        }] : []),
        ...(context?.nearbyVillages || []).filter((v: any) => v.id !== context?.nearestVillage?.id),
      ];
  const adminHierarchy = locationData?.adminHierarchy || {
    1: context?.provinceName,
    2: context?.districtName,
    3: context?.polygonName,
    4: context?.wardName,
  };
  const issues = [locationResult?.error, popResult?.error].filter(Boolean);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) onClose();
  };

  return (
    <Drawer open={isOpen} onOpenChange={handleOpenChange}>
      <DrawerContent className="h-[92vh] max-h-[92vh] flex flex-col">
        <DrawerHeader className="border-b pb-4">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <DrawerTitle className="flex items-center gap-2 text-xl font-bold">
                <MapPin className="h-5 w-5 text-primary" />
                GIS Point Intelligence
              </DrawerTitle>
              <DrawerDescription>
                {point && `Analysis for selected location: ${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`}
              </DrawerDescription>
            </div>
            <RadiusSelector radiiKm={[1, 3, 5, 10, 25]} selectedRadiusKm={radiusKm} onRadiusChange={setRadiusKm} disabled={isLoading} />
          </div>
        </DrawerHeader>

        <ScrollArea className="flex-1 overflow-y-auto px-4">
          {isLoading ? (
            <div className="mx-auto mt-4 max-w-6xl space-y-4 p-4">
              <Skeleton className="h-32 w-full rounded-xl" />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Skeleton className="h-48 rounded-xl" />
                <Skeleton className="h-48 rounded-xl" />
                <Skeleton className="h-48 rounded-xl" />
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-6xl space-y-5 py-6">
              {issues.length > 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-bold">Some live intelligence sources did not respond.</p>
                      <p className="text-xs leading-relaxed">Showing available API data plus local map context. Details: {issues.join(" | ")}</p>
                    </div>
                  </div>
                </div>
              )}

              <PopulationSummaryCard recommended={populationRecommendation} discrepancyLevel={popData?.discrepancyLevel || "None"} discrepancyMessage={popData?.discrepancyMessage || "Local and remote population sources are being compared for this point."} />

              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <Metric label={`${radiusKm} km denominator`} value={formatNumber(populationRecommendation?.totalPopulation)} subtext="Best available estimate" />
                <Metric label="Under-5 estimate" value={formatNumber(populationRecommendation?.under5Population)} subtext="Default target cohort" />
                <Metric label="Nearest facility" value={facilities[0]?.name || "None"} subtext={facilities[0] ? formatDistance(facilities[0].distance_km) : `Within ${radiusKm} km`} />
                <Metric label="Coverage status" value={context?.isInsideCatchment ? "Inside catchment" : "Needs review"} subtext={context?.isHTR ? "HTR/access risk flagged" : "No HTR flag from local context"} />
              </div>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                <InfoCard title="Administrative Context" icon={Landmark}>
                  <DetailRow label="Province" value={adminHierarchy?.[1] || context?.provinceName || "Unknown"} />
                  <DetailRow label="District" value={adminHierarchy?.[2] || context?.districtName || "Unknown"} />
                  <DetailRow label="Constituency / Boundary" value={adminHierarchy?.[3] || context?.polygonName || "Unknown"} />
                  <DetailRow label="Ward / Locality" value={adminHierarchy?.[4] || context?.wardName || "Unknown"} />
                  <DetailRow label="Coordinates" value={<span className="font-mono">{point ? `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}` : "N/A"}</span>} />
                </InfoCard>

                <InfoCard title="Gridded Population Rings" icon={Database}>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <Metric label="1 km" value={formatNumber(context?.pop1k)} subtext="people" />
                    <Metric label="2 km" value={formatNumber(context?.pop2k)} subtext="people" />
                    <Metric label="3 km" value={formatNumber(context?.pop3k)} subtext="people" />
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">These rings are summed from the local map raster/context when the remote population service is unavailable.</p>
                </InfoCard>

                <InfoCard title="Microplanning Coverage" icon={ShieldCheck}>
                  <DetailRow label="Catchment status" value={context?.isInsideCatchment ? "Inside saved catchment" : "Outside saved catchment"} />
                  <DetailRow label="Catchment name" value={context?.containingCatchments?.[0]?.name || "N/A"} />
                  <DetailRow label="HTR/access risk" value={context?.isHTR ? "Flagged" : "Not flagged"} />
                  <DetailRow label="Nearest session" value={context?.nearestPlan ? `${context.nearestPlan.name} (${formatDistance(context.nearestPlan.distance)})` : "None nearby"} />
                </InfoCard>
              </div>

              {popData?.sources?.length > 0 && (
                <InfoCard title="Population Source Comparison" icon={Activity}>
                  <PopulationSourceComparisonTable sources={popData.sources} />
                </InfoCard>
              )}

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <InfoCard title={`Nearby Facilities (${facilities.length})`} icon={Building2}>
                  <div className="space-y-3">
                    {facilities.length === 0 ? <EmptyState text={`No facilities found within ${radiusKm} km.`} /> : facilities.slice(0, 10).map((f: any) => {
                      const dist = normalizeApiDistance(f.distance_km ?? f.distance);
                      return (
                        <div key={f.id ?? f.name} className="rounded-lg border bg-background p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold">{f.name}</p>
                              <p className="text-xs capitalize text-muted-foreground">{(f.facilityType || f.type || "Facility").toString().replace(/_/g, " ")}{f.status ? ` | ${String(f.status).replace(/_/g, " ")}` : ""}</p>
                            </div>
                            <Badge variant="secondary">{dist != null ? formatDistance(dist) : "N/A"}</Badge>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                            <span>Travel: {estimateTravelMinutes(dist) ? `${estimateTravelMinutes(dist)} min walk` : "N/A"}</span>
                            <span>Staff: {f.staffCount ?? "N/A"}</span>
                            <span>Cold chain: {f.hasRefrigerator ? "Available" : "Unknown"}</span>
                            <span>Power: {f.hasPower ? "Yes" : "Unknown"}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </InfoCard>

                <InfoCard title={`Nearby Communities (${communities.length})`} icon={Users}>
                  <div className="space-y-3">
                    {communities.length === 0 ? <EmptyState text={`No communities found within ${radiusKm} km.`} /> : communities.slice(0, 12).map((c: any) => (
                      <div key={c.id ?? c.name} className="rounded-lg border bg-background p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{c.name}</p>
                            <p className="text-xs text-muted-foreground">Pop: {formatNumber(c.population)} | U5: {formatNumber(c.under5 ?? c.under5Population)}</p>
                          </div>
                          <div className="text-right">
                            <Badge variant="outline">{formatDistance(c.distance_km ?? c.distance)}</Badge>
                            {(c.is_hard_to_reach || c.isHardToReach) && <div className="mt-1 text-[10px] font-bold text-red-600">HTR</div>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </InfoCard>
              </div>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <InfoCard title="Nearby Sessions" icon={CalendarDays}>
                  <div className="space-y-3">
                    {context?.nearbyPlans?.length ? context.nearbyPlans.map((plan: any) => (
                      <div key={plan.id ?? plan.name} className="rounded-lg border bg-background p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{plan.name}</p>
                            <p className="text-xs capitalize text-muted-foreground">{plan.sessionType} | {plan.status}</p>
                          </div>
                          <Badge variant="secondary">{formatDistance(plan.distance)}</Badge>
                        </div>
                      </div>
                    )) : <EmptyState text="No planned sessions found near this point." />}
                  </div>
                </InfoCard>

                <InfoCard title="Local Landmarks And Access Notes" icon={Navigation}>
                  <div className="space-y-2">
                    {context?.landmarks?.length ? context.landmarks.map((landmark: any, index: number) => (
                      <DetailRow key={`${landmark.name}-${index}`} label={landmark.type || "Landmark"} value={`${landmark.name} (${formatDistance(landmark.distance)})`} />
                    )) : <EmptyState text="No landmark records found in the immediate local context." />}
                    <DetailRow label="Nearest village travel" value={context?.nearestVillage?.travelTimeMinutes ? `${context.nearestVillage.travelTimeMinutes} min by ${context.nearestVillage.transportMode || "walking"}` : "N/A"} />
                    <DetailRow label="Point density" value={context?.density ? `${formatNumber(context.density)} people/cell` : "N/A"} />
                  </div>
                </InfoCard>
              </div>

              {context?.intersectedFeature && (
                <InfoCard title={`Intersected ${String(context.intersectedFeature.type || "feature").toUpperCase()}`} icon={CheckCircle2} action={<Badge>{context.intersectedFeature.type}</Badge>}>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {Object.entries(context.intersectedFeature.data || {}).filter(([_, value]) => value !== null && value !== undefined && typeof value !== "object").slice(0, 16).map(([key, value]) => (
                      <div key={key} className="rounded-lg bg-muted/30 p-2">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{key.replace(/([A-Z])/g, " $1")}</p>
                        <p className="text-xs font-semibold text-foreground">{String(value)}</p>
                      </div>
                    ))}
                  </div>
                </InfoCard>
              )}

              <div className="rounded-xl border bg-muted/20 p-3 text-xs text-muted-foreground">
                <div className="flex items-start gap-2">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>Intelligence combines live server queries, local map layers, session planning data, saved catchments, administrative boundaries, and gridded population estimates for the selected radius.</p>
                </div>
              </div>
            </div>
          )}
        </ScrollArea>

        <DrawerFooter className="mx-auto w-full max-w-6xl border-t">
          <DrawerClose asChild>
            <Button variant="outline" className="w-full">Close Analysis</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}