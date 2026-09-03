import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Snowflake, Thermometer, Wrench, AlertTriangle, CheckCircle2,
  Plus, Download, Upload, Search, Filter, RefreshCw, Building2,
  SlidersHorizontal, Eye, FileSpreadsheet, Lock, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { DataTable } from "@/components/DataTable";

// Types
type EquipmentType =
  | "refrigerator" | "freezer" | "icm" | "cold_box" | "vaccine_carrier"
  | "generator" | "temperature_logger" | "other";

type Condition =
  | "functional" | "needs_repair" | "non_functional" | "condemned" | "decommissioned";

type PowerSource =
  | "solar" | "electric" | "gas" | "kerosene" | "battery" | "solar_dc" | "none";

interface ColdChainRow {
  id: number;
  facilityId: number;
  facilityName: string | null;
  facilityCode: string | null;
  provinceId: number | null;
  districtId: number | null;
  equipmentType: EquipmentType;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  catalogNumber: string | null;
  capacityLiters: string | null;
  netStorageCapacityLiters: string | null;
  temperatureMin: string | null;
  temperatureMax: string | null;
  powerSource: PowerSource | null;
  energyConsumptionKwhDay: string | null;
  manufactureYear: number | null;
  installationDate: string | null;
  purchaseCost: string | null;
  purchaseCurrency: string | null;
  warrantyExpiry: string | null;
  supplier: string | null;
  donorFunded: boolean;
  fundingSource: string | null;
  condition: Condition;
  lastServiceDate: string | null;
  nextServiceDue: string | null;
  lastTemperatureCheck: string | null;
  maintenanceNotes: string | null;
  isActive: boolean;
  notes: string | null;
}

const EQUIPMENT_TYPE_LABELS: Record<EquipmentType, string> = {
  refrigerator: "Refrigerator",
  freezer: "Freezer",
  icm: "Ice-Lined Refrigerator",
  cold_box: "Cold Box",
  vaccine_carrier: "Vaccine Carrier",
  generator: "Generator / Back-up Power",
  temperature_logger: "Temperature Logger",
  other: "Other Equipment",
};

