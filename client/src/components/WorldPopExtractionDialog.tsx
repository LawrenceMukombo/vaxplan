import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Globe,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Users,
  Building2,
  MapPin,
  Save,
  Sliders,
  RefreshCw,
  Lock,
  Table as TableIcon
} from "lucide-react";
import type { Province, District, Facility, Village } from "@shared/schema";

interface WorldPopExtractionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultProvinceId?: string;
  defaultDistrictId?: string;
  defaultFacilityId?: string;
  onSuccess?: (result: { records: any[]; year: number; createdCount: number; updatedCount: number }) => void | Promise<void>;
}

interface ExtractedCommunityRow {
  villageId: number;
  villageName: string;
  villageCode: string;
  facilityId: number | null;
  facilityName: string;
  facilityHmisCode: string;
  lat: number | null;
  lng: number | null;
  totalPopulation: number;
  under1Population: number;
  under5Population: number;
  pregnantWomen: number;
  malePopulation: number;
  femalePopulation: number;
  confidenceScore: number;
  growthRate: number;
  status: "ready" | "extracted" | "saved" | "no_gps";
  source: string;
}

function mergePopulationRecords(existing: unknown, records: any[]) {
  if (!Array.isArray(existing) || records.length === 0) return existing;
  const byId = new Map<string, any>();
  for (const record of existing) {
    const key = record?.id ? `id:${record.id}` : `${record?.source}:${record?.year}:v:${record?.villageId ?? ""}:f:${record?.facilityId ?? ""}`;
    byId.set(key, record);
  }
  for (const record of records) {
    const key = record?.id ? `id:${record.id}` : `${record?.source}:${record?.year}:v:${record?.villageId ?? ""}:f:${record?.facilityId ?? ""}`;
    byId.set(key, record);
  }
  return Array.from(byId.values());
}

