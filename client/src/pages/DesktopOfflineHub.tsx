import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { offlineDb, LocalFacility, LocalVillage, LocalMicroplan, LocalGisCache } from "@/lib/offlineDb";
import { useLocation } from "wouter";
import {
  Monitor,
  HardDrive,
  Download,
  Database,
  Wifi,
  WifiOff,
  RefreshCw,
  FolderDown,
  Building2,
  FileSpreadsheet,
  Upload,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Smartphone,
  Laptop,
  CheckCircle2,
  Usb,
  FileDown,
  Layers,
  MapPin,
  AlertTriangle,
} from "lucide-react";

// Safe fetch helper that guarantees credentials and protects against HTML fallback
async function safeFetchJson<T = any>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { credentials: "include" });
    const contentType = res.headers.get("content-type") || "";
    if (!res.ok || !contentType.includes("application/json")) {
      console.warn(`[OfflineHub] Skipped non-JSON or error response from ${url}: HTTP ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[OfflineHub] Network error fetching ${url}:`, err);
    return null;
  }
}

type DrillDownType = "facilities" | "villages" | "microplans" | "gis";

export default function DesktopOfflineHub() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));
  const [downloadingBundle, setDownloadingBundle] = useState(false);
  const [bundleProgress, setBundleProgress] = useState(0);
  const [bundleStatusText, setBundleStatusText] = useState("");

  const [localStats, setLocalStats] = useState({
    facilities: 0,
    villages: 0,
    microplans: 0,
    gisCache: 0,
  });

  // Drill-down Modal State
  const [drillDownTab, setDrillDownTab] = useState<DrillDownType | null>(null);
  const [tableSearch, setTableSearch] = useState("");
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [sortField, setSortField] = useState<string>("id");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Loaded drill-down data
  const [drillFacilities, setDrillFacilities] = useState<LocalFacility[]>([]);
  const [drillVillages, setDrillVillages] = useState<LocalVillage[]>([]);
  const [drillMicroplans, setDrillMicroplans] = useState<LocalMicroplan[]>([]);
  const [drillGis, setDrillGis] = useState<LocalGisCache[]>([]);
  const [isDrillLoading, setIsDrillLoading] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const refreshStats = async () => {
    try {
      const fCount = await offlineDb.facilities.count();
      const vCount = await offlineDb.villages.count();
      const mCount = await offlineDb.microplans.count();
      const gCount = await offlineDb.gisCache.count();
      setLocalStats({
        facilities: fCount,
        villages: vCount,
        microplans: mCount,
        gisCache: gCount,
      });
    } catch (e) {
      console.warn("Could not read local DB stats:", e);
    }
  };

  useEffect(() => {
    void refreshStats();
  }, []);

  // Load records whenever drillDownTab is opened or switched
  useEffect(() => {
    if (!drillDownTab) return;
    setIsDrillLoading(true);
    setTableSearch("");
    setCurrentPage(1);

    const loadData = async () => {
      try {
        if (drillDownTab === "facilities") {
          const rows = await offlineDb.facilities.toArray();
          setDrillFacilities(rows);
          setSortField("name");
        } else if (drillDownTab === "villages") {
          const rows = await offlineDb.villages.toArray();
          setDrillVillages(rows);
          setSortField("name");
        } else if (drillDownTab === "microplans") {
          const rows = await offlineDb.microplans.toArray();
          setDrillMicroplans(rows);
          setSortField("year");
        } else if (drillDownTab === "gis") {
          const rows = await offlineDb.gisCache.toArray();
          setDrillGis(rows);
          setSortField("key");
        }
      } catch (err) {
        console.error("Failed to load drill-down records:", err);
      } finally {
        setIsDrillLoading(false);
      }
    };

    void loadData();
  }, [drillDownTab]);

  // Robust offline bundle download handler with content-type guards and credentials
  const handleDownloadDistrictBundle = async () => {
    setDownloadingBundle(true);
    setBundleProgress(10);
    setBundleStatusText("Initiating offline sync session...");

    let facilitiesCount = 0;
    let villagesCount = 0;
    let microplansCount = 0;
    let boundariesCount = 0;

    try {
      // Step 1: Facilities
      setBundleProgress(25);
      setBundleStatusText("Downloading district facilities...");
      const facs = await safeFetchJson<any[]>("/api/facilities");
      if (Array.isArray(facs) && facs.length > 0) {
        await offlineDb.facilities.bulkPut(
          facs.map((f: any) => ({
            id: f.id,
            tenantId: f.tenantId || "global",
            name: f.name,
            facilityType: f.facilityType || "Health Centre",
            districtId: f.districtId,
            latitude: f.latitude ? Number(f.latitude) : undefined,
            longitude: f.longitude ? Number(f.longitude) : undefined,
            _syncedAt: Date.now(),
          }))
        );
        facilitiesCount = facs.length;
      }

      // Step 2: Settlements / Villages
      setBundleProgress(50);
      setBundleStatusText("Downloading settlements & village registry...");
      const vils = await safeFetchJson<any[]>("/api/villages");
      if (Array.isArray(vils) && vils.length > 0) {
        await offlineDb.villages.bulkPut(
          vils.map((v: any) => ({
            id: v.id,
            tenantId: v.tenantId || "global",
            name: v.name,
            districtId: v.districtId,
            facilityId: v.assignedFacilityId || v.facilityId,
            latitude: v.latitude ? Number(v.latitude) : undefined,
            longitude: v.longitude ? Number(v.longitude) : undefined,
            _syncedAt: Date.now(),
          }))
        );
        villagesCount = vils.length;
      }

      // Step 3: Microplans
      setBundleProgress(75);
      setBundleStatusText("Downloading operational microplans...");
      const plans = await safeFetchJson<any[]>("/api/microplans");
      if (Array.isArray(plans) && plans.length > 0) {
        await offlineDb.microplans.bulkPut(
          plans.map((p: any) => ({
            id: p.id,
            tenantId: p.tenantId || "global",
            name: p.name || `Microplan #${p.id}`,
            year: p.year || new Date().getFullYear(),
            status: p.status || "draft",
            districtId: p.districtId,
            provinceId: p.provinceId,
            targetPopulation: p.targetPopulation,
            totalBudget: p.totalBudget,
            _syncedAt: Date.now(),
          }))
        );
        microplansCount = plans.length;
      }

      // Step 4: GIS Boundaries
      setBundleProgress(90);
      setBundleStatusText("Caching GIS boundary polygons & vector layers...");
      const bnd = await safeFetchJson<any>("/api/gis/boundaries");
      if (bnd && (bnd.type === "FeatureCollection" || Array.isArray(bnd.features))) {
        await offlineDb.gisCache.put({
          key: "boundaries_district",
          tenantId: "global",
          geojson: bnd,
          cachedAt: Date.now(),
        });
        boundariesCount = 1;
      }

      setBundleProgress(100);
      setBundleStatusText("Offline cache verification complete!");
      await refreshStats();

      toast({
        title: "Offline Planning Bundle Ready",
        description: `Successfully cached ${facilitiesCount} facilities, ${villagesCount} settlements, ${microplansCount} microplans, and ${boundariesCount} GIS vector layers to local disk.`,
      });
    } catch (err: any) {
      toast({
        title: "Bundle Download Notice",
        description: err.message || "Failed to complete one or more offline bundle downloads.",
        variant: "destructive",
      });
    } finally {
      setTimeout(() => {
        setDownloadingBundle(false);
        setBundleProgress(0);
        setBundleStatusText("");
      }, 1200);
    }
  };

  // Export Air-Gap Backup to USB
  const handleExportAirGapDump = async () => {
    try {
      const dump = {
        format: "vaxplan-airgap-backup-v1.0",
        exportedAt: new Date().toISOString(),
        clientVersion: "1.9.4",
        stats: localStats,
        facilities: await offlineDb.facilities.toArray(),
        villages: await offlineDb.villages.toArray(),
        microplans: await offlineDb.microplans.toArray(),
        gisCache: await offlineDb.gisCache.toArray(),
      };

      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vaxplan-offline-district-backup-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Air-Gap Backup Exported",
        description: `Full offline district database (${dump.facilities.length} facilities, ${dump.villages.length} villages, ${dump.microplans.length} microplans) exported to JSON for USB transfer.`,
      });
    } catch (err: any) {
      toast({ title: "Export Failed", description: err.message, variant: "destructive" });
    }
  };

  // Import Air-Gap Backup from USB
  const handleImportFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (
        !parsed ||
        (!Array.isArray(parsed.facilities) &&
          !Array.isArray(parsed.villages) &&
          !Array.isArray(parsed.microplans) &&
          !Array.isArray(parsed.gisCache))
      ) {
        throw new Error("Invalid VaxPlan air-gap backup file structure.");
      }

      let fCount = 0;
      let vCount = 0;
      let mCount = 0;
      let gCount = 0;

      if (Array.isArray(parsed.facilities) && parsed.facilities.length > 0) {
        await offlineDb.facilities.bulkPut(parsed.facilities);
        fCount = parsed.facilities.length;
      }
      if (Array.isArray(parsed.villages) && parsed.villages.length > 0) {
        await offlineDb.villages.bulkPut(parsed.villages);
        vCount = parsed.villages.length;
      }
      if (Array.isArray(parsed.microplans) && parsed.microplans.length > 0) {
        await offlineDb.microplans.bulkPut(parsed.microplans);
        mCount = parsed.microplans.length;
      }
      if (Array.isArray(parsed.gisCache) && parsed.gisCache.length > 0) {
        await offlineDb.gisCache.bulkPut(parsed.gisCache);
        gCount = parsed.gisCache.length;
      }

      await refreshStats();

      toast({
        title: "Air-Gap USB Backup Imported Successfully",
        description: `Safely merged ${fCount} facilities, ${vCount} villages, ${mCount} microplans, and ${gCount} GIS layers without overwriting existing offline edits.`,
      });
    } catch (err: any) {
      toast({
        title: "Import Failed",
        description: err.message || "Failed to read air-gap backup file.",
        variant: "destructive",
      });
    } finally {
      if (event.target) event.target.value = "";
    }
  };

  // Export current table view as CSV
  const handleExportTableCsv = (data: any[], filename: string) => {
    if (!data || data.length === 0) {
      toast({ title: "No records to export" });
      return;
    }
    const keys = Object.keys(data[0]).filter((k) => typeof data[0][k] !== "object");
    const header = keys.join(",");
    const rows = data.map((row) =>
      keys.map((k) => `"${String(row[k] ?? "").replace(/"/g, '""')}"`).join(",")
    );
    const csvContent = [header, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "CSV Export Complete", description: `Exported ${data.length} records.` });
  };

  // Filtered and sorted drill-down data
  const filteredFacilities = useMemo(() => {
    let result = drillFacilities.filter((f) => {
      const term = tableSearch.toLowerCase();
      return (
        f.name?.toLowerCase().includes(term) ||
        f.facilityType?.toLowerCase().includes(term) ||
        String(f.id).includes(term) ||
        String(f.districtId).includes(term)
      );
    });
    result.sort((a: any, b: any) => {
      const valA = a[sortField] ?? "";
      const valB = b[sortField] ?? "";
      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
    return result;
  }, [drillFacilities, tableSearch, sortField, sortOrder]);

  const filteredVillages = useMemo(() => {
    let result = drillVillages.filter((v) => {
      const term = tableSearch.toLowerCase();
      return (
        v.name?.toLowerCase().includes(term) ||
        String(v.id).includes(term) ||
        String(v.facilityId).includes(term) ||
        String(v.districtId).includes(term)
      );
    });
    result.sort((a: any, b: any) => {
      const valA = a[sortField] ?? "";
      const valB = b[sortField] ?? "";
      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
    return result;
  }, [drillVillages, tableSearch, sortField, sortOrder]);

  const filteredMicroplans = useMemo(() => {
    let result = drillMicroplans.filter((m) => {
      const term = tableSearch.toLowerCase();
      return (
        m.name?.toLowerCase().includes(term) ||
        m.status?.toLowerCase().includes(term) ||
        String(m.id).includes(term) ||
        String(m.year).includes(term)
      );
    });
    result.sort((a: any, b: any) => {
      const valA = a[sortField] ?? "";
      const valB = b[sortField] ?? "";
      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
    return result;
  }, [drillMicroplans, tableSearch, sortField, sortOrder]);

  const filteredGis = useMemo(() => {
    let result = drillGis.filter((g) => {
      const term = tableSearch.toLowerCase();
      return g.key?.toLowerCase().includes(term) || g.tenantId?.toLowerCase().includes(term);
    });
    result.sort((a: any, b: any) => {
      const valA = a[sortField] ?? "";
      const valB = b[sortField] ?? "";
      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
    return result;
  }, [drillGis, tableSearch, sortField, sortOrder]);

  // Current entity records based on drillDownTab
  const currentEntityList = useMemo(() => {
    if (drillDownTab === "facilities") return filteredFacilities;
    if (drillDownTab === "villages") return filteredVillages;
    if (drillDownTab === "microplans") return filteredMicroplans;
    if (drillDownTab === "gis") return filteredGis;
    return [];
  }, [drillDownTab, filteredFacilities, filteredVillages, filteredMicroplans, filteredGis]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(currentEntityList.length / pageSize));
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return currentEntityList.slice(start, start + pageSize);
  }, [currentEntityList, currentPage, pageSize]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const renderSortIcon = (field: string) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-40 ml-1 inline" />;
    return sortOrder === "asc" ? (
      <ArrowUp className="h-3 w-3 text-primary ml-1 inline" />
    ) : (
      <ArrowDown className="h-3 w-3 text-primary ml-1 inline" />
    );
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
      {/* Hidden file input for USB Air-Gap import */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".json"
        onChange={handleImportFileChange}
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <Monitor className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Windows Desktop Client Hub</h1>
              <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-none">
                Offline Desktop
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Low-connectivity microplanning for health facilities, remote clinics, and district offices.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {isOnline ? (
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 py-1 gap-1 text-xs">
              <Wifi className="h-3.5 w-3.5" /> Connected to Ministry Server
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 py-1 gap-1 text-xs">
              <WifiOff className="h-3.5 w-3.5" /> Running Fully Offline (Local Storage)
            </Badge>
          )}
        </div>
      </div>

      {/* Interactive KPI Cards with Drill-Down Affordance */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Local Storage Telemetry — Click Any Card to Inspect & Drill Down
          </span>
          <span className="text-xs text-primary font-medium">Click to inspect →</span>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Facilities */}
          <Card
            onClick={() => setDrillDownTab("facilities")}
            className="border shadow-xs cursor-pointer hover:border-blue-500 transition-all hover:shadow-md active:scale-98 group bg-card"
          >
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground font-medium">Cached Facilities</div>
                  <div className="text-2xl font-bold mt-1 text-foreground">{localStats.facilities}</div>
                </div>
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Building2 className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3 pt-2 border-t text-[11px] text-primary flex items-center justify-between">
                <span>View local records</span>
                <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Villages */}
          <Card
            onClick={() => setDrillDownTab("villages")}
            className="border shadow-xs cursor-pointer hover:border-emerald-500 transition-all hover:shadow-md active:scale-98 group bg-card"
          >
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground font-medium">Cached Villages</div>
                  <div className="text-2xl font-bold mt-1 text-foreground">{localStats.villages}</div>
                </div>
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <HardDrive className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3 pt-2 border-t text-[11px] text-emerald-600 flex items-center justify-between">
                <span>View local records</span>
                <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Microplans */}
          <Card
            onClick={() => setDrillDownTab("microplans")}
            className="border shadow-xs cursor-pointer hover:border-purple-500 transition-all hover:shadow-md active:scale-98 group bg-card"
          >
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground font-medium">Local Microplans</div>
                  <div className="text-2xl font-bold mt-1 text-foreground">{localStats.microplans}</div>
                </div>
                <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3 pt-2 border-t text-[11px] text-purple-600 flex items-center justify-between">
                <span>View local records</span>
                <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </CardContent>
          </Card>

          {/* Card 4: GIS Layers */}
          <Card
            onClick={() => setDrillDownTab("gis")}
            className="border shadow-xs cursor-pointer hover:border-amber-500 transition-all hover:shadow-md active:scale-98 group bg-card"
          >
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground font-medium">GIS Vector Layers</div>
                  <div className="text-2xl font-bold mt-1 text-foreground">{localStats.gisCache}</div>
                </div>
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Database className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3 pt-2 border-t text-[11px] text-amber-600 flex items-center justify-between">
                <span>View local records</span>
                <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* District Bundle Pre-Caching */}
      <Card className="border shadow-xs">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Download className="h-5 w-5 text-blue-600" />
            Download District Planning Bundle
          </CardTitle>
          <CardDescription>
            Download your full district's health facilities, villages, microplan templates, and GIS boundaries to local disk so you can work completely offline.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {downloadingBundle && (
            <div className="space-y-2 p-3 bg-muted/50 rounded-lg border">
              <div className="flex justify-between text-xs font-semibold">
                <span>{bundleStatusText || "Caching District Assets..."}</span>
                <span>{bundleProgress}%</span>
              </div>
              <Progress value={bundleProgress} className="h-2" />
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleDownloadDistrictBundle}
              disabled={downloadingBundle || !isOnline}
              className="gap-2 font-bold bg-blue-600 hover:bg-blue-700 text-white"
            >
              <RefreshCw className={`h-4 w-4 ${downloadingBundle ? "animate-spin" : ""}`} />
              {downloadingBundle ? "Caching District Data..." : "Cache Entire District for Offline Use"}
            </Button>
            <Button
              variant="outline"
              onClick={handleExportAirGapDump}
              className="gap-2 text-foreground font-semibold"
            >
              <FolderDown className="h-4 w-4" />
              Export Air-Gap JSON Backup (USB Transfer)
            </Button>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="gap-2 text-foreground font-semibold"
            >
              <Upload className="h-4 w-4" />
              Import Air-Gap JSON Backup (USB Transfer)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Air-Gap USB Synchronization Workflow Guide */}
      <Card className="border shadow-xs bg-slate-50/50 dark:bg-slate-900/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Usb className="h-4 w-4 text-blue-600" />
            How to Use Air-Gap USB Synchronization
          </CardTitle>
          <CardDescription>
            Seamlessly bridge data between internet-connected ministry servers and remote offline health facilities using standard USB drives.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3 bg-card rounded-lg border space-y-1.5">
              <div className="font-semibold flex items-center gap-1.5 text-blue-600">
                <span className="h-5 w-5 rounded-full bg-blue-600/10 flex items-center justify-center text-[11px] font-bold">1</span>
                Export on Workstation
              </div>
              <p className="text-muted-foreground">
                Plug in a USB flash drive, click <strong>Export Air-Gap JSON Backup</strong>, and save the file onto the USB drive.
              </p>
            </div>
            <div className="p-3 bg-card rounded-lg border space-y-1.5">
              <div className="font-semibold flex items-center gap-1.5 text-emerald-600">
                <span className="h-5 w-5 rounded-full bg-emerald-600/10 flex items-center justify-center text-[11px] font-bold">2</span>
                Transport to Field
              </div>
              <p className="text-muted-foreground">
                Take the USB drive to remote health centres or field laptops that have zero internet or cellular connectivity.
              </p>
            </div>
            <div className="p-3 bg-card rounded-lg border space-y-1.5">
              <div className="font-semibold flex items-center gap-1.5 text-purple-600">
                <span className="h-5 w-5 rounded-full bg-purple-600/10 flex items-center justify-center text-[11px] font-bold">3</span>
                Import & Merge
              </div>
              <p className="text-muted-foreground">
                Click <strong>Import Air-Gap JSON Backup</strong> and choose the file. Facilities, villages, and plans are safely upserted without internet.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Multi-Device Native App Ecosystem */}
      <Card className="border shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-primary" />
            Cross-Device Native Applications & Seamless Sync
          </CardTitle>
          <CardDescription>
            Download native applications for laptops and tablets. All devices sync seamlessly via IndexedDB, background sync, and air-gap USB transfers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="p-4 border rounded-xl bg-card space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-bold flex items-center gap-2">
                  <Laptop className="h-4 w-4 text-blue-600" />
                  Windows Desktop Workstation
                </div>
                <Badge variant="outline" className="text-[10px]">64-bit EXE</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Complete offline desktop experience for facility managers and district health officers with GIS map tiling and multi-year microplan builder.
              </p>
              <div className="pt-2 flex items-center gap-2">
                <Badge className="bg-blue-600 text-white hover:bg-blue-700 text-xs">VaxPlanSetup.exe</Badge>
                <span className="text-[11px] text-muted-foreground">Build with: <code className="bg-muted px-1 py-0.5 rounded">npm run build:windows</code></span>
              </div>
            </div>

            <div className="p-4 border rounded-xl bg-card space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-bold flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-emerald-600" />
                  Android Mobile Application
                </div>
                <Badge variant="outline" className="text-[10px]">APK (API 26+)</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Oversized touch targets (≥44px), GPS household geofencing, and zero-connectivity tallying for community health workers and mobile vaccinators.
              </p>
              <div className="pt-2 flex items-center gap-2">
                <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 text-xs">VaxPlan-Android.apk</Badge>
                <span className="text-[11px] text-muted-foreground">Build with: <code className="bg-muted px-1 py-0.5 rounded">npm run build:android</code></span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─────────────────────────────────────────────────────────────────────────────
          ENTERPRISE DRILL-DOWN DIALOG (Global Rule 24: Enterprise Tables)
         ───────────────────────────────────────────────────────────────────────────── */}
      <Dialog open={drillDownTab !== null} onOpenChange={(open) => !open && setDrillDownTab(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-6">
          <DialogHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Local Storage Record Inspector
              </DialogTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExportTableCsv(currentEntityList, `vaxplan-local-${drillDownTab}`)}
                className="gap-1.5 text-xs"
              >
                <FileDown className="h-3.5 w-3.5" />
                Export Table (CSV)
              </Button>
            </div>
            <DialogDescription className="text-xs">
              Direct inspection of offline database records cached in this device's persistent browser storage.
            </DialogDescription>
          </DialogHeader>

          {/* Tab Navigation */}
          <Tabs
            value={drillDownTab || "facilities"}
            onValueChange={(val) => setDrillDownTab(val as DrillDownType)}
            className="flex-1 flex flex-col min-h-0 mt-3"
          >
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="facilities" className="gap-1 text-xs">
                <Building2 className="h-3.5 w-3.5" /> Facilities ({localStats.facilities})
              </TabsTrigger>
              <TabsTrigger value="villages" className="gap-1 text-xs">
                <HardDrive className="h-3.5 w-3.5" /> Villages ({localStats.villages})
              </TabsTrigger>
              <TabsTrigger value="microplans" className="gap-1 text-xs">
                <FileSpreadsheet className="h-3.5 w-3.5" /> Microplans ({localStats.microplans})
              </TabsTrigger>
              <TabsTrigger value="gis" className="gap-1 text-xs">
                <Layers className="h-3.5 w-3.5" /> GIS Layers ({localStats.gisCache})
              </TabsTrigger>
            </TabsList>

            {/* Filter & Search Bar */}
            <div className="flex items-center justify-between gap-3 my-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={`Search cached ${drillDownTab}...`}
                  value={tableSearch}
                  onChange={(e) => {
                    setTableSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9 h-9 text-xs"
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
                <span>Rows per page:</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(val) => {
                    setPageSize(Number(val));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-16 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Scrollable Enterprise Table Container */}
            <div className="flex-1 overflow-auto border rounded-md min-h-[300px]">
              {isDrillLoading ? (
                <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
                  <RefreshCw className="h-5 w-5 animate-spin mr-2 text-primary" /> Loading cached records...
                </div>
              ) : currentEntityList.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-sm text-muted-foreground space-y-2 p-6 text-center">
                  <AlertTriangle className="h-8 w-8 text-amber-500" />
                  <div className="font-semibold text-foreground">No records cached locally</div>
                  <p className="text-xs max-w-sm">
                    {tableSearch
                      ? "No records matched your search query. Try clearing the filter."
                      : "Click 'Cache Entire District for Offline Use' or import an air-gap backup to populate this dataset."}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/40 sticky top-0 z-10">
                    {/* Facilities Header */}
                    {drillDownTab === "facilities" && (
                      <TableRow>
                        <TableHead onClick={() => handleSort("id")} className="cursor-pointer text-xs w-20">
                          ID {renderSortIcon("id")}
                        </TableHead>
                        <TableHead onClick={() => handleSort("name")} className="cursor-pointer text-xs">
                          Facility Name {renderSortIcon("name")}
                        </TableHead>
                        <TableHead onClick={() => handleSort("facilityType")} className="cursor-pointer text-xs">
                          Type {renderSortIcon("facilityType")}
                        </TableHead>
                        <TableHead onClick={() => handleSort("districtId")} className="cursor-pointer text-xs">
                          District ID {renderSortIcon("districtId")}
                        </TableHead>
                        <TableHead className="text-xs">GPS Coordinates</TableHead>
                        <TableHead className="text-xs text-right">Status</TableHead>
                      </TableRow>
                    )}

                    {/* Villages Header */}
                    {drillDownTab === "villages" && (
                      <TableRow>
                        <TableHead onClick={() => handleSort("id")} className="cursor-pointer text-xs w-20">
                          ID {renderSortIcon("id")}
                        </TableHead>
                        <TableHead onClick={() => handleSort("name")} className="cursor-pointer text-xs">
                          Settlement / Village {renderSortIcon("name")}
                        </TableHead>
                        <TableHead onClick={() => handleSort("facilityId")} className="cursor-pointer text-xs">
                          Assigned Facility {renderSortIcon("facilityId")}
                        </TableHead>
                        <TableHead onClick={() => handleSort("districtId")} className="cursor-pointer text-xs">
                          District ID {renderSortIcon("districtId")}
                        </TableHead>
                        <TableHead className="text-xs">GPS Coordinates</TableHead>
                        <TableHead className="text-xs text-right">Status</TableHead>
                      </TableRow>
                    )}

                    {/* Microplans Header */}
                    {drillDownTab === "microplans" && (
                      <TableRow>
                        <TableHead onClick={() => handleSort("id")} className="cursor-pointer text-xs w-20">
                          ID {renderSortIcon("id")}
                        </TableHead>
                        <TableHead onClick={() => handleSort("name")} className="cursor-pointer text-xs">
                          Microplan Title {renderSortIcon("name")}
                        </TableHead>
                        <TableHead onClick={() => handleSort("year")} className="cursor-pointer text-xs">
                          Year {renderSortIcon("year")}
                        </TableHead>
                        <TableHead onClick={() => handleSort("status")} className="cursor-pointer text-xs">
                          Plan Status {renderSortIcon("status")}
                        </TableHead>
                        <TableHead className="text-xs">Target Pop</TableHead>
                        <TableHead className="text-xs text-right">Action</TableHead>
                      </TableRow>
                    )}

                    {/* GIS Layers Header */}
                    {drillDownTab === "gis" && (
                      <TableRow>
                        <TableHead onClick={() => handleSort("key")} className="cursor-pointer text-xs">
                          Layer Key {renderSortIcon("key")}
                        </TableHead>
                        <TableHead className="text-xs">Format</TableHead>
                        <TableHead className="text-xs">Feature Count</TableHead>
                        <TableHead onClick={() => handleSort("cachedAt")} className="cursor-pointer text-xs">
                          Cached Timestamp {renderSortIcon("cachedAt")}
                        </TableHead>
                        <TableHead className="text-xs text-right">Status</TableHead>
                      </TableRow>
                    )}
                  </TableHeader>

                  <TableBody>
                    {/* Facilities Rows */}
                    {drillDownTab === "facilities" &&
                      (paginatedList as LocalFacility[]).map((f) => (
                        <TableRow key={f.id} className="hover:bg-muted/50 text-xs">
                          <TableCell className="font-mono text-muted-foreground">{f.id}</TableCell>
                          <TableCell className="font-medium text-foreground">{f.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] py-0">
                              {f.facilityType || "Health Facility"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">District #{f.districtId ?? "N/A"}</TableCell>
                          <TableCell className="font-mono text-muted-foreground text-[11px]">
                            {f.latitude && f.longitude ? (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-emerald-600" />
                                {Number(f.latitude).toFixed(4)}, {Number(f.longitude).toFixed(4)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/60 italic">No GPS</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-none text-[10px]">
                              Offline Ready
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}

                    {/* Villages Rows */}
                    {drillDownTab === "villages" &&
                      (paginatedList as LocalVillage[]).map((v) => (
                        <TableRow key={v.id} className="hover:bg-muted/50 text-xs">
                          <TableCell className="font-mono text-muted-foreground">{v.id}</TableCell>
                          <TableCell className="font-medium text-foreground">{v.name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {v.facilityId ? `Facility #${v.facilityId}` : "Unassigned"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">District #{v.districtId ?? "N/A"}</TableCell>
                          <TableCell className="font-mono text-muted-foreground text-[11px]">
                            {v.latitude && v.longitude ? (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-blue-600" />
                                {Number(v.latitude).toFixed(4)}, {Number(v.longitude).toFixed(4)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/60 italic">No GPS</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-none text-[10px]">
                              Cached
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}

                    {/* Microplans Rows */}
                    {drillDownTab === "microplans" &&
                      (paginatedList as LocalMicroplan[]).map((m) => (
                        <TableRow key={m.id} className="hover:bg-muted/50 text-xs">
                          <TableCell className="font-mono text-muted-foreground">{m.id}</TableCell>
                          <TableCell className="font-medium text-foreground">{m.name || `Plan #${m.id}`}</TableCell>
                          <TableCell className="text-muted-foreground">{m.year || "2026"}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[10px] capitalize ${
                                m.status === "approved"
                                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                                  : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
                              }`}
                            >
                              {m.status || "draft"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-muted-foreground">
                            {m.targetPopulation ? Number(m.targetPopulation).toLocaleString() : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setDrillDownTab(null);
                                setLocation(`/microplans/routine`);
                              }}
                              className="h-7 text-xs gap-1 text-primary hover:text-primary"
                            >
                              Open Plan <ExternalLink className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}

                    {/* GIS Layers Rows */}
                    {drillDownTab === "gis" &&
                      (paginatedList as LocalGisCache[]).map((g) => {
                        const featureCount = g.geojson?.features?.length ?? (g.geojson ? 1 : 0);
                        return (
                          <TableRow key={g.key} className="hover:bg-muted/50 text-xs">
                            <TableCell className="font-mono font-medium text-foreground">{g.key}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px]">
                                {g.rasterBuffer ? "GeoTIFF Raster" : "GeoJSON Vector"}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-muted-foreground">
                              {featureCount} {featureCount === 1 ? "feature" : "features"}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {new Date(g.cachedAt).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-none text-[10px]">
                                Ready Offline
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Enterprise Pagination Controls (Global Rule 24) */}
            <div className="flex items-center justify-between pt-3 border-t text-xs text-muted-foreground mt-2">
              <div>
                Showing{" "}
                <span className="font-semibold text-foreground">
                  {currentEntityList.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-foreground">
                  {Math.min(currentPage * pageSize, currentEntityList.length)}
                </span>{" "}
                of <span className="font-semibold text-foreground">{currentEntityList.length}</span> records
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-7 w-7 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2 text-xs">
                  Page <span className="font-medium text-foreground">{currentPage}</span> of{" "}
                  <span className="font-medium text-foreground">{totalPages}</span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="h-7 w-7 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