const CONDITION_CONFIG: Record<Condition, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; colorClass: string }> = {
  functional: { label: "Functional", variant: "default", colorClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
  needs_repair: { label: "Needs Repair", variant: "secondary", colorClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  non_functional: { label: "Non-Functional", variant: "destructive", colorClass: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30" },
  condemned: { label: "Condemned", variant: "destructive", colorClass: "bg-rose-900/15 text-rose-800 dark:text-rose-300 border-rose-800/30" },
  decommissioned: { label: "Decommissioned", variant: "outline", colorClass: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30" },
};

const POWER_SOURCE_LABELS: Record<string, string> = {
  solar: "Solar Direct Drive (SDD)",
  solar_dc: "Solar DC",
  electric: "Mains Electricity",
  gas: "Gas (LPG)",
  kerosene: "Kerosene",
  battery: "Battery",
  none: "Passive (Ice / Gel)",
};

export default function ColdChainInventory() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProvinceId, setSelectedProvinceId] = useState<string>("all");
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>("all");
  const [selectedEquipmentType, setSelectedEquipmentType] = useState<string>("all");
  const [selectedCondition, setSelectedCondition] = useState<string>("all");
  const [selectedPowerSource, setSelectedPowerSource] = useState<string>("all");

  // Pagination & Column Visibility
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    facility: true,
    type: true,
    model: true,
    serialNumber: true,
    capacity: true,
    condition: true,
    power: true,
    lastService: true,
    actions: true,
  });

  // Modal States
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ColdChainRow | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Queries
  const { data: rawEquipment = [], isLoading, isError, refetch } = useQuery<ColdChainRow[]>({
    queryKey: ["/api/cold-chain"],
  });

  const { data: facilities = [] } = useQuery<any[]>({
    queryKey: ["/api/facilities"],
  });

  const { data: provinces = [] } = useQuery<any[]>({
    queryKey: ["/api/provinces"],
  });

  const { data: districts = [] } = useQuery<any[]>({
    queryKey: ["/api/districts"],
  });

  // Filtered Districts based on selected province
  const filteredDistricts = useMemo(() => {
    if (selectedProvinceId === "all") return districts;
    return districts.filter((d: any) => d.provinceId === Number(selectedProvinceId));
  }, [districts, selectedProvinceId]);

  const districtMap = useMemo(() => {
    const map = new Map<number, any>();
    districts.forEach((d: any) => map.set(d.id, d));
    return map;
  }, [districts]);

  // Main Filtered Data
  const filteredEquipment = useMemo(() => {
    return rawEquipment.filter((item) => {
      const dist = districtMap.get(item.districtId || 0);
      const itemProvinceId = dist ? dist.provinceId : item.provinceId ?? null;

      // Province / District Filter
      if (selectedProvinceId !== "all" && itemProvinceId !== Number(selectedProvinceId)) return false;
      if (selectedDistrictId !== "all" && item.districtId !== Number(selectedDistrictId)) return false;

      // Type / Condition / Power Source
      if (selectedEquipmentType !== "all" && item.equipmentType !== selectedEquipmentType) return false;
      if (selectedCondition !== "all" && item.condition !== selectedCondition) return false;
      if (selectedPowerSource !== "all" && item.powerSource !== selectedPowerSource) return false;

      // Text Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const facilityName = (item.facilityName || "").toLowerCase();
        const brand = (item.brand || "").toLowerCase();
        const model = (item.model || "").toLowerCase();
        const serial = (item.serialNumber || "").toLowerCase();
        const catalog = (item.catalogNumber || "").toLowerCase();
        const typeLabel = (EQUIPMENT_TYPE_LABELS[item.equipmentType] || "").toLowerCase();

        return (
          facilityName.includes(q) ||
          brand.includes(q) ||
          model.includes(q) ||
          serial.includes(q) ||
          catalog.includes(q) ||
          typeLabel.includes(q)
        );
      }

      return true;
    });
  }, [rawEquipment, selectedProvinceId, selectedDistrictId, selectedEquipmentType, selectedCondition, selectedPowerSource, searchQuery]);

  // Analytics Metrics
  const metrics = useMemo(() => {
    const total = filteredEquipment.length;
    const functionalCount = filteredEquipment.filter((e) => e.condition === "functional").length;
    const needsRepairCount = filteredEquipment.filter((e) => e.condition === "needs_repair").length;
    const nonFunctionalCount = filteredEquipment.filter((e) => e.condition === "non_functional" || e.condition === "condemned").length;

    const functionalRate = total > 0 ? Math.round((functionalCount / total) * 100) : 0;
    const totalStorageLitres = filteredEquipment.reduce((acc, curr) => {
      const val = parseFloat(curr.netStorageCapacityLiters || curr.capacityLiters || "0");
      return acc + (isNaN(val) ? 0 : val);
    }, 0);

    return {
      total,
      functionalCount,
      needsRepairCount,
      nonFunctionalCount,
      functionalRate,
      totalStorageLitres: Math.round(totalStorageLitres),
    };
  }, [filteredEquipment]);

  // Soft-Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (item: ColdChainRow) => {
      const res = await fetch(`/api/facilities/${item.facilityId}/cold-chain/${item.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete cold chain item");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Equipment removed from active inventory." });
      queryClient.invalidateQueries({ queryKey: ["/api/cold-chain"] });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Delete Failed", description: err.message });
    },
  });

  // Export CSV
  const handleExportCSV = () => {
    if (filteredEquipment.length === 0) {
      toast({ title: "No Data", description: "There is no equipment data to export." });
      return;
    }

    const headers = [
      "ID", "Facility ID", "Facility Name", "Equipment Type", "Brand", "Model",
      "Serial Number", "Catalog Number", "Capacity (L)", "Net Storage Capacity (L)",
      "Power Source", "Condition", "Manufacture Year", "Installation Date", "Last Service Date"
    ];

    const rows = filteredEquipment.map((e) => [
      e.id, e.facilityId, `"${(e.facilityName || "").replace(/"/g, '""')}"`, e.equipmentType,
      `"${(e.brand || "").replace(/"/g, '""')}"`, `"${(e.model || "").replace(/"/g, '""')}"`,
      `"${(e.serialNumber || "").replace(/"/g, '""')}"`, `"${(e.catalogNumber || "").replace(/"/g, '""')}"`,
      e.capacityLiters || "", e.netStorageCapacityLiters || "", e.powerSource || "",
      e.condition, e.manufactureYear || "", e.installationDate || "", e.lastServiceDate || ""
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `cold_chain_inventory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download Import Template
  const handleDownloadTemplate = () => {
    const headers = [
      "ID", "Facility ID", "Facility Name", "Equipment Type", "Brand", "Model",
      "Serial Number", "Catalog Number", "Capacity (L)", "Net Storage Capacity (L)",
      "Power Source", "Condition", "Manufacture Year", "Installation Date", "Last Service Date"
    ];
    const sampleRows = [
      ',25318,"Addo Clinic",solar_direct_drive_refrigerator,"Dulas Arctiko","PURE 50","SN-ADD-001290","E003/042",55.00,45.00,solar,functional,2023,2023-08-15,2026-05-10',
      ',25318,"Addo Clinic",icm,"Haier","HBC-80","SN-ADD-001291","E003/014",80.00,68.00,electric,functional,2021,2021-11-20,2026-04-18',
      ',25318,"Addo Clinic",freezer,"Vestfrost","MF 314","SN-ADD-001292","E003/023",281.00,230.00,electric,functional,2020,2021-02-14,2026-05-22',
      ',25318,"Addo Clinic",cold_box,"AOV","AOV-CB-25","SN-ADD-001293","E004/008",24.00,20.00,none,functional,2022,2022-03-10,2026-04-01'
    ];
    const content = [headers.join(","), ...sampleRows].join("\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "cold_chain_equipment_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSVClick = () => {
    document.getElementById("csv-cce-import")?.click();
  };

  const handleImportCSVChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      try {
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) throw new Error("CSV file must contain at least a header row and one data row.");

        const parseRow = (line: string) => {
          const cells: string[] = [];
          let cur = "";
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              if (inQuotes && line[i + 1] === '"') {
                cur += '"';
                i++;
              } else {
                inQuotes = !inQuotes;
              }
            } else if (char === "," && !inQuotes) {
              cells.push(cur.trim());
              cur = "";
            } else {
              cur += char;
            }
          }
          cells.push(cur.trim());
          return cells;
        };

        const headers = parseRow(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
        const getColIdx = (aliases: string[]) => headers.findIndex((h) => aliases.includes(h));

        const idIdx = getColIdx(["id"]);
        const facIdIdx = getColIdx(["facilityid", "facility_id", "facid"]);
        const facNameIdx = getColIdx(["facilityname", "facility_name", "facility"]);
        const typeIdx = getColIdx(["equipmenttype", "equipment_type", "type"]);
        const brandIdx = getColIdx(["brand", "make", "manufacturer"]);
        const modelIdx = getColIdx(["model", "modelnumber", "model_number"]);
        const serialIdx = getColIdx(["serialnumber", "serial_number", "serial", "serialno"]);
        const catalogIdx = getColIdx(["catalognumber", "catalog_number", "catalog", "piscode"]);
        const capIdx = getColIdx(["capacityl", "capacityliters", "capacity", "grosscapacity"]);
        const netCapIdx = getColIdx(["netstoragecapacityl", "netstoragecapacityliters", "netcapacity", "netstorage"]);
        const powerIdx = getColIdx(["powersource", "power_source", "power"]);
        const condIdx = getColIdx(["condition", "status", "operationalstatus"]);
        const mfgIdx = getColIdx(["manufactureyear", "manufacture_year", "year"]);
        const installIdx = getColIdx(["installationdate", "installation_date", "installed"]);
        const serviceIdx = getColIdx(["lastservicedate", "last_service_date", "servicedate", "lastservice"]);

        const items = [];
        for (let i = 1; i < lines.length; i++) {
          const vals = parseRow(lines[i]);
          if (!vals || vals.length === 0 || vals.every((v) => !v)) continue;

          const getVal = (idx: number) => (idx > -1 && vals[idx] !== undefined && vals[idx] !== "" ? vals[idx] : undefined);

          items.push({
            id: getVal(idIdx),
            facilityId: getVal(facIdIdx),
            facilityName: getVal(facNameIdx),
            equipmentType: getVal(typeIdx) || "refrigerator",
            brand: getVal(brandIdx),
            model: getVal(modelIdx),
            serialNumber: getVal(serialIdx),
            catalogNumber: getVal(catalogIdx),
            capacityLiters: getVal(capIdx),
            netStorageCapacityLiters: getVal(netCapIdx),
            powerSource: getVal(powerIdx),
            condition: getVal(condIdx) || "functional",
            manufactureYear: getVal(mfgIdx),
            installationDate: getVal(installIdx),
            lastServiceDate: getVal(serviceIdx),
          });
        }

        if (items.length === 0) throw new Error("No valid data rows found in CSV file.");

        const res = await fetch("/api/cold-chain/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ items }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to import cold chain equipment");

        toast({
          title: "Import Complete",
          description: data.message || `Successfully processed ${items.length} equipment units.`,
        });

        void queryClient.invalidateQueries({ queryKey: ["/api/cold-chain"] });
      } catch (err: any) {
        toast({
          variant: "destructive",
          title: "Import Failed",
          description: err.message || "Could not parse or process the CSV file.",
        });
      } finally {
        setIsImporting(false);
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedProvinceId("all");
    setSelectedDistrictId("all");
    setSelectedEquipmentType("all");
    setSelectedCondition("all");
    setSelectedPowerSource("all");
    setCurrentPage(1);
  };

  const hasActiveFilters =
    searchQuery !== "" ||
    selectedProvinceId !== "all" ||
    selectedDistrictId !== "all" ||
    selectedEquipmentType !== "all" ||
    selectedCondition !== "all" ||
    selectedPowerSource !== "all";

  // Table Columns Setup
  const columns = [
    {
      key: "facility",
      header: "Health Facility",
      visible: visibleColumns.facility,
      render: (row: ColdChainRow) => (
        <div className="flex flex-col">
          <Link href={`/facilities?id=${row.facilityId}`} className="font-semibold text-primary hover:underline flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            {row.facilityName || `Facility #${row.facilityId}`}
          </Link>
          {row.facilityCode && <span className="text-[11px] text-muted-foreground font-mono">{row.facilityCode}</span>}
        </div>
      ),
    },
    {
      key: "type",
      header: "Equipment Type",
      visible: visibleColumns.type,
      render: (row: ColdChainRow) => (
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-primary/10 text-primary">
            <Snowflake className="h-4 w-4" />
          </div>
          <span className="font-medium text-sm">{EQUIPMENT_TYPE_LABELS[row.equipmentType] || row.equipmentType}</span>
        </div>
      ),
    },
    {
      key: "model",
      header: "Brand & Model",
      visible: visibleColumns.model,
      render: (row: ColdChainRow) => (
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{row.brand || "Generic"}</span>
          <span className="text-xs text-muted-foreground">{row.model || "—"}</span>
        </div>
      ),
    },
    {
      key: "serialNumber",
      header: "Serial / Catalog #",
      visible: visibleColumns.serialNumber,
      render: (row: ColdChainRow) => (
        <div className="flex flex-col font-mono text-xs">
          <span>{row.serialNumber || "SN: —"}</span>
          <span className="text-muted-foreground text-[11px]">{row.catalogNumber ? `PQS: ${row.catalogNumber}` : ""}</span>
        </div>
      ),
    },
    {
      key: "capacity",
      header: "Storage Capacity",
      visible: visibleColumns.capacity,
      render: (row: ColdChainRow) => {
        const litres = row.netStorageCapacityLiters || row.capacityLiters;
        return (
          <div className="flex items-center gap-1">
            <Thermometer className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium">{litres ? `${litres} L` : "—"}</span>
          </div>
        );
      },
    },
    {
      key: "condition",
      header: "Condition",
      visible: visibleColumns.condition,
      render: (row: ColdChainRow) => {
        const conf = CONDITION_CONFIG[row.condition] || { label: row.condition, variant: "outline", colorClass: "" };
        return (
          <Badge variant={conf.variant} className={`font-medium border ${conf.colorClass}`}>
            {conf.label}
          </Badge>
        );
      },
    },
    {
      key: "power",
      header: "Power Source",
      visible: visibleColumns.power,
      render: (row: ColdChainRow) => (
        <span className="text-xs text-muted-foreground">
          {row.powerSource ? POWER_SOURCE_LABELS[row.powerSource] || row.powerSource : "—"}
        </span>
      ),
    },
    {
      key: "lastService",
      header: "Last Service",
      visible: visibleColumns.lastService,
      render: (row: ColdChainRow) => (
        <span className="text-xs text-muted-foreground font-mono">
          {row.lastServiceDate || "Never logged"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      visible: visibleColumns.actions,
      render: (row: ColdChainRow) => (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            title="Edit Equipment"
            onClick={() => setEditingItem(row)}
          >
            <Wrench className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            title="Delete Equipment"
            onClick={() => {
              if (window.confirm(`Are you sure you want to remove ${row.brand || ""} ${row.model || "this equipment"}?`)) {
                deleteMutation.mutate(row);
              }
            }}
          >
            <AlertTriangle className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* ── HEADER & ACTIONS ────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Snowflake className="h-6 w-6 text-primary" />
            Cold Chain Equipment Inventory
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            WHO EIR-compatible inventory management, capacity sizing, service tracking, and IGA exports.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="csv-cce-import"
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleImportCSVChange}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadTemplate}
            className="gap-1.5"
            title="Download cold chain equipment CSV template"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Template
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleImportCSVClick}
            disabled={isImporting}
            className="gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
            title="Import Cold Chain equipment from CSV"
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>Importing...</span>
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                <span>Import CSV</span>
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button size="sm" onClick={() => setIsAddDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Equipment
          </Button>
        </div>
      </div>

      {/* ── ANALYTICS KPI CARDS (Rule 25) ────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total CCE Inventory</CardTitle>
            <Snowflake className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Active registered equipment units
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Functional Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {metrics.functionalRate}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.functionalCount} of {metrics.total} units fully operational
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Net Storage Volume</CardTitle>
            <Thermometer className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalStorageLitres.toLocaleString()} L</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total cold storage capacity in Litres
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Maintenance Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {metrics.needsRepairCount + metrics.nonFunctionalCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.needsRepairCount} need repair • {metrics.nonFunctionalCount} non-functional
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── CONTROLS & FILTER BAR ────────────────────────────────────── */}
      <Card className="p-4 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* SEARCH BAR */}
          <div className="relative flex-1 min-w-[280px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by facility name, brand, model, serial #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* COLUMN MANAGEMENT & RESET */}
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <SlidersHorizontal className="h-4 w-4" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Toggle Column Visibility</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {Object.keys(visibleColumns).map((colKey) => (
                  <DropdownMenuCheckboxItem
                    key={colKey}
                    checked={visibleColumns[colKey]}
                    onCheckedChange={(checked) =>
                      setVisibleColumns((prev) => ({ ...prev, [colKey]: !!checked }))
                    }
                  >
                    {colKey.charAt(0).toUpperCase() + colKey.slice(1)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={handleResetFilters} className="text-xs text-muted-foreground">
                Reset Filters
              </Button>
            )}
          </div>
        </div>

        {/* MULTI-DROPDOWN FILTERS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2 border-t">
          {/* PROVINCE */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase">Province</label>
            <Select value={selectedProvinceId} onValueChange={(val) => { setSelectedProvinceId(val); setSelectedDistrictId("all"); }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Provinces" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Provinces</SelectItem>
                {provinces.map((p: any) => (
                  <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* DISTRICT */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
              District
              {(!selectedProvinceId || selectedProvinceId === "all") && (
                <Lock className="h-2.5 w-2.5 opacity-60 text-muted-foreground" />
              )}
            </label>
            <Select
              value={selectedDistrictId}
              onValueChange={setSelectedDistrictId}
              disabled={!selectedProvinceId || selectedProvinceId === "all"}
            >
              <SelectTrigger className="h-8 text-xs" disabled={!selectedProvinceId || selectedProvinceId === "all"}>
                <SelectValue placeholder={!selectedProvinceId || selectedProvinceId === "all" ? "Select Province first" : "All Districts"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Districts</SelectItem>
                {filteredDistricts.map((d: any) => (
                  <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* EQUIPMENT TYPE */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase">Type</label>
            <Select value={selectedEquipmentType} onValueChange={setSelectedEquipmentType}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(EQUIPMENT_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* CONDITION */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase">Condition</label>
            <Select value={selectedCondition} onValueChange={setSelectedCondition}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Conditions" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Conditions</SelectItem>
                {Object.entries(CONDITION_CONFIG).map(([key, conf]) => (
                  <SelectItem key={key} value={key}>{conf.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* POWER SOURCE */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase">Power Source</label>
            <Select value={selectedPowerSource} onValueChange={setSelectedPowerSource}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Power Sources" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Power Sources</SelectItem>
                {Object.entries(POWER_SOURCE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* ── ENTERPRISE TABLE (Rule 24) ────────────────────────────────── */}
      <Card className="shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
            Loading Cold Chain Inventory...
          </div>
        ) : isError ? (
          <div className="p-12 text-center text-destructive">
            <AlertTriangle className="h-6 w-6 mx-auto mb-2" />
            Failed to load equipment inventory. Please try again.
          </div>
        ) : filteredEquipment.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground space-y-3">
            <Snowflake className="h-10 w-10 mx-auto text-muted-foreground/50" />
            <h3 className="font-semibold text-base">No Equipment Found</h3>
            <p className="text-sm max-w-sm mx-auto">
              No cold chain equipment matched your filter criteria. Try clearing search terms or adding new equipment.
            </p>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={handleResetFilters}>
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-muted/50 border-b">
                <tr>
                  {columns.filter(c => c.visible).map(c => (
                    <th key={c.key} className="px-4 py-3 font-semibold text-muted-foreground">
                      {c.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredEquipment
                  .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                  .map((row) => (
                    <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                      {columns.filter(c => c.visible).map(c => (
                        <td key={c.key} className="px-4 py-3">
                          {c.render(row)}
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>

            {/* PAGINATION CONTROLS */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>Show</span>
                <Select value={pageSize.toString()} onValueChange={(val) => { setPageSize(Number(val)); setCurrentPage(1); }}>
                  <SelectTrigger className="h-7 w-16"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <span>entries per page</span>
              </div>

              <div>
                Showing {Math.min((currentPage - 1) * pageSize + 1, filteredEquipment.length)} to {Math.min(currentPage * pageSize, filteredEquipment.length)} of {filteredEquipment.length} items
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="h-7 text-xs px-2"
                >
                  Previous
                </Button>
                <span className="px-2 font-medium">Page {currentPage} of {Math.ceil(filteredEquipment.length / pageSize) || 1}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= Math.ceil(filteredEquipment.length / pageSize)}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  className="h-7 text-xs px-2"
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* ── QUICK ADD DIALOG ─────────────────────────────────────────── */}
      {isAddDialogOpen && (
        <ColdChainItemDialog
          open={isAddDialogOpen}
          onOpenChange={setIsAddDialogOpen}
          facilities={facilities}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/cold-chain"] });
          }}
        />
      )}

      {/* ── EDIT ITEM DIALOG ─────────────────────────────────────────── */}
      {editingItem && (
        <ColdChainItemDialog
          open={!!editingItem}
          item={editingItem}
          facilities={facilities}
          onOpenChange={(open) => { if (!open) setEditingItem(null); }}
          onSuccess={() => {
            setEditingItem(null);
            queryClient.invalidateQueries({ queryKey: ["/api/cold-chain"] });
          }}
        />
      )}
    </div>
  );
}

// ─── ADD/EDIT DIALOG COMPONENT ─────────────────────────────────────────────
function ColdChainItemDialog({
  open,
  onOpenChange,
  facilities,
  item,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facilities: any[];
  item?: ColdChainRow;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    facilityId: item?.facilityId ? item.facilityId.toString() : (facilities[0]?.id?.toString() || ""),
    equipmentType: item?.equipmentType || "refrigerator",
    brand: item?.brand || "",
    model: item?.model || "",
    serialNumber: item?.serialNumber || "",
    catalogNumber: item?.catalogNumber || "",
    capacityLiters: item?.capacityLiters || "",
    netStorageCapacityLiters: item?.netStorageCapacityLiters || "",
    powerSource: item?.powerSource || "electric",
    condition: item?.condition || "functional",
    lastServiceDate: item?.lastServiceDate || "",
    notes: item?.notes || "",
  });

  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.facilityId) {
      toast({ variant: "destructive", title: "Required Field", description: "Please select a health facility." });
      return;
    }

    setSaving(true);
    try {
      const facilityId = Number(formData.facilityId);
      const url = item
        ? `/api/facilities/${facilityId}/cold-chain/${item.id}`
        : `/api/facilities/${facilityId}/cold-chain`;

      const res = await fetch(url, {
        method: item ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to save equipment");
      }

      toast({ title: "Saved", description: "Cold chain equipment updated successfully." });
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error Saving", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>{item ? "Edit Cold Chain Equipment" : "Add Cold Chain Equipment"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {!item && (
            <div className="space-y-1">
              <label className="text-xs font-semibold">Health Facility</label>
              <Select
                value={formData.facilityId}
                onValueChange={(val) => setFormData((prev) => ({ ...prev, facilityId: val }))}
              >
                <SelectTrigger><SelectValue placeholder="Select facility..." /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {facilities.map((f: any) => (
                    <SelectItem key={f.id} value={f.id.toString()}>
                      {f.name} ({f.code || `#${f.id}`})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Equipment Type</label>
              <Select
                value={formData.equipmentType}
                onValueChange={(val: EquipmentType) => setFormData((prev) => ({ ...prev, equipmentType: val }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(EQUIPMENT_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold">Condition</label>
              <Select
                value={formData.condition}
                onValueChange={(val: Condition) => setFormData((prev) => ({ ...prev, condition: val }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CONDITION_CONFIG).map(([key, conf]) => (
                    <SelectItem key={key} value={key}>{conf.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Brand / Manufacturer</label>
              <Input
                placeholder="e.g. Dometic, B Medical"
                value={formData.brand}
                onChange={(e) => setFormData((prev) => ({ ...prev, brand: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Model Name / Number</label>
              <Input
                placeholder="e.g. TCW 2000"
                value={formData.model}
                onChange={(e) => setFormData((prev) => ({ ...prev, model: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Serial Number</label>
              <Input
                placeholder="e.g. SN-889123"
                value={formData.serialNumber}
                onChange={(e) => setFormData((prev) => ({ ...prev, serialNumber: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">WHO PQS Catalog #</label>
              <Input
                placeholder="e.g. E003/024"
                value={formData.catalogNumber}
                onChange={(e) => setFormData((prev) => ({ ...prev, catalogNumber: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Net Capacity (L)</label>
              <Input
                type="number"
                placeholder="120"
                value={formData.netStorageCapacityLiters}
                onChange={(e) => setFormData((prev) => ({ ...prev, netStorageCapacityLiters: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Power Source</label>
              <Select
                value={formData.powerSource}
                onValueChange={(val: PowerSource) => setFormData((prev) => ({ ...prev, powerSource: val }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(POWER_SOURCE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Last Service</label>
              <Input
                type="date"
                value={formData.lastServiceDate}
                onChange={(e) => setFormData((prev) => ({ ...prev, lastServiceDate: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter className="pt-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Equipment"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