export function WorldPopExtractionDialog({
  open,
  onOpenChange,
  defaultProvinceId = "all",
  defaultDistrictId = "all",
  defaultFacilityId = "all",
  onSuccess,
}: WorldPopExtractionDialogProps) {
  const { toast } = useToast();

  const [selectedProvince, setSelectedProvince] = useState<string>(defaultProvinceId);
  const [selectedDistrict, setSelectedDistrict] = useState<string>(defaultDistrictId);
  const [selectedFacility, setSelectedFacility] = useState<string>(defaultFacilityId);
  const [targetYear, setTargetYear] = useState<number>(new Date().getFullYear());

  // Multiplier parameters (EPI Standards)
  const [under1Percent, setUnder1Percent] = useState<number>(4.0);
  const [under5Percent, setUnder5Percent] = useState<number>(18.0);
  const [pregnantPercent, setPregnantPercent] = useState<number>(5.0);
  const [femalePercent, setFemalePercent] = useState<number>(51.0);
  const [growthRate, setGrowthRate] = useState<number>(2.8);
  const [radiusKm, setRadiusKm] = useState<number>(1.5);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // Extraction State
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [previewRows, setPreviewRows] = useState<ExtractedCommunityRow[]>([]);
  const [hasStarted, setHasStarted] = useState<boolean>(false);
  const [savedCount, setSavedCount] = useState<number>(0);
  const [skippedCount, setSkippedCount] = useState<number>(0);
  const [errorCount, setErrorCount] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>("");
  // Set of villageId|facilityId keys that are already saved in the DB
  const [alreadySavedKeys, setAlreadySavedKeys] = useState<Set<string>>(new Set());

  // Fetch geographic registries
  const { data: tenantInfo } = useQuery<any>({ queryKey: ["/api/me/tenant"] });
  const { data: provinces = [] } = useQuery<Province[]>({
    queryKey: ["/api/provinces", tenantInfo?.id],
    enabled: !!tenantInfo?.id,
  });
  const { data: districts = [] } = useQuery<District[]>({
    queryKey: ["/api/districts", tenantInfo?.id],
    enabled: !!tenantInfo?.id,
  });
  const { data: facilities = [] } = useQuery<Facility[]>({
    queryKey: ["/api/facilities", tenantInfo?.id],
    enabled: !!tenantInfo?.id,
  });
  const { data: villages = [] } = useQuery<Village[]>({
    queryKey: ["/api/villages", tenantInfo?.id],
    enabled: !!tenantInfo?.id,
  });

  const iso3 = tenantInfo?.tenant?.countryCode || "ZMB";

  // Filtered dropdown lists — strict smart cascade
  const filteredDistricts = useMemo(() => {
    if (selectedProvince === "all") return [];
    return districts.filter((d) => Number(d.provinceId) === Number(selectedProvince));
  }, [districts, selectedProvince]);

  const filteredFacilities = useMemo(() => {
    if (selectedDistrict === "all" || selectedProvince === "all") return [];
    return facilities.filter((f) => Number(f.districtId) === Number(selectedDistrict));
  }, [facilities, selectedDistrict, selectedProvince]);

  // Target communities or facilities to extract — requires choosing at least a Province
  const targetVillages = useMemo(() => {
    if (selectedProvince === "all") return [];
    let list = villages;
    if (selectedFacility !== "all") {
      list = list.filter((v) => Number(v.assignedFacilityId) === Number(selectedFacility));
    } else if (selectedDistrict !== "all") {
      list = list.filter((v) => Number(v.districtId) === Number(selectedDistrict));
    } else {
      const distIds = new Set(filteredDistricts.map((d) => Number(d.id)));
      list = list.filter((v) => distIds.has(Number(v.districtId)));
    }
    return list;
  }, [villages, selectedFacility, selectedDistrict, selectedProvince, filteredDistricts]);

  const facilityMap = useMemo(() => new Map(facilities.map((f) => [Number(f.id), f])), [facilities]);
  const districtMap = useMemo(() => new Map(districts.map((d) => [Number(d.id), d])), [districts]);
  const provinceMap = useMemo(() => new Map(provinces.map((p) => [Number(p.id), p])), [provinces]);

  const extractCoords = (obj: any): [number, number] | null => {
    if (!obj) return null;
    if (obj.latitude && obj.longitude) {
      const latVal = parseFloat(obj.latitude.toString());
      const lngVal = parseFloat(obj.longitude.toString());
      if (!isNaN(latVal) && !isNaN(lngVal)) return [latVal, lngVal];
    }
    if (obj.coordinates) {
      try {
        const c = typeof obj.coordinates === "string" ? JSON.parse(obj.coordinates) : obj.coordinates;
        if (Array.isArray(c) && c.length === 2 && !isNaN(Number(c[0])) && !isNaN(Number(c[1]))) {
          return Math.abs(c[0]) < Math.abs(c[1]) ? [Number(c[0]), Number(c[1])] : [Number(c[1]), Number(c[0])];
        }
        if (c?.type === "Point" && Array.isArray(c.coordinates)) {
          return [Number(c.coordinates[1]), Number(c.coordinates[0])];
        }
      } catch {}
    }
    return null;
  };

  // Incremental extract + save: skips already-saved communities, saves each record immediately
  const handleRunExtraction = async () => {
    setHasStarted(true);
    const targetEntities = targetVillages.length > 0 ? targetVillages : (filteredFacilities.length > 0 ? filteredFacilities : facilities);

    if (targetEntities.length === 0) {
      toast({
        title: "No Geographic Targets Found",
        description: "Please select or register communities or facilities to extract gridded population.",
        variant: "destructive",
      });
      return;
    }

    // Filter out already-saved communities so we only process missing ones
    const pending = targetEntities.filter((item) => {
      const isVillage = "assignedFacilityId" in item;
      const vKey = isVillage ? `v:${item.id}` : null;
      const fKey = !isVillage ? `f:${item.id}` : null;
      return !alreadySavedKeys.has(vKey ?? "") && !alreadySavedKeys.has(fKey ?? "");
    });

    // If some were already saved, process either pending (if any exist) or all target entities if user clicks Extract
    const entitiesToProcess = pending.length > 0 ? pending : targetEntities;

    setIsExtracting(true);
    setProgress(0);
    setSavedCount(0);
    setSkippedCount(targetEntities.length - entitiesToProcess.length);
    setErrorCount(0);

    const BATCH_SIZE = 10;
    const newRows: ExtractedCommunityRow[] = [];
    const savedKeys = new Set<string>(alreadySavedKeys);
    let batchBuffer: any[] = [];
    let confirmedSavedCount = 0;
    let confirmedCreatedCount = 0;
    let confirmedUpdatedCount = 0;
    let serverSkippedCount = 0;
    const confirmedRecords: any[] = [];

    const flushBatch = async (batchItems: any[], count: number) => {
      if (batchItems.length === 0) return;
      try {
        const result = await apiRequest<any>("POST", "/api/population/import", { population: batchItems });
        const records = Array.isArray(result?.records) ? result.records : [];
        const created = Number(result?.createdCount ?? 0);
        const updated = Number(result?.updatedCount ?? 0);
        const skipped = Number(result?.skippedCount ?? 0);
        const actualSaved = records.length || created + updated;

        confirmedSavedCount += actualSaved;
        confirmedCreatedCount += created;
        confirmedUpdatedCount += updated;
        serverSkippedCount += skipped;
        confirmedRecords.push(...records);
        setSavedCount((n) => n + actualSaved);
        if (skipped > 0) setSkippedCount((n) => n + skipped);

        for (const record of records) {
          if (record.villageId) savedKeys.add(`v:${record.villageId}`);
          if (record.facilityId) savedKeys.add(`f:${record.facilityId}`);
        }

        queryClient.setQueriesData(
          {
            predicate: (query) => {
              const key = query.queryKey[0];
              return typeof key === "string" && key.startsWith("/api/population");
            },
          },
          (old) => mergePopulationRecords(old, records)
        );
        await queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey[0];
            return typeof key === "string" && key.startsWith("/api/population");
          },
        });
        return records;
      } catch (e: any) {
        console.error("Batch save failed:", e);
        setErrorCount((n) => n + count);
        toast({
          title: "Batch Save Failed",
          description: e?.message || "Failed to save a batch of population records to the database.",
          variant: "destructive",
        });
      }
      return [];
    };

    const total = entitiesToProcess.length;
    for (let i = 0; i < total; i++) {
      const item = entitiesToProcess[i];
      const isVillage = "assignedFacilityId" in item || !!(item as any).villageName;

      const v = isVillage ? (item as Village) : null;
      const f = isVillage
        ? (v?.assignedFacilityId ? facilityMap.get(Number(v.assignedFacilityId)) : null)
        : (item as Facility);
      const d =
        (v?.districtId ? districtMap.get(Number(v.districtId)) : null) ||
        (f?.districtId ? districtMap.get(Number(f.districtId)) : null);
      const p = d?.provinceId ? provinceMap.get(Number(d.provinceId)) : null;

      const vCoords = extractCoords(v);
      const fCoords = extractCoords(f);
      const dCoords = extractCoords(d);
      const pCoords = extractCoords(p);

      const lat = vCoords?.[0] ?? fCoords?.[0] ?? dCoords?.[0] ?? pCoords?.[0] ?? -15.4167;
      const lng = vCoords?.[1] ?? fCoords?.[1] ?? dCoords?.[1] ?? pCoords?.[1] ?? 28.2833;

      let gridPop = Number(
        (item as any).targetPopulation || (item as any).population || (item as any).catchmentGridPopulation || 0
      );
      let sourceName = "worldpop";
      let status: ExtractedCommunityRow["status"] = "ready";

      setStatusMessage(`Extracting ${i + 1}/${total}: ${item.name}…`);

      if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
        try {
          const res = await fetch(
            `/api/population/worldpop-point?lat=${lat}&lng=${lng}&radiusKm=${radiusKm}&iso3=${iso3}`,
            { credentials: "include", cache: "no-store" }
          );
          if (res.ok) {
            const data = await res.json();
            if (data.gridPop && data.gridPop > 0) {
              gridPop = Math.round(data.gridPop);
              sourceName = data.source || "worldpop";
              status = "extracted";
            }
          }
        } catch (e) {
          console.warn("WorldPop point fetch failed for:", item.name, e);
        }
      }

      if (gridPop <= 0) gridPop = 450;

      const under1 = Math.round(gridPop * (under1Percent / 100));
      const under5 = Math.round(gridPop * (under5Percent / 100));
      const pregnant = Math.round(gridPop * (pregnantPercent / 100));
      const female = Math.round(gridPop * (femalePercent / 100));
      const male = gridPop - female;

      const row: ExtractedCommunityRow = {
        villageId: v ? v.id : item.id,
        villageName: item.name,
        villageCode: (item as any).code || (isVillage ? `VILL-${item.id}` : `FAC-${item.id}`),
        facilityId: f ? f.id : (!isVillage ? item.id : null),
        facilityName: f?.name || (!isVillage ? item.name : "—"),
        facilityHmisCode: f?.hmisCode || "",
        lat,
        lng,
        totalPopulation: gridPop,
        under1Population: under1,
        under5Population: under5,
        pregnantWomen: pregnant,
        malePopulation: male,
        femalePopulation: female,
        confidenceScore: status === "extracted" ? 88.5 : 75.0,
        growthRate,
        status: "saved",
        source: sourceName,
      };

      newRows.push(row);
      setPreviewRows([...newRows]);

      // Queue for batch save — include districtId/provinceId/names directly
      batchBuffer.push({
        villageId: v ? v.id : undefined,
        facilityId: f ? f.id : (!isVillage ? item.id : undefined),
        districtId: d?.id ?? undefined,
        provinceId: (d?.provinceId ? Number(d.provinceId) : undefined) ?? (p?.id ?? undefined),
        villageName: v ? v.name : undefined,
        villageCode: v?.code ?? undefined,
        facilityName: f?.name ?? (!isVillage ? item.name : undefined),
        facilityHmisCode: f?.hmisCode ?? undefined,
        source: "worldpop",
        year: targetYear,
        totalPopulation: row.totalPopulation,
        malePopulation: row.malePopulation,
        femalePopulation: row.femalePopulation,
        under1Population: row.under1Population,
        under5Population: row.under5Population,
        pregnantWomen: row.pregnantWomen,
        growthRate: row.growthRate,
        confidenceScore: row.confidenceScore,
      });

      // Flush every BATCH_SIZE records
      if (batchBuffer.length >= BATCH_SIZE) {
        const toFlush = [...batchBuffer];
        const toFlushCount = toFlush.length;
        batchBuffer = [];
        await flushBatch(toFlush, toFlushCount);
      }

      setProgress(Math.round(((i + 1) / total) * 100));
    }

    // Flush any remaining
    if (batchBuffer.length > 0) {
      await flushBatch(batchBuffer, batchBuffer.length);
    }

    setAlreadySavedKeys(savedKeys);
    setIsExtracting(false);
    setStatusMessage(``);
    await queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === "string" && key.startsWith("/api/population");
      },
    });
    await queryClient.refetchQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === "string" && key.startsWith("/api/population");
      },
    });
    queryClient.invalidateQueries({ queryKey: ["/api/stats"] });

    if (confirmedSavedCount > 0) {
      toast({
        title: "WorldPop Extraction Complete",
        description: `Saved ${confirmedSavedCount} WorldPop record${confirmedSavedCount === 1 ? "" : "s"} for ${targetYear}. Created ${confirmedCreatedCount}, updated ${confirmedUpdatedCount}${serverSkippedCount ? `, skipped ${serverSkippedCount}` : ""}.`,
      });
    } else {
      toast({
        title: "WorldPop Extraction Did Not Save Records",
        description: serverSkippedCount
          ? `${serverSkippedCount} extracted record${serverSkippedCount === 1 ? " was" : "s were"} skipped because no matching community or facility was found.`
          : "The extraction preview completed, but the database did not confirm any saved records.",
        variant: "destructive",
      });
    }

    if (onSuccess) {
      onSuccess({
        records: confirmedRecords,
        year: targetYear,
        createdCount: confirmedCreatedCount,
        updatedCount: confirmedUpdatedCount,
      });
    }
  };

  // On open: fetch existing worldpop records so we know what's already saved
  useEffect(() => {
    if (!open) return;
    // Reset UI state
    setIsExtracting(false);
    setProgress(0);
    setPreviewRows([]);
    setHasStarted(false);
    setSavedCount(0);
    setSkippedCount(0);
    setErrorCount(0);
    setStatusMessage("");

    // Load already-saved worldpop keys for the target year
    const loadExisting = async () => {
      try {
        const res = await fetch(`/api/population?source=worldpop&year=${targetYear}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        const records: any[] = Array.isArray(data) ? data : (data.data ?? []);
        const keys = new Set<string>();
        records.forEach((r) => {
          if (r.villageId) keys.add(`v:${r.villageId}`);
          if (r.facilityId) keys.add(`f:${r.facilityId}`);
        });
        setAlreadySavedKeys(keys);
        if (keys.size > 0) {
          setStatusMessage(`${keys.size} communities already have WorldPop data for ${targetYear}.`);
        }
      } catch (e) {
        console.warn("Could not fetch existing worldpop records:", e);
      }
    };
    loadExisting();
  }, [open, targetYear]);

  // handleSaveAll is no longer needed — saving is now incremental inside handleRunExtraction

  const totalExtractedPop = useMemo(() => {
    return previewRows.reduce((sum, r) => sum + r.totalPopulation, 0);
  }, [previewRows]);

  const totalUnder1 = useMemo(() => {
    return previewRows.reduce((sum, r) => sum + r.under1Population, 0);
  }, [previewRows]);

  const totalUnder5 = useMemo(() => {
    return previewRows.reduce((sum, r) => sum + r.under5Population, 0);
  }, [previewRows]);

  const totalPregnant = useMemo(() => {
    return previewRows.reduce((sum, r) => sum + r.pregnantWomen, 0);
  }, [previewRows]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400">
            <Globe className="h-6 w-6" />
            <DialogTitle className="text-xl font-bold">
              Extract, Populate & Assign WorldPop Data
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Automatically extract 100m gridded WorldPop population estimates for catchment communities, compute age cohorts (Under-1, Under-5, Pregnant Women), and save them directly to community records.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Scope Filters */}
          <Card className="border-border/60 bg-muted/20">
            <CardContent className="p-3 space-y-3">
              <div className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                <MapPin className="h-3.5 w-3.5 text-primary" /> Target Geographic Scope & Cohort Year
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                <div>
                  <Label className="text-[11px] text-muted-foreground font-medium">Province / Region</Label>
                  <Select
                    value={selectedProvince}
                    onValueChange={(val) => {
                      setSelectedProvince(val);
                      setSelectedDistrict("all");
                      setSelectedFacility("all");
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs font-normal">
                      <SelectValue placeholder="Select Province" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Select Province / Region</SelectItem>
                      {provinces.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                    District
                    {selectedProvince === "all" && <Lock className="h-2.5 w-2.5 opacity-60 text-muted-foreground" />}
                  </Label>
                  <Select
                    value={selectedDistrict}
                    onValueChange={(val) => {
                      setSelectedDistrict(val);
                      setSelectedFacility("all");
                    }}
                    disabled={selectedProvince === "all"}
                  >
                    <SelectTrigger className="h-8 text-xs font-normal" disabled={selectedProvince === "all"}>
                      <SelectValue
                        placeholder={
                          selectedProvince === "all" ? "Select Province first" : "All Districts"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Districts in Province</SelectItem>
                      {filteredDistricts.map((d) => (
                        <SelectItem key={d.id} value={String(d.id)}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                    Health Facility
                    {(selectedDistrict === "all" || selectedProvince === "all") && (
                      <Lock className="h-2.5 w-2.5 opacity-60 text-muted-foreground" />
                    )}
                  </Label>
                  <Select
                    value={selectedFacility}
                    onValueChange={setSelectedFacility}
                    disabled={selectedDistrict === "all" || selectedProvince === "all"}
                  >
                    <SelectTrigger
                      className="h-8 text-xs font-normal"
                      disabled={selectedDistrict === "all" || selectedProvince === "all"}
                    >
                      <SelectValue
                        placeholder={
                          selectedDistrict === "all" ? "Select District first" : "All Facilities"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Facilities in District</SelectItem>
                      {filteredFacilities.map((f) => (
                        <SelectItem key={f.id} value={String(f.id)}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[11px] text-muted-foreground font-medium">Target Year</Label>
                  <Input
                    type="number"
                    value={targetYear}
                    onChange={(e) => setTargetYear(parseInt(e.target.value) || new Date().getFullYear())}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`font-mono text-[11px] ${
                      selectedProvince === "all"
                        ? "text-muted-foreground bg-muted/40"
                        : "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30"
                    }`}
                  >
                    {selectedProvince === "all"
                      ? "0 Communities (Select Province first)"
                      : `${targetVillages.length} Communities in Scope`}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                  >
                    <Sliders className="h-3 w-3" />
                    {showAdvanced ? "Hide Demographic Multipliers" : "Customize Cohort Ratios (EPI Multipliers)"}
                  </Button>
                </div>

                <Button
                  size="sm"
                  onClick={handleRunExtraction}
                  disabled={isExtracting || targetVillages.length === 0 || selectedProvince === "all"}
                  className="gap-1.5 h-8 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold shadow-sm"
                >
                  {isExtracting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {isExtracting
                    ? `Extracting & Saving (${progress}%)`
                    : selectedProvince === "all"
                    ? "Select Province & District to Extract"
                    : alreadySavedKeys.size > 0
                    ? `Extract & Save ${Math.max(0, targetVillages.length - alreadySavedKeys.size)} New Settlements`
                    : `Extract & Save ${targetVillages.length} Settlements`}
                </Button>
              </div>

              {/* Advanced Multipliers */}
              {showAdvanced && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-border/40 text-[11px]">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Under-1 % (Infants)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={under1Percent}
                      onChange={(e) => setUnder1Percent(parseFloat(e.target.value) || 4.0)}
                      className="h-7 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Under-5 % (Children)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={under5Percent}
                      onChange={(e) => setUnder5Percent(parseFloat(e.target.value) || 18.0)}
                      className="h-7 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Pregnant Women %</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={pregnantPercent}
                      onChange={(e) => setPregnantPercent(parseFloat(e.target.value) || 5.0)}
                      className="h-7 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Female Ratio %</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={femalePercent}
                      onChange={(e) => setFemalePercent(parseFloat(e.target.value) || 51.0)}
                      className="h-7 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Radius (km)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={radiusKm}
                      onChange={(e) => setRadiusKm(parseFloat(e.target.value) || 1.5)}
                      className="h-7 text-xs font-mono"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Progress Bar — only shows during active extraction */}
          {isExtracting && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground font-mono">
                <span className="truncate max-w-[70%]">{statusMessage || "Querying 100m WorldPop raster grid…"}</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-1.5" />
              <div className="flex gap-3 text-[11px] text-muted-foreground pt-0.5">
                <span className="text-emerald-600 font-medium">✓ {savedCount} saved</span>
                {skippedCount > 0 && <span className="text-cyan-600">{skippedCount} already existed</span>}
                {errorCount > 0 && <span className="text-red-500">{errorCount} errors</span>}
              </div>
            </div>
          )}

          {/* Idle prompt — shown only before extraction has been run */}
          {!isExtracting && !hasStarted && previewRows.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-6 text-center text-muted-foreground text-sm border border-dashed border-border/50 rounded-xl bg-muted/10">
              <Globe className="h-8 w-8 text-cyan-500/60" />
              <p className="font-medium text-foreground/70">Ready to extract WorldPop data</p>
              {statusMessage ? (
                <p className="text-xs max-w-sm text-cyan-700 dark:text-cyan-400 font-medium">{statusMessage}</p>
              ) : (
                <p className="text-xs max-w-sm">
                  Select your geographic scope above, then click <strong>Extract &amp; Save WorldPop</strong> to begin querying the 100m gridded raster.
                </p>
              )}
            </div>
          )}

          {/* Done state counters shown after extraction completes */}
          {!isExtracting && hasStarted && previewRows.length > 0 && (
            <div className="flex gap-4 text-xs text-muted-foreground px-1 pt-0.5">
              <span className="text-emerald-600 font-semibold">✓ {savedCount} records saved to database</span>
              {skippedCount > 0 && <span className="text-cyan-600">{skippedCount} already existed</span>}
              {errorCount > 0 && <span className="text-red-500">{errorCount} save errors</span>}
            </div>
          )}

          {/* Extracted Summary & Table Canvas */}
          {previewRows.length > 0 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Card className="p-2.5 bg-cyan-50/50 dark:bg-cyan-950/20 border-cyan-500/20">
                  <div className="text-[10px] text-muted-foreground uppercase font-semibold">Total Population</div>
                  <div className="text-lg font-bold text-cyan-700 dark:text-cyan-300 font-mono">
                    {totalExtractedPop.toLocaleString()}
                  </div>
                </Card>
                <Card className="p-2.5 bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/20">
                  <div className="text-[10px] text-muted-foreground uppercase font-semibold">Under-1 Infants (4%)</div>
                  <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300 font-mono">
                    {totalUnder1.toLocaleString()}
                  </div>
                </Card>
                <Card className="p-2.5 bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-500/20">
                  <div className="text-[10px] text-muted-foreground uppercase font-semibold">Under-5 Children (18%)</div>
                  <div className="text-lg font-bold text-indigo-700 dark:text-indigo-300 font-mono">
                    {totalUnder5.toLocaleString()}
                  </div>
                </Card>
                <Card className="p-2.5 bg-amber-50/50 dark:bg-amber-950/20 border-amber-500/20">
                  <div className="text-[10px] text-muted-foreground uppercase font-semibold">Pregnant Women (5%)</div>
                  <div className="text-lg font-bold text-amber-700 dark:text-amber-300 font-mono">
                    {totalPregnant.toLocaleString()}
                  </div>
                </Card>
              </div>

              <div className="border border-border/60 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-muted/60 sticky top-0 border-b border-border/60 text-[11px] font-semibold text-muted-foreground">
                    <tr>
                      <th className="p-2">Community / Settlement</th>
                      <th className="p-2">Health Facility</th>
                      <th className="p-2">GPS</th>
                      <th className="p-2 text-right">WorldPop Total</th>
                      <th className="p-2 text-right">&lt;1 yr</th>
                      <th className="p-2 text-right">&lt;5 yrs</th>
                      <th className="p-2 text-right">Pregnant</th>
                      <th className="p-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {previewRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-muted/30">
                        <td className="p-2 font-medium">
                          {row.villageName}
                          <span className="text-[10px] text-muted-foreground block font-mono">{row.villageCode}</span>
                        </td>
                        <td className="p-2 text-muted-foreground truncate max-w-[140px]">{row.facilityName}</td>
                        <td className="p-2 font-mono text-[10px] text-muted-foreground">
                          {row.lat && row.lng ? `${row.lat.toFixed(4)}, ${row.lng.toFixed(4)}` : "No GPS"}
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-cyan-600 dark:text-cyan-400">
                          {row.totalPopulation.toLocaleString()}
                        </td>
                        <td className="p-2 text-right font-mono text-emerald-600 dark:text-emerald-400">
                          {row.under1Population.toLocaleString()}
                        </td>
                        <td className="p-2 text-right font-mono text-indigo-600 dark:text-indigo-400">
                          {row.under5Population.toLocaleString()}
                        </td>
                        <td className="p-2 text-right font-mono text-amber-600 dark:text-amber-400">
                          {row.pregnantWomen.toLocaleString()}
                        </td>
                        <td className="p-2 text-center">
                          {row.status === "extracted" ? (
                            <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                              Raster 100m
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                              Baseline
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 border-t border-border/40 pt-3">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>

          {!isExtracting && hasStarted && previewRows.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleRunExtraction}
              className="gap-1.5 border-cyan-500/40 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/30"
            >
              <RefreshCw className="h-4 w-4" />
              Extract Missing Again
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
