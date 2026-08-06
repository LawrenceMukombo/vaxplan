import { useState, useMemo, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { loadActiveTenant } from "@/lib/tenantCache";
import type { Province, District, Village } from "@shared/schema";
import { GeoCascadeFilter } from "@/components/GeoCascadeFilter";
import { buildGeoMaps } from "@/lib/geoHierarchy";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";

import {
  Package,
  Plus,
  Trash2,
  Calendar,
  Layers,
  ClipboardList,
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCircle,
  FileText,
  User,
  ShieldAlert,
  Filter,
  Eye,
  Download,
  FileSpreadsheet,
  FileJson,
  Snowflake,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem
} from "@/components/ui/dropdown-menu";
import {
  insertStockTransactionSchema,
  insertMonthlyReportSchema,
  type StockTransaction,
  type MonthlyReport,
  type VaccineConfig,
  type Facility,
  type Client,
  type ClientVaccination,
} from "@shared/schema";
import { z } from "zod";
import { normalizeStockVaccineName } from "@shared/vaccineSchedule";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { offlineDb, enqueueOutbox } from "@/lib/offlineDb";
import {
  classifyWastage,
  getWastageThreshold,
  wastageChipClasses,
} from "@/lib/wastageThresholds";
import { useWastageThresholds } from "@/hooks/useWastageThresholds";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  computeAntigenStatus,
  computeNearExpiryReceipts,
  computeTransferSuggestions,
  getExpiryStatus,
  loadStockThreshold,
  saveStockThreshold,
  DEFAULT_MONTHS_OF_STOCK_THRESHOLD,
  type TransferSuggestion,
} from "@/lib/stockAlerts";

const transactionFormSchema = z.object({
  facilityId: z.number({ required_error: "Pick a facility" }),
  productId: z.number({ required_error: "Product is required" }),
  vaccineName: z.string().optional(),
  transactionType: z.enum(["receipt", "issue", "loss", "adjustment"]),
  quantityDoses: z.number().min(1, "Quantity must be at least 1 dose"),
  batchNumber: z.string().min(1, "Batch number is required"),
  expiryDate: z.string().min(1, "Expiry date is required"),
  vvmStatus: z.number().min(1).max(4),
  supplierOrRecipient: z.string().min(1, "Supplier/Recipient name is required"),
  notes: z.string().optional(),
  productCode: z.string().optional().nullable(),
});

type TransactionFormValues = z.infer<typeof transactionFormSchema>;
type CatalogueWastageThreshold = {
  vaccineId?: number | string | null;
  wastageRate?: number | string | null;
};

const STANDARD_WASTAGE_RATE_BY_PRODUCT: Record<string, number> = {
  BCG: 50,
  OPV: 15,
  IPV: 10,
  PENTA: 10,
  PCV: 5,
  ROTAVIRUS: 5,
  ROTA: 5,
  MR: 30,
  MEASLESRUBELLA: 30,
  TT: 10,
  TD: 10,
  TTTD: 10,
  HPV: 5,
  COVID19: 10,
  COVID19VACCINE: 10,
  YELLOWFEVER: 30,
  MENINGITIS: 30,
  MENINGITISVACCINE: 30,
  MALARIA: 10,
  DENGUE: 10,
  CHOLERA: 5,
  TCV: 10,
  TYPHOIDCONJUGATEVACCINE: 10,
  MPOX: 5,
};

function toFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function compactVaccineKey(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function getStandardWastageRate(productName?: string | null): number | null {
  if (!productName) return null;
  const normalized = normalizeStockVaccineName(productName);
  const keys = [compactVaccineKey(normalized), compactVaccineKey(productName)];

  for (const key of keys) {
    if (STANDARD_WASTAGE_RATE_BY_PRODUCT[key] !== undefined) {
      return STANDARD_WASTAGE_RATE_BY_PRODUCT[key];
    }
    if (key.includes("YELLOWFEVER")) return STANDARD_WASTAGE_RATE_BY_PRODUCT.YELLOWFEVER;
    if (key.includes("MENINGITIS")) return STANDARD_WASTAGE_RATE_BY_PRODUCT.MENINGITISVACCINE;
    if (key.includes("COVID19")) return STANDARD_WASTAGE_RATE_BY_PRODUCT.COVID19VACCINE;
    if (key.includes("TYPHOID")) return STANDARD_WASTAGE_RATE_BY_PRODUCT.TYPHOIDCONJUGATEVACCINE;
  }

  return null;
}

function resolveDisplayWastageRate(
  config: any | undefined,
  thresholds: CatalogueWastageThreshold[],
  productName: string,
): number {
  const thresholdRate = thresholds
    .filter((entry) => config?.id !== undefined && Number(entry.vaccineId) === Number(config.id))
    .map((entry) => toFiniteNumber(entry.wastageRate))
    .find((rate): rate is number => rate !== null);

  if (thresholdRate !== undefined) return thresholdRate;

  const standardRate = getStandardWastageRate(config?.name ?? productName);
  const legacyCatalogueRate = toFiniteNumber(config?.wastageThreshold);

  // Older catalogue rows may have the legacy default of 10.00 for every vaccine.
  // Prefer product standards in that case so BCG, OPV, PCV, MR, etc. do not all look identical.
  if (standardRate !== null && (legacyCatalogueRate === null || legacyCatalogueRate === 10)) {
    return standardRate;
  }

  return legacyCatalogueRate ?? standardRate ?? 10;
}

export function getProductCategoryGroup(product: { name: string; category: string }): {
  groupId: "vaccine" | "diluent" | "syringe" | "ppe" | "tally_sheet" | "cold_chain";
  groupLabel: string;
  icon: string;
} {
  const name = (product.name || "").toLowerCase();
  const cat = (product.category || "").toLowerCase();

  // 1. Tally Sheets & Administrative Tools
  if (
    cat === "recording_tools" ||
    cat === "stationaries" ||
    name.includes("tally") ||
    name.includes("vaccination card") ||
    name.includes("immunization card") ||
    name.includes("hbr") ||
    name.includes("register book") ||
    name.includes("aefi form") ||
    name.includes("reporting form")
  ) {
    return { groupId: "tally_sheet", groupLabel: "Session Tally Sheets & Administrative Tools", icon: "📋" };
  }

  // 2. Cold Chain Equipment & Storage Supplies
  if (
    cat === "cold_chain" ||
    cat === "cce" ||
    name.includes("vaccine carrier") ||
    name.includes("ice pack") ||
    name.includes("foam pad") ||
    name.includes("cold box") ||
    name.includes("refrigerator") ||
    name.includes("freezer") ||
    name.includes("sdd") ||
    name.includes("fridge-tag") ||
    name.includes("temperature logger")
  ) {
    return { groupId: "cold_chain", groupLabel: "Cold Chain Equipment & Storage Supplies", icon: "❄️" };
  }

  // 3. Vaccines & Biologicals
  if (cat === "vaccine" || cat === "biological") {
    return { groupId: "vaccine", groupLabel: "Vaccines & Biologicals", icon: "💉" };
  }

  // 4. Diluents
  if (cat === "diluent" || name.includes("diluent")) {
    return { groupId: "diluent", groupLabel: "Vaccine Diluents", icon: "💧" };
  }

  // 5. Syringes & Injection Equipment
  if (
    cat === "syringe" ||
    cat === "safety_box" ||
    name.includes("syringe") ||
    name.includes("auto-disable") ||
    name.includes("reconstitution") ||
    name.includes("safety box")
  ) {
    return { groupId: "syringe", groupLabel: "Syringes & Injection Equipment", icon: "💉" };
  }

  // 6. PPE & Medical Consumables
  if (
    cat === "ppe" ||
    name.includes("gloves") ||
    name.includes("mask") ||
    name.includes("sanitizer") ||
    name.includes("cotton wool") ||
    name.includes("swab")
  ) {
    return { groupId: "ppe", groupLabel: "PPE & Medical Consumables", icon: "🛡️" };
  }

  return { groupId: "tally_sheet", groupLabel: "Other Session Supplies", icon: "📦" };
}

export default function StockLedger() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { thresholds: wastageThresholds } = useWastageThresholds();
  const [activeTab, setActiveTab] = useState("ledger");
  const [selectedFacilityId, setSelectedFacilityId] = useState<number | null>(null);
  const [geoProvinceId, setGeoProvinceId] = useState<number | null>(null);
  const [geoDistrictId, setGeoDistrictId] = useState<number | null>(null);

  // Advanced Filters States
  const [filterBatchNumber, setFilterBatchNumber] = useState<string>("");
  const [filterTransactionType, setFilterTransactionType] = useState<string>("all");
  const [filterVvmStatus, setFilterVvmStatus] = useState<string>("all");
  const [filterExpiryStart, setFilterExpiryStart] = useState<string>("");
  const [filterExpiryEnd, setFilterExpiryEnd] = useState<string>("");
  const [filterTxnStart, setFilterTxnStart] = useState<string>("");
  const [filterTxnEnd, setFilterTxnEnd] = useState<string>("");
  const [filterStockStatus, setFilterStockStatus] = useState<string>("all");
  const [filterUser, setFilterUser] = useState<string>("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);

  // Sorting States
  const [sortField, setSortField] = useState<string>("transactionDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Pagination States
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Column Visibility States
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    date: true,
    province: true,
    district: true,
    product: true,
    type: true,
    quantity: true,
    batch: true,
    expiry: true,
    vvm: true,
    recipient: true,
    balance: true,
    actions: true,
  });

  // Selected Transaction details for Dialog
  const [selectedTxnDetails, setSelectedTxnDetails] = useState<any | null>(null);
  
  // Dialog Open States
  const [txnDialogOpen, setTxnDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);

  // Wizard Steps for Monthly Report
  const [wizardStep, setWizardStep] = useState(1);

  // URL State for Product Filter
  const [location, setLocation] = useLocation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const selectedProductIdParam = searchParams.get("productId");
  const selectedProductId = selectedProductIdParam ? parseInt(selectedProductIdParam) : null;

  const updateProductIdInUrl = (id: number | null) => {
    const params = new URLSearchParams(searchString);
    if (id !== null) {
      params.set("productId", id.toString());
    } else {
      params.delete("productId");
    }
    setLocation(`${location}?${params.toString()}`);
  };

  // Configurable months-of-stock threshold for low-stock warnings
  const [mosThreshold, setMosThreshold] = useState<number>(() => loadStockThreshold());
  useEffect(() => {
    saveStockThreshold(mosThreshold);
  }, [mosThreshold]);

  const { data: provinces = [] } = useQuery<Province[]>({ queryKey: ["/api/provinces"] });
  const { data: districts = [] } = useQuery<District[]>({ queryKey: ["/api/districts"] });

  // Load facilities for drop-down or pre-fill
  const { data: facilities } = useQuery<Facility[]>({
    queryKey: ["/api/facilities"],
    queryFn: async () => {
      if (!navigator.onLine) {
        const _tid = loadActiveTenant()?.id;
        return (_tid
          ? offlineDb.facilities.where("tenantId").equals(_tid).toArray()
          : offlineDb.facilities.toArray()) as unknown as Facility[];
      }
      const res = await fetch("/api/facilities");
      if (!res.ok) throw new Error("Failed to load facilities");
      return res.json();
    },
  });

  // Load vaccine configurations from Country Catalogue
  const { data: vaccineConfigs = [], isLoading: isLoadingConfigs } = useQuery<any[]>({
    queryKey: ["/api/catalogue/vaccines", "activeOnly"],
    queryFn: async () => {
      // Return physical stock-managed catalogue products
      const res = await fetch("/api/catalogue/vaccines?activeOnly=true");
      if (!res.ok) throw new Error("Failed to fetch catalogue vaccines");
      const list = await res.json();
      return Array.isArray(list) ? list.filter((v: any) => v.active !== false) : [];
    },
  });

  // Load non-vaccine commodities from Country Catalogue
  const { data: catalogueCommodities = [] } = useQuery<any[]>({
    queryKey: ["/api/catalogue/commodities", "activeOnly"],
    queryFn: async () => {
      const res = await fetch("/api/catalogue/commodities?activeOnly=true");
      if (!res.ok) return [];
      const list = await res.json();
      return Array.isArray(list) ? list.filter((c: any) => c.active !== false) : [];
    },
  });

  // Combine vaccineConfigs + catalogueCommodities into unified products list
  const allCatalogueProducts = useMemo(() => {
    const vaxItems = (vaccineConfigs || []).map((v: any) => ({
      id: v.id,
      name: v.name,
      category: "vaccine",
      dosesPerVial: v.dosesPerVial || 10,
      vvmType: v.vvmType || "Type 30",
      code: v.productId || v.name,
      stockManaged: true,
      active: true,
    }));

    const commItems = (catalogueCommodities || []).map((c: any) => ({
      id: 10000 + c.id,
      name: c.name,
      category: c.type || "commodity",
      dosesPerVial: c.packSize || 1,
      vvmType: "N/A",
      code: c.commodityCode || c.name,
      stockManaged: true,
      active: true,
    }));

    return [...vaxItems, ...commItems];
  }, [vaccineConfigs, catalogueCommodities]);

  const groupedCatalogueProducts = useMemo(() => {
    const map = new Map<
      string,
      { groupId: string; groupLabel: string; icon: string; items: typeof allCatalogueProducts }
    >();

    const order = ["vaccine", "diluent", "syringe", "ppe", "tally_sheet", "cold_chain"];

    allCatalogueProducts.forEach((p) => {
      const meta = getProductCategoryGroup(p);
      if (!map.has(meta.groupId)) {
        map.set(meta.groupId, {
          groupId: meta.groupId,
          groupLabel: meta.groupLabel,
          icon: meta.icon,
          items: [],
        });
      }
      map.get(meta.groupId)!.items.push(p);
    });

    return Array.from(map.values()).sort(
      (a, b) => order.indexOf(a.groupId) - order.indexOf(b.groupId)
    );
  }, [allCatalogueProducts]);

  const { data: facilityColdChainEquipment = [] } = useQuery<any[]>({
    queryKey: ["/api/cold-chain", selectedFacilityId],
    queryFn: async () => {
      if (!selectedFacilityId) return [];
      const res = await fetch(`/api/cold-chain?facilityId=${selectedFacilityId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedFacilityId,
  });

  const { data: catalogueWastageThresholds = [] } = useQuery<CatalogueWastageThreshold[]>({
    queryKey: ["/api/catalogue/wastage-thresholds", "activeOnly"],
    queryFn: async () => {
      const res = await fetch("/api/catalogue/wastage-thresholds?activeOnly=true");
      if (!res.ok) return [];
      const list = await res.json();
      return Array.isArray(list) ? list.filter((w: any) => w.active !== false) : [];
    },
  });
  // Pre-fill user facility context
  useEffect(() => {
    if (user?.facilityId) {
      setSelectedFacilityId(user.facilityId);
    } else if (facilities && facilities.length > 0 && !selectedFacilityId) {
      setSelectedFacilityId(facilities[0].id);
    }
  }, [user, facilities]);

  const geoMaps = useMemo(
    () => buildGeoMaps({ provinces, districts, villages: [] as Village[], facilities: facilities ?? [] }),
    [provinces, districts, facilities],
  );

  const facilityGeo = useMemo(() => {
    if (!selectedFacilityId) return { provinceName: null as string | null, districtName: null as string | null, facilityName: null as string | null };
    const fac = geoMaps.facilityMap.get(selectedFacilityId);
    if (!fac) return { provinceName: null, districtName: null, facilityName: null };
    const dist = fac.districtId ? geoMaps.districtMap.get(fac.districtId) : null;
    const prov = dist?.provinceId ? geoMaps.provinceMap.get(dist.provinceId) : null;
    return {
      provinceName: prov?.name ?? null,
      districtName: dist?.name ?? null,
      facilityName: fac.name ?? null,
    };
  }, [selectedFacilityId, geoMaps]);

  // Load Stock Ledger Transactions (server and client filter by cascade)
  const { data: allTransactions, isLoading: loadingTxns } = useQuery<StockTransaction[]>({
    queryKey: [`/api/stock/ledger`, { provinceId: geoProvinceId, districtId: geoDistrictId, facilityId: selectedFacilityId, productId: selectedProductId }],
    queryFn: async () => {
      if (!navigator.onLine) {
        const _tid = loadActiveTenant()?.id;
        let localTxns = _tid
          ? await offlineDb.stockTransactions.where("tenantId").equals(_tid).toArray()
          : await offlineDb.stockTransactions.toArray();
        return (localTxns as unknown as StockTransaction[]).sort(
          (a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime()
        );
      }
      const params = new URLSearchParams();
      if (geoProvinceId) params.append("provinceId", geoProvinceId.toString());
      if (geoDistrictId) params.append("districtId", geoDistrictId.toString());
      if (selectedFacilityId) params.append("facilityId", selectedFacilityId.toString());
      if (selectedProductId) params.append("productId", selectedProductId.toString());
      
      const res = await fetch(`/api/stock/ledger?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load stock ledger");
      return res.json();
    },
  });

  // Load Monthly Reports (server and client filter by cascade)
  const { data: allReports, isLoading: loadingReports } = useQuery<MonthlyReport[]>({
    queryKey: [`/api/monthly-reports`, { provinceId: geoProvinceId, districtId: geoDistrictId, facilityId: selectedFacilityId }],
    queryFn: async () => {
      if (!navigator.onLine) {
        const _tid = loadActiveTenant()?.id;
        const localReports = _tid
          ? await offlineDb.monthlyReports.where("tenantId").equals(_tid).toArray()
          : await offlineDb.monthlyReports.toArray();
        return localReports as unknown as MonthlyReport[];
      }
      const params = new URLSearchParams();
      if (geoProvinceId) params.append("provinceId", geoProvinceId.toString());
      if (geoDistrictId) params.append("districtId", geoDistrictId.toString());
      if (selectedFacilityId) params.append("facilityId", selectedFacilityId.toString());

      const res = await fetch(`/api/monthly-reports?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load monthly reports");
      return res.json();
    },
  });

  const resolveRowGeo = (facilityId: number | null | undefined) => {
    if (!facilityId) return { provinceName: null as string | null, districtName: null as string | null, provinceId: null as number | null, districtId: null as number | null };
    const fac = geoMaps.facilityMap.get(Number(facilityId));
    if (!fac) return { provinceName: null, districtName: null, provinceId: null, districtId: null };
    const dist = fac.districtId ? geoMaps.districtMap.get(fac.districtId) : null;
    const prov = dist?.provinceId ? geoMaps.provinceMap.get(dist.provinceId) : null;
    return {
      provinceName: prov?.name ?? null,
      districtName: dist?.name ?? null,
      provinceId: prov?.id ?? null,
      districtId: dist?.id ?? null,
    };
  };

  const baseFilteredTransactions = useMemo(() => {
    let list = allTransactions ?? [];
    
    // Sort transactions chronologically to calculate running balances
    const sortedChronological = [...list].sort(
      (a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
    );

    const productBalances = new Map<string, number>();
    const listWithRunningBalance = sortedChronological.map((tx: any) => {
      const key = `${tx.facilityId}::${tx.productId}`;
      let bal = productBalances.get(key) || 0;
      const qty = tx.quantityDoses;
      const type = tx.transactionType.toLowerCase();
      if (["receipt", "adjustment"].includes(type)) {
        bal += qty;
      } else if (["issue", "loss", "administered", "wasted", "expired", "transfer", "transfer_out"].includes(type)) {
        bal -= qty;
      }
      productBalances.set(key, bal);
      return { ...tx, runningBalance: bal };
    });

    let filtered = listWithRunningBalance.sort(
      (a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime()
    );

    return filtered.filter((tx: any) => {
      const g = resolveRowGeo(tx.facilityId);
      if (geoProvinceId !== null && g.provinceId !== geoProvinceId) return false;
      if (geoDistrictId !== null && g.districtId !== geoDistrictId) return false;
      if (selectedFacilityId !== null && Number(tx.facilityId) !== selectedFacilityId) return false;
      if (selectedProductId !== null && tx.productId !== selectedProductId) return false;
      
      if (filterBatchNumber && !tx.batchNumber.toLowerCase().includes(filterBatchNumber.toLowerCase())) return false;
      if (filterTransactionType !== "all" && tx.transactionType !== filterTransactionType) return false;
      if (filterVvmStatus !== "all" && String(tx.vvmStatus) !== filterVvmStatus) return false;
      if (filterUser && !tx.recordedByUserId?.toLowerCase().includes(filterUser.toLowerCase())) return false;
      
      if (filterExpiryStart && new Date(tx.expiryDate) < new Date(filterExpiryStart)) return false;
      if (filterExpiryEnd && new Date(tx.expiryDate) > new Date(filterExpiryEnd)) return false;
      if (filterTxnStart && new Date(tx.transactionDate) < new Date(filterTxnStart)) return false;
      if (filterTxnEnd && new Date(tx.transactionDate) > new Date(filterTxnEnd)) return false;

      return true;
    });
  }, [allTransactions, geoMaps, geoProvinceId, geoDistrictId, selectedFacilityId, selectedProductId, filterBatchNumber, filterTransactionType, filterVvmStatus, filterExpiryStart, filterExpiryEnd, filterTxnStart, filterTxnEnd, filterUser]);

  // Derived antigen status computed from baseFilteredTransactions
  const antigenStatus = useMemo(
    () => computeAntigenStatus(baseFilteredTransactions ?? [], vaccineConfigs, mosThreshold),
    [baseFilteredTransactions, vaccineConfigs, mosThreshold],
  );

  const antigenStatusByName = useMemo(() => {
    const map = new Map<string, any>();
    for (const s of antigenStatus) map.set(s.antigen, s);
    return map;
  }, [antigenStatus]);

  // Finally filter by Stock Status using antigenStatusByName
  const transactions = useMemo(() => {
    const list = baseFilteredTransactions ?? [];
    if (filterStockStatus === "all") return list;
    return list.filter((tx: any) => {
      const normName = normalizeStockVaccineName(tx.vaccineName || "");
      const status = antigenStatusByName.get(normName);
      if (filterStockStatus === "low" && !status?.isLowStock) return false;
      if (filterStockStatus === "stockout" && !status?.isOutOfStock) return false;
      if (filterStockStatus === "negative" && (tx.runningBalance ?? 0) < 0) return false;
      if (filterStockStatus === "expired") {
        const { status: expStatus } = getExpiryStatus(tx.expiryDate);
        if (expStatus !== "expired") return false;
      }
      if (filterStockStatus === "near_expiry") {
        const { status: expStatus } = getExpiryStatus(tx.expiryDate);
        if (expStatus !== "expiring-30" && expStatus !== "expiring-60") return false;
      }
      return true;
    });
  }, [baseFilteredTransactions, filterStockStatus, antigenStatusByName]);

  // Derived lists for Sorting & Pagination
  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => {
      let valA: any = a[sortField as keyof typeof a];
      let valB: any = b[sortField as keyof typeof b];
      if (sortField === "transactionDate" || sortField === "expiryDate") {
        valA = new Date(valA || 0).getTime();
        valB = new Date(valB || 0).getTime();
      } else if (sortField === "runningBalance") {
        valA = valA || 0;
        valB = valB || 0;
      } else if (typeof valA === "string") {
        valA = valA.toLowerCase();
        valB = (valB || "").toLowerCase();
      }
      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [transactions, sortField, sortDirection]);

  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedTransactions.slice(startIndex, startIndex + pageSize);
  }, [sortedTransactions, currentPage, pageSize]);

  // Reset pagination when page configuration changes
  useEffect(() => {
    setCurrentPage(1);
  }, [transactions.length, pageSize]);

  const handleExport = (format: "csv" | "xlsx" | "json" | "pdf") => {
    const exportData = sortedTransactions.map(tx => {
      const g = resolveRowGeo(tx.facilityId);
      return {
        Date: new Date(tx.transactionDate).toLocaleString(),
        Province: g.provinceName || "",
        District: g.districtName || "",
        Product: tx.vaccineName || "",
        Type: tx.transactionType,
        Quantity: tx.quantityDoses,
        Batch: tx.batchNumber,
        Expiry: new Date(tx.expiryDate).toLocaleDateString(),
        VVM: tx.vvmStatus,
        Recipient: tx.supplierOrRecipient || "",
        Balance: tx.runningBalance || 0,
      };
    });

    if (format === "json") {
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `stock_ledger_${Date.now()}.json`;
      a.click();
    } else if (format === "csv") {
      const headers = Object.keys(exportData[0] || {});
      const csvRows = [
        headers.join(","),
        ...exportData.map(row => headers.map(h => `"${String(row[h as keyof typeof row]).replace(/"/g, '""')}"`).join(","))
      ];
      const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `stock_ledger_${Date.now()}.csv`;
      a.click();
    } else if (format === "xlsx") {
      const headers = Object.keys(exportData[0] || {});
      const csvRows = [
        headers.join(","),
        ...exportData.map(row => headers.map(h => `"${String(row[h as keyof typeof row]).replace(/"/g, '""')}"`).join(","))
      ];
      const blob = new Blob([csvRows.join("\n")], { type: "application/vnd.ms-excel" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `stock_ledger_${Date.now()}.xlsx`;
      a.click();
    } else if (format === "pdf") {
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Stock Ledger Report</title>
              <style>
                body { font-family: sans-serif; padding: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
                th { background-color: #f2f2f2; }
                h1 { font-size: 18px; }
              </style>
            </head>
            <body>
              <h1>Stock Ledger Report - ${new Date().toLocaleDateString()}</h1>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Product</th>
                    <th>Type</th>
                    <th>Qty</th>
                    <th>Batch</th>
                    <th>Expiry</th>
                    <th>VVM</th>
                    <th>Recipient</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  ${exportData.map(row => `
                    <tr>
                      <td>${row.Date}</td>
                      <td>${row.Product}</td>
                      <td>${row.Type}</td>
                      <td>${row.Quantity}</td>
                      <td>${row.Batch}</td>
                      <td>${row.Expiry}</td>
                      <td>${row.VVM}</td>
                      <td>${row.Recipient}</td>
                      <td>${row.Balance}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
              <script>window.print();</script>
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    }
  };

  const reports = useMemo(() => {
    const list = allReports ?? [];
    return list.filter((rep) => {
      const g = resolveRowGeo(rep.facilityId);
      if (geoProvinceId !== null && g.provinceId !== geoProvinceId) return false;
      if (geoDistrictId !== null && g.districtId !== geoDistrictId) return false;
      if (selectedFacilityId !== null && Number(rep.facilityId) !== selectedFacilityId) return false;
      return true;
    });
  }, [allReports, geoMaps, geoProvinceId, geoDistrictId, selectedFacilityId]);

  // Load clients and vaccinations for monthly report aggregation
  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients", { facilityId: selectedFacilityId }],
    queryFn: async () => {
      if (!selectedFacilityId) return [];
      if (!navigator.onLine) {
        return (await offlineDb.clients
          .where("facilityId")
          .equals(selectedFacilityId)
          .toArray()) as unknown as Client[];
      }
      const res = await fetch(`/api/clients?facilityId=${selectedFacilityId}`);
      if (!res.ok) throw new Error("Failed to load clients");
      return res.json();
    },
    enabled: !!selectedFacilityId && reportDialogOpen,
  });



  // Per-transaction expiry highlighting (only meaningful for receipts with remaining batch stock)
  const nearExpiry = useMemo(
    () => computeNearExpiryReceipts(transactions ?? []),
    [transactions],
  );
  const nearExpiryByTxId = useMemo(() => {
    const map = new Map<number, typeof nearExpiry[number]>();
    for (const e of nearExpiry) map.set(e.transactionId, e as any);
    return map;
  }, [nearExpiry]);

  const lowStockCount = antigenStatus.filter((s: any) => s.isLowStock).length;
  const nearExpiryCount = nearExpiry.length;

  const evmKpis = useMemo(() => {
    const rows = transactions ?? [];
    const antigens = new Set(rows.map((tx: any) => normalizeStockVaccineName(tx.vaccineName || "Unknown")));
    const lossRows = rows.filter((tx: any) => tx.transactionType === "loss");
    const notes = rows.map((tx: any) => `${tx.notes || ""} ${tx.reason || ""}`.toLowerCase());
    const openVialLoss = lossRows.filter((tx: any) => /open|opened|partial/.test(`${tx.notes || ""} ${tx.reason || ""}`.toLowerCase()));
    const closedVialLoss = lossRows.filter((tx: any) => /closed|break|damage|expired|vvm/.test(`${tx.notes || ""} ${tx.reason || ""}`.toLowerCase()));
    const excursionCount = notes.filter((n: any) => /temperature|excursion|freeze|heat|2-8|cold chain/.test(n)).length;
    const traceableRows = rows.filter((tx: any) => tx.batchNumber && tx.expiryDate);
    return {
      stockoutDays: antigenStatus.filter((s: any) => s.isOutOfStock).length * 30,
      openVialWastage: openVialLoss.reduce((sum: number, tx: any) => sum + Number(tx.quantityDoses || 0), 0),
      closedVialWastage: closedVialLoss.reduce((sum: number, tx: any) => sum + Number(tx.quantityDoses || 0), 0),
      temperatureExcursionRate: rows.length ? Math.round((excursionCount / rows.length) * 100) : 0,
      capacityUtilization: null as number | null,
      maintenanceOverdue: null as number | null,
      expiryRisk: nearExpiry.length,
      lotTraceability: rows.length ? Math.round((traceableRows.length / rows.length) * 100) : 100,
      antigenCount: antigens.size,
    };
  }, [transactions, antigenStatus, nearExpiry]);

  // Cross-facility transfer suggestions — compute against the full tenant ledger
  // (so a low source facility can still receive doses), but filter the
  // displayed list to pairs touching the current geo cascade.
  const geoFilteredAllTransactions = useMemo(() => {
    const list = allTransactions ?? [];
    if (geoProvinceId === null && geoDistrictId === null) return list;
    return list.filter((tx) => {
      const g = resolveRowGeo(tx.facilityId);
      if (geoProvinceId !== null && g.provinceId !== geoProvinceId) return false;
      if (geoDistrictId !== null && g.districtId !== geoDistrictId) return false;
      return true;
    });
  }, [allTransactions, geoMaps, geoProvinceId, geoDistrictId]);

  const transferSuggestions = useMemo(
    () => computeTransferSuggestions(geoFilteredAllTransactions, vaccineConfigs, mosThreshold),
    [geoFilteredAllTransactions, vaccineConfigs, mosThreshold],
  );

  // Hide suggestions the user has already actioned this session.
  const [actionedSuggestionKeys, setActionedSuggestionKeys] = useState<Set<string>>(new Set());
  const suggestionKey = (s: TransferSuggestion) =>
    `${s.sourceFacilityId}::${s.destFacilityId}::${s.antigen}::${s.batchNumber}`;
  const visibleSuggestions = useMemo(
    () => transferSuggestions.filter((s) => !actionedSuggestionKeys.has(suggestionKey(s))),
    [transferSuggestions, actionedSuggestionKeys],
  );

  const facilityNameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const f of facilities ?? []) m.set(f.id, f.name);
    return m;
  }, [facilities]);

  const [confirmTransfer, setConfirmTransfer] = useState<TransferSuggestion | null>(null);
  const [confirmDosesInput, setConfirmDosesInput] = useState<string>("");
  const [confirmNote, setConfirmNote] = useState<string>("");

  const openConfirmTransfer = (s: TransferSuggestion) => {
    setConfirmTransfer(s);
    setConfirmDosesInput(String(s.suggestedDoses));
    setConfirmNote("");
  };
  const closeConfirmTransfer = () => {
    setConfirmTransfer(null);
    setConfirmDosesInput("");
    setConfirmNote("");
  };

  const actionTransferMutation = useMutation({
    mutationFn: async (vars: { suggestion: TransferSuggestion; doses: number; note: string }) => {
      const { suggestion: s, doses, note } = vars;
      const sourceName = facilityNameById.get(s.sourceFacilityId) ?? `Facility ${s.sourceFacilityId}`;
      const destName = facilityNameById.get(s.destFacilityId) ?? `Facility ${s.destFacilityId}`;
      const trimmedNote = note.trim();
      const reason = trimmedNote
        ? `Suggested transfer (batch near expiry) — ${trimmedNote}`
        : "Suggested transfer (batch near expiry)";
      // Atomic paired write — server records both issue and receipt in one DB
      // transaction so the ledger can't be left half-updated if anything fails.
      await apiRequest("POST", "/api/stock/transfer", {
        sourceFacilityId: s.sourceFacilityId,
        destFacilityId: s.destFacilityId,
        vaccineName: s.antigen,
        batchNumber: s.batchNumber,
        expiryDate: new Date(s.expiryDate).toISOString(),
        vvmStatus: 1,
        quantityDoses: doses,
        sourceFacilityName: sourceName,
        destFacilityName: destName,
        reason,
      });
      return { suggestion: s, doses };
    },
    onSuccess: ({ suggestion: s, doses }) => {
      setActionedSuggestionKeys((prev) => {
        const next = new Set<string>(prev);
        next.add(suggestionKey(s));
        return next;
      });
      queryClient.invalidateQueries({ queryKey: [`/api/stock/ledger`, { facilityId: null }] });
      toast({
        title: "Transfer Logged",
        description: `Issued ${doses} ${s.antigen} doses (batch ${s.batchNumber}) and recorded the matching receipt.`,
      });
      closeConfirmTransfer();
    },
    onError: (err: any) => {
      toast({
        title: "Failed to log transfer",
        description: err?.message ?? "Could not record the transfer transactions.",
        variant: "destructive",
      });
    },
  });

  const parsedConfirmDoses = Number(confirmDosesInput);
  const confirmDosesValid =
    confirmTransfer !== null &&
    Number.isFinite(parsedConfirmDoses) &&
    Number.isInteger(parsedConfirmDoses) &&
    parsedConfirmDoses > 0 &&
    parsedConfirmDoses <= confirmTransfer.sourceBatchRemaining;
  const confirmDosesError =
    confirmTransfer === null || confirmDosesInput === ""
      ? null
      : !Number.isFinite(parsedConfirmDoses) || !Number.isInteger(parsedConfirmDoses)
        ? "Enter a whole number of doses."
        : parsedConfirmDoses <= 0
          ? "Must be greater than 0."
          : parsedConfirmDoses > confirmTransfer.sourceBatchRemaining
            ? `Cannot exceed source batch remaining (${confirmTransfer.sourceBatchRemaining.toLocaleString()}).`
            : null;

  // Calculate dynamic Stock on Hand (SOH) per antigen
  const stockOnHand = useMemo(() => {
    const soh: Record<string, number> = {};
    if (!transactions) return soh;

    // Initialize with active configs using normalized names
    if (vaccineConfigs) {
      vaccineConfigs.forEach(c => {
        if (c.active && c.stockManaged) {
          const norm = normalizeStockVaccineName(c.name);
          soh[norm] = 0;
        }
      });
    }

    transactions.forEach((tx: any) => {
      const type = tx.transactionType;
      const doses = tx.quantityDoses;
      const normName = normalizeStockVaccineName(tx.vaccineName || "Unknown");
      if (!soh[normName]) soh[normName] = 0;

      if (type === "receipt" || type === "adjustment") {
        soh[normName] += doses;
      } else if (["issue", "loss", "administered", "wasted", "expired", "transfer", "transfer_out"].includes(type)) {
        soh[normName] -= doses;
      }
    });

    return soh;
  }, [transactions, vaccineConfigs]);

  // Transaction form setup
  const txnForm = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      facilityId: selectedFacilityId ?? undefined,
      productId: selectedProductId ?? undefined,
      transactionType: "receipt",
      quantityDoses: 100,
      batchNumber: "",
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      vvmStatus: 1,
      supplierOrRecipient: "",
      notes: "",
    },
  });

  const selectedProductIdValue = txnForm.watch("productId");

  const selectedProductMeta = useMemo(() => {
    if (!selectedProductIdValue) return null;
    const p = allCatalogueProducts.find((c) => c.id === selectedProductIdValue);
    if (!p) return null;
    const grp = getProductCategoryGroup(p);
    return {
      product: p,
      group: grp,
      isVaccine: grp.groupId === "vaccine",
      isDiluent: grp.groupId === "diluent",
      isSyringeOrPpe: grp.groupId === "syringe" || grp.groupId === "ppe",
      isTallySheet: grp.groupId === "tally_sheet",
      isColdChain: grp.groupId === "cold_chain",
      showBatchNumber: grp.groupId !== "tally_sheet" && grp.groupId !== "cold_chain",
      showExpiryDate: grp.groupId !== "tally_sheet" && grp.groupId !== "cold_chain",
      showVVMStatus: grp.groupId === "vaccine",
      showEquipmentPicker: grp.groupId === "cold_chain",
      quantityLabel:
        grp.groupId === "vaccine"
          ? "Quantity (Doses)"
          : grp.groupId === "diluent"
          ? "Quantity (Vials/Ampoules)"
          : grp.groupId === "tally_sheet"
          ? "Quantity (Packs/Sheets/Books)"
          : grp.groupId === "cold_chain"
          ? "Quantity (Units)"
          : "Quantity (Units/Boxes)",
    };
  }, [selectedProductIdValue, allCatalogueProducts]);

  useEffect(() => {
    if (selectedFacilityId) {
      txnForm.setValue("facilityId", selectedFacilityId);
    }
  }, [selectedFacilityId, txnForm]);

  useEffect(() => {
    if (selectedProductId && vaccineConfigs) {
      const conf = vaccineConfigs.find(c => c.id === selectedProductId);
      if (conf) {
        txnForm.setValue("vaccineName", conf.name);
        txnForm.setValue("productId", conf.id);
        txnForm.setValue("productCode", conf.code ?? null);
      }
    }
  }, [selectedProductId, vaccineConfigs, txnForm, txnDialogOpen]);

  const saveTxnMutation = useMutation({
    mutationFn: async (data: TransactionFormValues) => {
      if (!navigator.onLine) {
        // Generate a random temporary negative ID
        const newId = -Math.floor(Math.random() * 1000000);
        const localTxn = {
          id: newId,
          tenantId: user?.tenantId ?? "",
          facilityId: data.facilityId,
          productId: data.productId,
          vaccineName: vaccineConfigs?.find(c => c.id === data.productId)?.name || data.vaccineName,
          transactionType: data.transactionType,
          quantityDoses: data.quantityDoses,
          batchNumber: data.batchNumber,
          expiryDate: new Date(data.expiryDate).toISOString() as any,
          vvmStatus: data.vvmStatus,
          supplierOrRecipient: data.supplierOrRecipient,
          transactionDate: new Date().toISOString() as any,
          notes: data.notes ?? null,
          recordedByUserId: user?.id ?? null,
          _syncedAt: 0,
          _localOnly: true,
        };

        // Save locally to IndexedDB
        await offlineDb.stockTransactions.put(localTxn as any);

        // Queue to sync outbox
        await enqueueOutbox({
          tenantId: user?.tenantId ?? "",
          entityType: "stockTransaction",
          method: "POST",
          url: "/api/stock/transaction",
          body: JSON.stringify({
            ...data,
            expiryDate: new Date(data.expiryDate).toISOString(),
          }),
        });

        return localTxn;
      }

      return apiRequest("POST", "/api/stock/transaction", {
        ...data,
        expiryDate: new Date(data.expiryDate).toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/stock/ledger`, { facilityId: selectedFacilityId }] });
      setTxnDialogOpen(false);
      txnForm.reset({
        facilityId: selectedFacilityId ?? undefined,
        productId: selectedProductId ?? undefined,
        transactionType: "receipt",
        quantityDoses: 100,
        batchNumber: "",
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        vvmStatus: 1,
        supplierOrRecipient: "",
        notes: "",
      });
      toast({
        title: navigator.onLine ? "Transaction Registered" : "Transaction Queued Offline",
        description: navigator.onLine 
          ? "Your stock card transaction was successfully updated."
          : "Saved locally. Transaction will sync automatically once internet is restored.",
      });
    },
    onError: (err: any) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  const deleteTxnMutation = useMutation({
    mutationFn: async (txId: number) => {
      if (!navigator.onLine) {
        if (txId < 0) {
          // Local-only transaction: delete directly from local DB
          await offlineDb.stockTransactions.delete(txId);
        } else {
          // Sync-enabled transaction: queue deletion to outbox
          await enqueueOutbox({
            tenantId: user?.tenantId ?? "",
            entityType: "stockTransaction",
            method: "DELETE",
            url: `/api/stock/transaction/${txId}`,
            serverId: txId,
          });
        }
        return { success: true };
      }
      return apiRequest("DELETE", `/api/stock/transaction/${txId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/stock/ledger`, { facilityId: selectedFacilityId }] });
      toast({ title: "Transaction Reverted", description: "The stock ledger entry has been reverted." });
    },
    onError: (err: any) => {
      toast({ title: "Failed to revert", description: err.message, variant: "destructive" });
    },
  });

  // Monthly Report form wizard setup
  const [reportPeriod, setReportPeriod] = useState({
    month: new Date().getMonth() === 0 ? 12 : new Date().getMonth(),
    year: new Date().getFullYear(),
  });

  // Stepper state variables
  const [compiledImmunizations, setCompiledImmunizations] = useState<Record<string, number>>({});
  const [compiledStock, setCompiledStock] = useState<Record<string, any>>({});
  const [surveillanceData, setSurveillanceData] = useState({
    measles: 0,
    afp: 0,
    nnt: 0,
    aefi: 0,
  });

  // Auto-fill Wizard details based on Period selected
  const handleCompileWizardData = async () => {
    if (!selectedFacilityId || !clients) return;

    // STEP 2: Compile immunizations from client registrations
    // Simulate fetching vaccinations. In real production, it aggregates from API.
    // Let's call the backend client details or fetch vaccinations for all facility clients.
    try {
      const compiledImms: Record<string, number> = {};
      
      // Seed with standard configs
      if (vaccineConfigs) {
        vaccineConfigs.forEach(vc => {
          compiledImms[vc.name] = 0;
        });
      }

      // Optimize: utilize the nested vaccinations array already fetched for clients
      for (const client of clients) {
        const vacs: ClientVaccination[] = (client as any).vaccinations || [];
        vacs.forEach((v) => {
          const date = new Date(v.administeredDate);
          if (
            date.getMonth() + 1 === reportPeriod.month &&
            date.getFullYear() === reportPeriod.year
          ) {
            compiledImms[v.vaccineName] = (compiledImms[v.vaccineName] || 0) + 1;
          }
        });
      }

      setCompiledImmunizations(compiledImms);

      // STEP 3: Compile stock details for the period from stock transactions
      const compiledStk: Record<string, any> = {};
      
      if (vaccineConfigs) {
        // Unique normalized vaccine product names
        const uniqueProductNames = Array.from(new Set(
          vaccineConfigs.filter(c => c.active && c.stockManaged).map(c => normalizeStockVaccineName(c.name))
        ));

        uniqueProductNames.forEach(vcName => {
          // Aggregate ledger transactions for this month/year
          let received = 0;
          
          // sum administered count of all dose-level client vaccinations mapping to this vaccine product
          let administered = 0;
          Object.entries(compiledImms).forEach(([immName, count]) => {
            if (normalizeStockVaccineName(immName) === vcName) {
              administered += count;
            }
          });
          
          let wasted = 0;

          if (transactions) {
            transactions.forEach((tx: any) => {
              if (normalizeStockVaccineName(tx.vaccineName || "Unknown") !== vcName) return;
              const date = new Date(tx.transactionDate);
              const txInPeriod = date.getMonth() + 1 === reportPeriod.month && date.getFullYear() === reportPeriod.year;

              if (txInPeriod) {
                if (tx.transactionType === "receipt") received += tx.quantityDoses;
                if (tx.transactionType === "loss") wasted += tx.quantityDoses;
              }
            });
          }

          // Dynamic math using normalized product name
          const opening = stockOnHand[vcName] ? Math.max(0, stockOnHand[vcName] - received + administered + wasted) : 0;
          const closing = Math.max(0, opening + received - administered - wasted);
          const totalReceived = received;
          const totalWasted = wasted;
          
          const denominator = administered + totalWasted;
          const wastageRate = denominator > 0 ? parseFloat(((totalWasted / denominator) * 100).toFixed(2)) : 0;

          compiledStk[vcName] = {
            opening,
            received: totalReceived,
            administered,
            wasted: totalWasted,
            closing,
            wastageRate,
          };
        });
      }

      setCompiledStock(compiledStk);
      setWizardStep(2); // advance to next step
    } catch (err: any) {
      toast({ title: "Failed to compile data", description: err.message, variant: "destructive" });
    }
  };

  const saveReportMutation = useMutation({
    mutationFn: async (payload: any) => {
      return apiRequest("POST", "/api/monthly-reports", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/monthly-reports`, { facilityId: selectedFacilityId }] });
      setReportDialogOpen(false);
      setWizardStep(1);
      toast({
        title: "WHO Monthly Report Submitted",
        description: "Your compiled facility monthly report has been locked and submitted for review.",
      });
    },
    onError: (err: any) => {
      toast({ title: "Failed to submit report", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmitMonthlyReport = () => {
    if (!selectedFacilityId) return;

    const payload = {
      facilityId: selectedFacilityId,
      month: reportPeriod.month,
      year: reportPeriod.year,
      immunizations: compiledImmunizations,
      stockSummary: compiledStock,
      surveillance: surveillanceData,
      approvalStatus: "pending", // locked-submits for manager approval
    };

    saveReportMutation.mutate(payload);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Top Header Section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">WHO RED Stock Ledger & Monthly Reports</h1>
            <p className="text-sm text-muted-foreground">
              Track cold chain transaction ledgers and compile monthly facility immunization coverage reports.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (!selectedFacilityId) {
                  toast({
                    title: "Facility Required",
                    description: "Please select a specific facility from the location filters to compile a report.",
                    variant: "destructive"
                  });
                  return;
                }
                setReportDialogOpen(true);
                setWizardStep(1);
              }}
              className="gap-2 border-primary/20 text-primary hover:bg-primary/5"
            >
              <ClipboardList className="h-4 w-4" />
              <span>Compile Monthly Report</span>
            </Button>

            <Button onClick={() => setTxnDialogOpen(true)} className="gap-1 shadow-lg shadow-primary/20">
              <Plus className="h-4 w-4" />
              <span>Stock Card Action</span>
            </Button>
          </div>
        </div>

        {/* Geo cascade filter (Province → District → Facility — each level independently narrows table rows) */}
        <div className="bg-card border border-border/40 rounded-xl p-4 shadow-sm">
          <GeoCascadeFilter
            provinceId={geoProvinceId}
            districtId={geoDistrictId}
            facilityId={selectedFacilityId}
            onProvinceChange={(id) => { setGeoProvinceId(id); setGeoDistrictId(null); setSelectedFacilityId(null); }}
            onDistrictChange={(id) => { setGeoDistrictId(id); setSelectedFacilityId(null); }}
            onFacilityChange={setSelectedFacilityId}
            showFacility
            provinces={provinces}
            districts={districts}
            facilities={facilities ?? []}
            testIdPrefix="stockledger"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-[620px]">
          <TabsTrigger value="ledger" className="gap-1.5">
            <Package className="h-4 w-4" />
            <span>Stock Ledger Cards</span>
          </TabsTrigger>
          <TabsTrigger value="coldchain" className="gap-1.5" onClick={() => setLocation("/cold-chain")}>
            <Snowflake className="h-4 w-4 text-cyan-500" />
            <span>Cold Chain Inventory ↗</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-1.5">
            <FileText className="h-4 w-4" />
            <span>Monthly Compiled Reports</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Stock Card Ledger */}
        <TabsContent value="ledger" className="space-y-6 outline-none">
          {/* Stock Alert Banner + threshold control */}
          <Card className="border-border/40 bg-card/45">
            <CardContent className="p-4 flex flex-wrap items-center gap-4 justify-between">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge
                  variant="outline"
                  className={
                    lowStockCount > 0
                      ? "border-amber-500 text-amber-600 bg-amber-500/10"
                      : "border-emerald-500 text-emerald-600 bg-emerald-500/10"
                  }
                  data-testid="badge-low-stock-count"
                >
                  <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                  {lowStockCount} antigen{lowStockCount === 1 ? "" : "s"} below {mosThreshold} mo of stock
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    nearExpiryCount > 0
                      ? "border-rose-500 text-rose-600 bg-rose-500/10"
                      : "border-emerald-500 text-emerald-600 bg-emerald-500/10"
                  }
                  data-testid="badge-near-expiry-count"
                >
                  <Calendar className="h-3.5 w-3.5 mr-1" />
                  {nearExpiryCount} batch{nearExpiryCount === 1 ? "" : "es"} expiring within 60 days
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <label
                  htmlFor="mos-threshold"
                  className="text-xs font-semibold text-muted-foreground uppercase"
                >
                  Low-stock threshold (months):
                </label>
                <Input
                  id="mos-threshold"
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={mosThreshold}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setMosThreshold(
                      Number.isFinite(v) && v > 0
                        ? v
                        : DEFAULT_MONTHS_OF_STOCK_THRESHOLD,
                    );
                  }}
                  className="h-8 w-20"
                  data-testid="input-mos-threshold"
                />
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-evm-kpis">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-primary" />
                EVM maturity KPIs
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Effective Vaccine Management signals from stock cards, wastage notes, expiry dates, and lot traceability.
              </p>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Stockout-days", value: evmKpis.stockoutDays, detail: `${lowStockCount} antigen(s) below threshold`, tone: evmKpis.stockoutDays > 0 ? "text-rose-600" : "text-emerald-600" },
                { label: "Open vial wastage", value: evmKpis.openVialWastage.toLocaleString(), detail: "loss rows tagged open/partial", tone: evmKpis.openVialWastage > 0 ? "text-amber-600" : "text-emerald-600" },
                { label: "Closed vial wastage", value: evmKpis.closedVialWastage.toLocaleString(), detail: "loss rows tagged damaged/expired/VVM", tone: evmKpis.closedVialWastage > 0 ? "text-amber-600" : "text-emerald-600" },
                { label: "Temp excursions", value: `${evmKpis.temperatureExcursionRate}%`, detail: "transactions with temperature/excursion notes", tone: evmKpis.temperatureExcursionRate > 0 ? "text-rose-600" : "text-emerald-600" },
                { label: "Capacity utilization", value: evmKpis.capacityUtilization === null ? "Configure" : `${evmKpis.capacityUtilization}%`, detail: "requires cold-chain capacity profile", tone: "text-muted-foreground" },
                { label: "Maintenance overdue", value: evmKpis.maintenanceOverdue === null ? "Configure" : evmKpis.maintenanceOverdue, detail: "requires equipment service dates", tone: "text-muted-foreground" },
                { label: "Expiry risk", value: evmKpis.expiryRisk, detail: "batches expiring within 60 days", tone: evmKpis.expiryRisk > 0 ? "text-amber-600" : "text-emerald-600" },
                { label: "Lot traceability", value: `${evmKpis.lotTraceability}%`, detail: `${evmKpis.antigenCount} antigen(s) in ledger`, tone: evmKpis.lotTraceability >= 95 ? "text-emerald-600" : "text-rose-600" },
              ].map((metric) => (
                <div key={metric.label} className="rounded-lg border bg-muted/20 p-3">
                  <div className="text-[11px] uppercase font-semibold text-muted-foreground">{metric.label}</div>
                  <div className={`mt-1 text-2xl font-bold ${metric.tone}`}>{metric.value}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{metric.detail}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Suggested Transfers Panel */}
          {visibleSuggestions.length > 0 && (
            <Card
              className="border-amber-500/30 bg-amber-500/5 backdrop-blur-md shadow-xl"
              data-testid="card-transfer-suggestions"
            >
              <CardHeader className="border-b border-amber-500/20 px-6 py-4">
                <CardTitle className="text-sm font-semibold tracking-wider uppercase text-amber-700 dark:text-amber-300 flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  <span>Suggested Transfers</span>
                  <Badge
                    variant="outline"
                    className="border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/10 ml-1"
                    data-testid="badge-transfer-suggestion-count"
                  >
                    {visibleSuggestions.length}
                  </Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Move soon-to-expire doses from facilities with surplus to facilities running below {mosThreshold} mo of stock for the same antigen. Ranked by urgency.
                </p>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse min-w-[900px]">
                  <thead className="text-xs uppercase text-muted-foreground bg-amber-500/10 font-semibold border-b border-amber-500/20">
                    <tr>
                      <th className="px-4 py-3">Antigen</th>
                      <th className="px-4 py-3">Batch</th>
                      <th className="px-4 py-3">Expiry</th>
                      <th className="px-4 py-3">From</th>
                      <th className="px-4 py-3">To</th>
                      <th className="px-4 py-3 text-center">Suggested Doses</th>
                      <th className="px-4 py-3">Destination Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-500/20">
                    {visibleSuggestions.slice(0, 20).map((s) => {
                      const sourceName = facilityNameById.get(s.sourceFacilityId) ?? `Facility ${s.sourceFacilityId}`;
                      const destName = facilityNameById.get(s.destFacilityId) ?? `Facility ${s.destFacilityId}`;
                      const key = suggestionKey(s);
                      const isPending = actionTransferMutation.isPending && actionTransferMutation.variables && suggestionKey(actionTransferMutation.variables.suggestion) === key;
                      const expiryBadge =
                        s.expiryStatus === "expiring-30" ? (
                          <Badge variant="outline" className="border-rose-500 text-rose-600 bg-rose-500/10 text-[10px] px-1.5 py-0 h-5">
                            ≤30d ({s.daysUntilExpiry}d)
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-500/10 text-[10px] px-1.5 py-0 h-5">
                            ≤60d ({s.daysUntilExpiry}d)
                          </Badge>
                        );
                      return (
                        <tr
                          key={key}
                          className="hover:bg-amber-500/5 transition-colors"
                          data-testid={`row-transfer-suggestion-${key}`}
                        >
                          <td className="px-4 py-3 font-semibold text-primary">{s.antigen}</td>
                          <td className="px-4 py-3 font-mono text-xs">{s.batchNumber}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span>{format(new Date(s.expiryDate), "yyyy-MM-dd")}</span>
                              {expiryBadge}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{sourceName}</td>
                          <td className="px-4 py-3 text-muted-foreground">{destName}</td>
                          <td className="px-4 py-3 text-center font-bold">{s.suggestedDoses.toLocaleString()}</td>
                          <td className="px-4 py-3">
                            {s.destBalance <= 0 ? (
                              <Badge variant="outline" className="border-rose-500/30 text-rose-600 bg-rose-500/10 text-[10px]">
                                Out of stock
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-amber-500/30 text-amber-600 bg-amber-500/10 text-[10px]">
                                {s.destMonthsOfStock === null
                                  ? `${s.destBalance.toLocaleString()} doses on hand`
                                  : `${s.destMonthsOfStock.toFixed(1)} mo of stock`}
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isPending}
                              onClick={() => openConfirmTransfer(s)}
                              className="gap-1.5 border-amber-500/40 text-amber-700 hover:bg-amber-500/10"
                              data-testid={`button-action-transfer-${key}`}
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span>{isPending ? "Logging…" : "Mark Actioned"}</span>
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {visibleSuggestions.length > 20 && (
                  <div className="px-4 py-2 text-xs text-muted-foreground border-t border-amber-500/20 bg-amber-500/5">
                    Showing top 20 of {visibleSuggestions.length} suggestions, ranked by urgency.
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Confirm Suggested Transfer Dialog */}
          <Dialog
            open={confirmTransfer !== null}
            onOpenChange={(open) => {
              if (!open && !actionTransferMutation.isPending) closeConfirmTransfer();
            }}
          >
            <DialogContent className="sm:max-w-md" data-testid="dialog-confirm-transfer">
              <DialogHeader>
                <DialogTitle>Confirm transfer</DialogTitle>
              </DialogHeader>
              {confirmTransfer && (
                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-2 gap-y-2 gap-x-4 rounded-md border border-border bg-muted/40 p-3">
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">Antigen</div>
                      <div className="font-semibold" data-testid="text-confirm-transfer-antigen">{confirmTransfer.antigen}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">Batch</div>
                      <div className="font-mono text-xs" data-testid="text-confirm-transfer-batch">{confirmTransfer.batchNumber}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">From</div>
                      <div data-testid="text-confirm-transfer-source">
                        {facilityNameById.get(confirmTransfer.sourceFacilityId) ?? `Facility ${confirmTransfer.sourceFacilityId}`}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">To</div>
                      <div data-testid="text-confirm-transfer-dest">
                        {facilityNameById.get(confirmTransfer.destFacilityId) ?? `Facility ${confirmTransfer.destFacilityId}`}
                      </div>
                    </div>
                    <div className="col-span-2 flex justify-between text-xs text-muted-foreground pt-1 border-t border-border">
                      <span>Suggested: <span className="font-semibold text-foreground">{confirmTransfer.suggestedDoses.toLocaleString()}</span> doses</span>
                      <span>Source batch remaining: <span className="font-semibold text-foreground">{confirmTransfer.sourceBatchRemaining.toLocaleString()}</span></span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="confirm-transfer-doses" className="text-sm font-medium">
                      Doses to transfer
                    </label>
                    <Input
                      id="confirm-transfer-doses"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={confirmTransfer.sourceBatchRemaining}
                      step={1}
                      value={confirmDosesInput}
                      onChange={(e) => setConfirmDosesInput(e.target.value)}
                      disabled={actionTransferMutation.isPending}
                      data-testid="input-confirm-transfer-doses"
                    />
                    {confirmDosesError && (
                      <p className="text-xs text-rose-600" data-testid="text-confirm-transfer-error">
                        {confirmDosesError}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="confirm-transfer-note" className="text-sm font-medium">
                      Note <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                    </label>
                    <Textarea
                      id="confirm-transfer-note"
                      placeholder="e.g. Rounded to carton size; holding 50 doses for source pipeline."
                      rows={3}
                      value={confirmNote}
                      onChange={(e) => setConfirmNote(e.target.value)}
                      disabled={actionTransferMutation.isPending}
                      data-testid="input-confirm-transfer-note"
                    />
                  </div>
                </div>
              )}
              <DialogFooter className="gap-2 sm:gap-2">
                <Button
                  variant="outline"
                  onClick={closeConfirmTransfer}
                  disabled={actionTransferMutation.isPending}
                  data-testid="button-confirm-transfer-cancel"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (!confirmTransfer || !confirmDosesValid) return;
                    actionTransferMutation.mutate({
                      suggestion: confirmTransfer,
                      doses: parsedConfirmDoses,
                      note: confirmNote,
                    });
                  }}
                  disabled={!confirmDosesValid || actionTransferMutation.isPending}
                  data-testid="button-confirm-transfer-submit"
                >
                  {actionTransferMutation.isPending ? "Logging…" : "Confirm transfer"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Active Balances SOH Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from(new Set(
              allCatalogueProducts.map(c => normalizeStockVaccineName(c.name))
            )).map((normName) => {
              const config = allCatalogueProducts.find(c => normalizeStockVaccineName(c.name) === normName);
              const wastageRate = resolveDisplayWastageRate(config, catalogueWastageThresholds, normName);
              const status = antigenStatusByName.get(normName);
              const balance = status?.balance ?? stockOnHand[normName] ?? 0;
              const mos = status?.monthsOfStock ?? null;
              const isLow = status?.isLowStock ?? false;
              const isOut = status?.isOutOfStock ?? false;
              const isSelected = config?.id === selectedProductId;
              const cardTone = isSelected
                ? "border-primary ring-2 ring-primary bg-primary/5"
                : isOut
                ? "border-rose-500/30 bg-rose-500/5"
                : isLow
                  ? "border-amber-500/30 bg-amber-500/5"
                  : "";

              return (
                <Card
                  key={normName}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (isSelected) updateProductIdInUrl(null);
                    else updateProductIdInUrl(config?.id ?? null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (isSelected) updateProductIdInUrl(null);
                      else updateProductIdInUrl(config?.id ?? null);
                    }
                  }}
                  className={`border-border/40 backdrop-blur-md shadow transition-all hover:scale-[1.02] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${cardTone}`}
                  data-testid={`card-soh-${normName}`}
                >
                  <CardContent className="p-4 flex flex-col justify-between h-full">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider truncate">
                          {normName}
                        </span>
                        {isSelected ? (
                          <Badge variant="default" className="text-[9px] px-1 py-0 h-4">
                            Selected
                          </Badge>
                        ) : isOut ? (
                          <Badge variant="outline" className="border-rose-500/30 text-rose-600 bg-rose-500/10 text-[9px] px-1 py-0 h-4">
                            Out
                          </Badge>
                        ) : isLow ? (
                          <Badge variant="outline" className="border-amber-500/30 text-amber-600 bg-amber-500/10 text-[9px] px-1 py-0 h-4">
                            Low
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-2xl font-bold tracking-tight text-foreground mt-1">
                        {balance.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {mos === null
                          ? "No recent issues — MoS n/a"
                          : `${mos.toFixed(1)} mo of stock`}
                      </p>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-2 border-t pt-1 border-border/20">
                      Wastage rate: {wastageRate.toFixed(2)}%
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Ledger Transaction History */}
          <Card className="border-border/40 backdrop-blur-md bg-card/45 shadow-xl">
            <CardHeader className="border-b border-border/40 bg-muted/20 px-6 py-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle className="text-sm font-semibold tracking-wider uppercase text-muted-foreground flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  <span>
                    Stock Card Transactions Ledger 
                    {selectedProductId && vaccineConfigs?.find(c => c.id === selectedProductId) 
                      ? ` — ${vaccineConfigs.find(c => c.id === selectedProductId)?.name}` 
                      : ""}
                  </span>
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedProductId && (
                    <Button variant="ghost" size="sm" onClick={() => updateProductIdInUrl(null)} className="h-8 gap-1 text-xs">
                      <Trash2 className="h-3 w-3" /> Clear Product Filter
                    </Button>
                  )}
                  
                  {/* Collapsible Filters Toggle */}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    className="h-8 gap-1 text-xs"
                  >
                    <Filter className="h-3.5 w-3.5" />
                    <span>{showAdvancedFilters ? "Hide Filters" : "Advanced Filters"}</span>
                  </Button>

                  {/* Column Visibility Selector */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
                        <Eye className="h-3.5 w-3.5" />
                        <span>Columns</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 bg-card">
                      {Object.keys(visibleColumns).map((col) => (
                        <DropdownMenuCheckboxItem
                          key={col}
                          checked={visibleColumns[col]}
                          onCheckedChange={(checked) => 
                            setVisibleColumns(prev => ({ ...prev, [col]: checked }))
                          }
                          className="capitalize text-xs"
                        >
                          {col === "recipient" ? "supplier/recipient" : col}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Export Options */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
                        <Download className="h-3.5 w-3.5" />
                        <span>Export</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-card">
                      <DropdownMenuItem onClick={() => handleExport("csv")} className="text-xs gap-1.5 cursor-pointer">
                        <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> Export CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport("xlsx")} className="text-xs gap-1.5 cursor-pointer">
                        <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" /> Export XLSX
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport("json")} className="text-xs gap-1.5 cursor-pointer">
                        <FileJson className="h-3.5 w-3.5 text-amber-500" /> Export JSON
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport("pdf")} className="text-xs gap-1.5 cursor-pointer">
                        <FileText className="h-3.5 w-3.5 text-rose-500" /> Export PDF (Print)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Collapsible Filter Panel */}
              {showAdvancedFilters && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-4 p-4 border border-border/40 rounded-lg bg-muted/20">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Batch Number</label>
                    <Input 
                      placeholder="Search batch..." 
                      value={filterBatchNumber} 
                      onChange={(e) => setFilterBatchNumber(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Performed By (User)</label>
                    <Input 
                      placeholder="Search user ID..." 
                      value={filterUser} 
                      onChange={(e) => setFilterUser(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Action Type</label>
                    <Select value={filterTransactionType} onValueChange={setFilterTransactionType}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="All types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All types</SelectItem>
                        <SelectItem value="receipt">receipt</SelectItem>
                        <SelectItem value="issue">issue</SelectItem>
                        <SelectItem value="loss">loss</SelectItem>
                        <SelectItem value="adjustment">adjustment</SelectItem>
                        <SelectItem value="administered">administered</SelectItem>
                        <SelectItem value="transfer">transfer</SelectItem>
                        <SelectItem value="transfer_out">transfer_out</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">VVM Status</label>
                    <Select value={filterVvmStatus} onValueChange={setFilterVvmStatus}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="1">1 - Good</SelectItem>
                        <SelectItem value="2">2 - Use First</SelectItem>
                        <SelectItem value="3">3 - Discard</SelectItem>
                        <SelectItem value="4">4 - Discarded</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Stock Status</label>
                    <Select value={filterStockStatus} onValueChange={setFilterStockStatus}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="All stocks" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All stocks</SelectItem>
                        <SelectItem value="low">Low Stock</SelectItem>
                        <SelectItem value="stockout">Stockout</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                        <SelectItem value="near_expiry">Near Expiry</SelectItem>
                        <SelectItem value="negative">Negative Balance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 col-span-1 sm:col-span-2">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Transaction Date Range</label>
                    <div className="flex gap-2">
                      <Input 
                        type="date" 
                        value={filterTxnStart} 
                        onChange={(e) => setFilterTxnStart(e.target.value)}
                        className="h-8 text-xs"
                      />
                      <span className="text-muted-foreground self-center">to</span>
                      <Input 
                        type="date" 
                        value={filterTxnEnd} 
                        onChange={(e) => setFilterTxnEnd(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                  <div className="space-y-1 col-span-1 sm:col-span-2">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Expiry Date Range</label>
                    <div className="flex gap-2">
                      <Input 
                        type="date" 
                        value={filterExpiryStart} 
                        onChange={(e) => setFilterExpiryStart(e.target.value)}
                        className="h-8 text-xs"
                      />
                      <span className="text-muted-foreground self-center">to</span>
                      <Input 
                        type="date" 
                        value={filterExpiryEnd} 
                        onChange={(e) => setFilterExpiryEnd(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                  <div className="col-span-full flex justify-end gap-2 pt-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        setFilterBatchNumber("");
                        setFilterTransactionType("all");
                        setFilterVvmStatus("all");
                        setFilterExpiryStart("");
                        setFilterExpiryEnd("");
                        setFilterTxnStart("");
                        setFilterTxnEnd("");
                        setFilterStockStatus("all");
                        setFilterUser("");
                      }}
                      className="h-7 text-xs"
                    >
                      Clear Filters
                    </Button>
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              
              {/* Pagination (Top Controls) */}
              {transactions.length > 0 && (
                <div className="px-6 py-3 border-b border-border/40 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground bg-muted/5">
                  <div>
                    Showing <span className="font-semibold text-foreground">{(currentPage - 1) * pageSize + 1}</span> to{" "}
                    <span className="font-semibold text-foreground">{Math.min(currentPage * pageSize, transactions.length)}</span> of{" "}
                    <span className="font-semibold text-foreground">{transactions.length}</span> entries
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <span>Show</span>
                      <select 
                        value={pageSize} 
                        onChange={(e) => setPageSize(parseInt(e.target.value))}
                        className="h-7 bg-background border rounded px-1 text-xs text-foreground outline-none cursor-pointer"
                      >
                        {[10, 25, 50, 100].map(sz => (
                          <option key={sz} value={sz}>{sz}</option>
                        ))}
                      </select>
                      <span>entries</span>
                    </div>
                    <div className="flex items-center gap-1.5 ml-4">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(1)}
                        className="h-7 w-7"
                        title="First Page"
                      >
                        {"<<"}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(currentPage - 1)}
                        className="h-7 w-7"
                        title="Previous Page"
                      >
                        {"<"}
                      </Button>
                      <span className="px-2">
                        Page <span className="font-semibold text-foreground">{currentPage}</span>
                      </span>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        disabled={currentPage * pageSize >= transactions.length}
                        onClick={() => setCurrentPage(currentPage + 1)}
                        className="h-7 w-7"
                        title="Next Page"
                      >
                        {">"}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        disabled={currentPage * pageSize >= transactions.length}
                        onClick={() => setCurrentPage(Math.ceil(transactions.length / pageSize))}
                        className="h-7 w-7"
                        title="Last Page"
                      >
                        {">>"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                {loadingTxns ? (
                  <div className="p-6 space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : paginatedTransactions && paginatedTransactions.length > 0 ? (
                  <table className="w-full text-sm text-left border-collapse min-w-[800px]">
                    <thead className="text-xs uppercase text-muted-foreground bg-muted/40 font-semibold border-b border-border/40 sticky top-0 backdrop-blur-md">
                      <tr>
                        {visibleColumns.date && (
                          <th 
                            onClick={() => {
                              setSortField("transactionDate");
                              setSortDirection(prev => sortField === "transactionDate" && prev === "asc" ? "desc" : "asc");
                            }}
                            className="px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors select-none"
                          >
                            <div className="flex items-center gap-1">
                              <span>Date</span>
                              {sortField === "transactionDate" && (sortDirection === "asc" ? "▲" : "▼")}
                            </div>
                          </th>
                        )}
                        {visibleColumns.province && <th className="px-4 py-3">Province</th>}
                        {visibleColumns.district && <th className="px-4 py-3">District</th>}
                        {visibleColumns.product && (
                          <th 
                            onClick={() => {
                              setSortField("vaccineName");
                              setSortDirection(prev => sortField === "vaccineName" && prev === "asc" ? "desc" : "asc");
                            }}
                            className="px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors select-none"
                          >
                            <div className="flex items-center gap-1">
                              <span>Antigen / Vaccine</span>
                              {sortField === "vaccineName" && (sortDirection === "asc" ? "▲" : "▼")}
                            </div>
                          </th>
                        )}
                        {visibleColumns.type && <th className="px-4 py-3">Type</th>}
                        {visibleColumns.quantity && (
                          <th 
                            onClick={() => {
                              setSortField("quantityDoses");
                              setSortDirection(prev => sortField === "quantityDoses" && prev === "asc" ? "desc" : "asc");
                            }}
                            className="px-4 py-3 text-center cursor-pointer hover:bg-muted/40 transition-colors select-none"
                          >
                            <div className="flex items-center justify-center gap-1">
                              <span>Qty (Doses)</span>
                              {sortField === "quantityDoses" && (sortDirection === "asc" ? "▲" : "▼")}
                            </div>
                          </th>
                        )}
                        {visibleColumns.batch && <th className="px-4 py-3">Batch Number</th>}
                        {visibleColumns.expiry && (
                          <th 
                            onClick={() => {
                              setSortField("expiryDate");
                              setSortDirection(prev => sortField === "expiryDate" && prev === "asc" ? "desc" : "asc");
                            }}
                            className="px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors select-none"
                          >
                            <div className="flex items-center gap-1">
                              <span>Expiry Date</span>
                              {sortField === "expiryDate" && (sortDirection === "asc" ? "▲" : "▼")}
                            </div>
                          </th>
                        )}
                        {visibleColumns.vvm && <th className="px-4 py-3 text-center">VVM</th>}
                        {visibleColumns.recipient && <th className="px-4 py-3">Supplier/Recipient</th>}
                        {visibleColumns.balance && (
                          <th 
                            onClick={() => {
                              setSortField("runningBalance");
                              setSortDirection(prev => sortField === "runningBalance" && prev === "asc" ? "desc" : "asc");
                            }}
                            className="px-4 py-3 text-right cursor-pointer hover:bg-muted/40 transition-colors select-none text-primary"
                          >
                            <div className="flex items-center justify-end gap-1">
                              <span>Running Balance</span>
                              {sortField === "runningBalance" && (sortDirection === "asc" ? "▲" : "▼")}
                            </div>
                          </th>
                        )}
                        {visibleColumns.actions && <th className="px-4 py-3 text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {paginatedTransactions.map((tx) => {
                        const typeColors: Record<string, string> = {
                          receipt: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
                          issue: "bg-blue-500/10 text-blue-600 border-blue-500/20",
                          loss: "bg-destructive/10 text-destructive border-destructive/20",
                          adjustment: "bg-amber-500/10 text-amber-600 border-amber-500/20",
                          administered: "bg-purple-500/10 text-purple-600 border-purple-500/20",
                          transfer: "bg-teal-500/10 text-teal-600 border-teal-500/20",
                          transfer_out: "bg-orange-500/10 text-orange-600 border-orange-500/20",
                        };

                        const vvmStatuses: Record<number, string> = {
                          1: "1-Good",
                          2: "2-Use First",
                          3: "3-Discard",
                          4: "4-Discarded",
                        };

                        const rowGeo = resolveRowGeo(tx.facilityId);
                        return (
                          <tr 
                            key={tx.id} 
                            onClick={() => setSelectedTxnDetails(tx)}
                            className="hover:bg-muted/10 transition-colors cursor-pointer"
                          >
                            {visibleColumns.date && (
                              <td className="px-4 py-3 whitespace-nowrap">{format(new Date(tx.transactionDate), "yyyy-MM-dd HH:mm")}</td>
                            )}
                            {visibleColumns.province && <td className="px-4 py-3 text-muted-foreground">{rowGeo.provinceName ?? "—"}</td>}
                            {visibleColumns.district && <td className="px-4 py-3 text-muted-foreground">{rowGeo.districtName ?? "—"}</td>}
                            {visibleColumns.product && (
                              <td className="px-4 py-3 font-semibold text-primary">{tx.vaccineName}</td>
                            )}
                            {visibleColumns.type && (
                              <td className="px-4 py-3">
                                <Badge variant="outline" className={`capitalize ${typeColors[tx.transactionType] || ""}`}>
                                  {tx.transactionType}
                                </Badge>
                              </td>
                            )}
                            {visibleColumns.quantity && (
                              <td className="px-4 py-3 text-center font-bold">{tx.quantityDoses}</td>
                            )}
                            {visibleColumns.batch && <td className="px-4 py-3 font-mono text-xs">{tx.batchNumber}</td>}
                            {visibleColumns.expiry && (
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5">
                                  <span>{format(new Date(tx.expiryDate), "yyyy-MM-dd")}</span>
                                  {(() => {
                                    const flagged = nearExpiryByTxId.get(tx.id);
                                    if (flagged) {
                                      if (flagged.status === "expired") {
                                        return (
                                          <Badge
                                            variant="outline"
                                            className="border-rose-500 text-rose-600 bg-rose-500/10 text-[10px] px-1.5 py-0 h-5"
                                            data-testid={`badge-expiry-${tx.id}`}
                                          >
                                            Expired {Math.abs(flagged.daysUntil)}d ago
                                          </Badge>
                                        );
                                      }
                                      if (flagged.status === "expiring-30") {
                                        return (
                                          <Badge
                                            variant="outline"
                                            className="border-rose-500 text-rose-600 bg-rose-500/10 text-[10px] px-1.5 py-0 h-5"
                                            data-testid={`badge-expiry-${tx.id}`}
                                          >
                                            ≤30d
                                          </Badge>
                                        );
                                      }
                                      return (
                                        <Badge
                                          variant="outline"
                                          className="border-amber-500 text-amber-600 bg-amber-500/10 text-[10px] px-1.5 py-0 h-5"
                                          data-testid={`badge-expiry-${tx.id}`}
                                        >
                                          ≤60d
                                        </Badge>
                                      );
                                    }
                                    if (tx.transactionType === "receipt") {
                                      const { status, daysUntil } = getExpiryStatus(tx.expiryDate);
                                      if (status === "expired") {
                                        return (
                                          <Badge
                                            variant="outline"
                                            className="border-muted-foreground/30 text-muted-foreground text-[10px] px-1.5 py-0 h-5"
                                            title="Batch already exhausted"
                                          >
                                            Expired {Math.abs(daysUntil)}d ago
                                          </Badge>
                                        );
                                      }
                                    }
                                    return null;
                                  })()}
                                </div>
                              </td>
                            )}
                            {visibleColumns.vvm && (
                              <td className="px-4 py-3 text-center">
                                <Badge variant="outline" className={tx.vvmStatus > 2 ? "border-destructive text-destructive" : ""}>
                                  {vvmStatuses[tx.vvmStatus] ?? tx.vvmStatus}
                                </Badge>
                              </td>
                            )}
                            {visibleColumns.recipient && (
                              <td className="px-4 py-3 text-muted-foreground">{tx.supplierOrRecipient}</td>
                            )}
                            {visibleColumns.balance && (
                              <td className="px-4 py-3 text-right font-bold text-primary">
                                {tx.runningBalance?.toLocaleString() ?? "—"}
                              </td>
                            )}
                            {visibleColumns.actions && (
                              <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => deleteTxnMutation.mutate(tx.id)}
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-2">
                      <Package className="h-6 w-6 text-muted-foreground/60" />
                    </div>
                    {selectedProductId ? (
                      <>
                        <p>No stock transactions found for {vaccineConfigs?.find(c => c.id === selectedProductId)?.name} in the selected location.</p>
                        <Button variant="outline" size="sm" onClick={() => updateProductIdInUrl(null)} className="mt-2">
                          Show All Products
                        </Button>
                      </>
                    ) : (
                      <p>No stock transactions logged yet. Click "Stock Card Action" to register cold chain arrivals or issues.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Pagination (Bottom Controls) */}
              {transactions.length > 0 && (
                <div className="px-6 py-4 border-t border-border/40 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground bg-muted/5">
                  <div>
                    Showing <span className="font-semibold text-foreground">{(currentPage - 1) * pageSize + 1}</span> to{" "}
                    <span className="font-semibold text-foreground">{Math.min(currentPage * pageSize, transactions.length)}</span> of{" "}
                    <span className="font-semibold text-foreground">{transactions.length}</span> entries
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(currentPage - 1)}
                      className="h-8"
                    >
                      Previous
                    </Button>
                    {Array.from({ length: Math.ceil(transactions.length / pageSize) }).map((_, idx) => {
                      const pg = idx + 1;
                      if (pg === 1 || pg === Math.ceil(transactions.length / pageSize) || Math.abs(pg - currentPage) <= 1) {
                        return (
                          <Button
                            key={pg}
                            variant={currentPage === pg ? "default" : "outline"}
                            size="icon"
                            onClick={() => setCurrentPage(pg)}
                            className="h-8 w-8 text-xs font-medium"
                          >
                            {pg}
                          </Button>
                        );
                      }
                      if (pg === 2 || pg === Math.ceil(transactions.length / pageSize) - 1) {
                        return <span key={pg} className="px-1 text-muted-foreground select-none">...</span>;
                      }
                      return null;
                    })}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={currentPage * pageSize >= transactions.length}
                      onClick={() => setCurrentPage(currentPage + 1)}
                      className="h-8"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dialog 3: Row Click Full Transaction Details */}
          <Dialog open={selectedTxnDetails !== null} onOpenChange={(open) => !open && setSelectedTxnDetails(null)}>
            <DialogContent className="max-w-md bg-card">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  <span>Transaction Ledger Details</span>
                </DialogTitle>
              </DialogHeader>
              {selectedTxnDetails && (
                <div className="space-y-4 pt-3 text-sm">
                  <div className="grid grid-cols-2 gap-y-3 gap-x-4 border rounded-lg p-4 bg-muted/10">
                    <div>
                      <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Date & Time</span>
                      <span className="font-medium text-foreground">{format(new Date(selectedTxnDetails.transactionDate), "yyyy-MM-dd HH:mm")}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Transaction ID</span>
                      <span className="font-mono font-medium text-foreground">#{selectedTxnDetails.id}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Antigen/Vaccine</span>
                      <span className="font-bold text-primary">{selectedTxnDetails.vaccineName}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Type</span>
                      <span className="capitalize font-semibold text-foreground">{selectedTxnDetails.transactionType}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Quantity (Doses)</span>
                      <span className="font-bold text-foreground">{selectedTxnDetails.quantityDoses.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Batch Number</span>
                      <span className="font-mono text-foreground font-medium">{selectedTxnDetails.batchNumber}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Expiry Date</span>
                      <span className="font-medium text-foreground">{format(new Date(selectedTxnDetails.expiryDate), "yyyy-MM-dd")}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-muted-foreground font-semibold block">VVM Status</span>
                      <span className="font-medium text-foreground">
                        {selectedTxnDetails.vvmStatus === 1 ? "1 - Good" : 
                         selectedTxnDetails.vvmStatus === 2 ? "2 - Use First" : 
                         selectedTxnDetails.vvmStatus === 3 ? "3 - Discard" : "4 - Discarded"}
                      </span>
                    </div>
                    <div className="col-span-2 border-t pt-2 mt-1">
                      <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Supplier / Recipient</span>
                      <span className="font-medium text-foreground">{selectedTxnDetails.supplierOrRecipient || "—"}</span>
                    </div>
                    <div className="col-span-2 border-t pt-2">
                      <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Running Stock Balance</span>
                      <span className="font-bold text-primary text-base">{selectedTxnDetails.runningBalance?.toLocaleString() ?? "—"} doses</span>
                    </div>
                    {selectedTxnDetails.sourceModule && (
                      <div className="col-span-2 border-t pt-2">
                        <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Source Module</span>
                        <span className="font-mono text-xs text-foreground bg-muted/40 px-1.5 py-0.5 rounded">{selectedTxnDetails.sourceModule} {selectedTxnDetails.sourceRecordId ? `(#${selectedTxnDetails.sourceRecordId})` : ""}</span>
                      </div>
                    )}
                    {selectedTxnDetails.recordedByUserId && (
                      <div className="col-span-2 border-t pt-2">
                        <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Recorded By</span>
                        <span className="text-muted-foreground text-xs">{selectedTxnDetails.recordedByUserId}</span>
                      </div>
                    )}
                  </div>
                  {selectedTxnDetails.notes && (
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Notes</span>
                      <p className="text-xs text-muted-foreground border rounded p-2 bg-muted/5 leading-relaxed">{selectedTxnDetails.notes}</p>
                    </div>
                  )}
                </div>
              )}
              <DialogFooter>
                <Button onClick={() => setSelectedTxnDetails(null)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Tab 2: Monthly Reports List */}
        <TabsContent value="reports" className="space-y-6 outline-none">
          <Card className="border-border/40 backdrop-blur-md bg-card/45 shadow-xl">
            <CardHeader className="border-b border-border/40 bg-muted/20 px-6 py-4">
              <CardTitle className="text-sm font-semibold tracking-wider uppercase text-muted-foreground">
                WHO RED Facility Monthly Immunization Reports
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {loadingReports ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : reports && reports.length > 0 ? (
                <table className="w-full text-sm text-left border-collapse min-w-[800px]">
                  <thead className="text-xs uppercase text-muted-foreground bg-muted/40 font-semibold border-b border-border/40">
                    <tr>
                      <th className="px-4 py-3">Reporting Period</th>
                      <th className="px-4 py-3">Province</th>
                      <th className="px-4 py-3">District</th>
                      <th className="px-4 py-3">Immunizations Count</th>
                      <th className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span>Stock Wastage Summaries</span>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 text-[10px] font-normal normal-case text-muted-foreground border border-border/60 rounded px-1.5 py-0.5 hover:bg-muted/50"
                                  data-testid="button-wastage-legend"
                                >
                                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                                  <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                                  <span className="inline-block h-2 w-2 rounded-full bg-destructive" />
                                  <span>WHO</span>
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-xs text-xs">
                                <div className="font-semibold mb-1">Active wastage thresholds</div>
                                <div className="space-y-0.5">
                                  <div><span className="text-emerald-600 font-semibold">Green</span> — below warning level</div>
                                  <div><span className="text-amber-600 font-semibold">Amber</span> — approaching max</div>
                                  <div><span className="text-destructive font-semibold">Red</span> — exceeds max</div>
                                </div>
                                <div className="mt-2 text-muted-foreground">
                                  Current (warn / max):{" "}
                                  {(() => {
                                    const seen = new Set<string>();
                                    const previewAntigens = ["BCG", "Measles", "OPV", "Penta", "PCV", "IPV"];
                                    const parts: string[] = [];
                                    for (const a of previewAntigens) {
                                      const t = getWastageThreshold(a, wastageThresholds);
                                      const sig = `${t.warn}/${t.max}`;
                                      if (seen.has(`${a}:${sig}`)) continue;
                                      seen.add(`${a}:${sig}`);
                                      parts.push(`${a} ${t.warn}% / ${t.max}%`);
                                    }
                                    return parts.join(", ") + ".";
                                  })()}
                                </div>
                                <div className="mt-1 text-muted-foreground">
                                  National admins can customize these in Settings → Microplanning.
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </th>
                      <th className="px-4 py-3">Surveillance Status</th>
                      <th className="px-4 py-3">Approval Status</th>
                      <th className="px-4 py-3">Submission Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {reports.map((rep) => {
                      const months = [
                        "January", "February", "March", "April", "May", "June",
                        "July", "August", "September", "October", "November", "December",
                      ];
                      
                      const imms = (rep.immunizations || {}) as Record<string, number>;
                      const stock = (rep.stockSummary || {}) as Record<string, any>;
                      const surv = (rep.surveillance || {}) as Record<string, number>;

                      const rowGeo = resolveRowGeo(rep.facilityId);
                      return (
                        <tr key={rep.id} className="hover:bg-muted/10 transition-colors">
                          <td className="px-4 py-3 font-semibold">
                            {months[rep.month - 1]} {rep.year}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{rowGeo.provinceName ?? "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{rowGeo.districtName ?? "—"}</td>
                          <td className="px-4 py-3">
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs max-w-[200px]">
                              {Object.entries(imms).slice(0, 4).map(([k, v]) => (
                                <div key={k} className="flex justify-between">
                                  <span className="text-muted-foreground">{k}:</span>
                                  <span className="font-bold">{v}</span>
                                </div>
                              ))}
                              {Object.keys(imms).length > 4 && (
                                <div className="text-[10px] text-muted-foreground col-span-2">
                                  + {Object.keys(imms).length - 4} other antigens
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-xs space-y-1 max-w-[260px]">
                              {Object.entries(stock).slice(0, 2).map(([k, v]: [string, any]) => {
                                const rate = Number(v.wastageRate ?? 0);
                                const status = classifyWastage(k, rate, wastageThresholds);
                                const t = getWastageThreshold(k, wastageThresholds);
                                const label =
                                  status === "breach"
                                    ? `Above WHO max (${t.max}%)`
                                    : status === "warn"
                                      ? `Near WHO max (warn ${t.warn}%, max ${t.max}%)`
                                      : `Within WHO limits (max ${t.max}%)`;
                                return (
                                  <div key={k} className="flex justify-between items-center gap-2">
                                    <span className="text-muted-foreground">{k}:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="font-bold">W:{v.wasted}</span>
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <span
                                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${wastageChipClasses(status)}`}
                                              data-testid={`chip-wastage-${rep.id}-${k}`}
                                              data-status={status}
                                            >
                                              {rate}%
                                            </span>
                                          </TooltipTrigger>
                                          <TooltipContent className="text-xs">{label}</TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    </div>
                                  </div>
                                );
                              })}
                              {Object.keys(stock).length > 2 && (
                                <div className="text-[10px] text-muted-foreground">
                                  + {Object.keys(stock).length - 2} other stocks
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <Badge variant="outline" className={surv.measles > 0 ? "border-destructive text-destructive bg-destructive/5" : ""}>
                                Measles: {surv.measles ?? 0}
                              </Badge>
                              <Badge variant="outline" className={surv.aefi > 0 ? "border-amber-500 text-amber-600 bg-amber-500/5" : ""}>
                                AEFI: {surv.aefi ?? 0}
                              </Badge>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              className={
                                rep.approvalStatus === "approved"
                                  ? "bg-emerald-500 hover:bg-emerald-600"
                                  : rep.approvalStatus === "pending"
                                    ? "bg-amber-500 hover:bg-amber-600"
                                    : "bg-secondary"
                              }
                            >
                              {rep.approvalStatus}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <User className="h-3.5 w-3.5" />
                              <span>Submitted {rep.createdAt ? format(new Date(rep.createdAt), "yyyy-MM-dd") : "N/A"}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="p-12 text-center text-muted-foreground">
                  No monthly facility reports compiled yet. Click "Compile Monthly Report" to trigger automated WHO RED assemblies.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* dialog 1: Add transaction */}
      <Dialog open={txnDialogOpen} onOpenChange={setTxnDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Stock Card Registry Action</DialogTitle>
          </DialogHeader>

          <Form {...txnForm}>
            <form onSubmit={txnForm.handleSubmit((d) => {
              const product = allCatalogueProducts.find(c => c.id === d.productId);
              const showBatch = selectedProductMeta ? selectedProductMeta.showBatchNumber : true;
              const showExpiry = selectedProductMeta ? selectedProductMeta.showExpiryDate : true;
              const showVVM = selectedProductMeta ? selectedProductMeta.showVVMStatus : true;

              saveTxnMutation.mutate({
                ...d,
                vaccineName: product?.name || "",
                productCode: product?.code || "",
                batchNumber: showBatch ? (d.batchNumber || "N/A") : "N/A",
                expiryDate: showExpiry ? (d.expiryDate || new Date().toISOString().split("T")[0]) : new Date("2099-12-31").toISOString().split("T")[0],
                vvmStatus: showVVM ? d.vvmStatus : 1,
              });
            })} className="space-y-4 pt-4">
              <FormField
                control={txnForm.control}
                name="productId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product / Catalogue Supply</FormLabel>
                    <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString() || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pick vaccine, supply, or tally sheet" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-[350px]">
                        {groupedCatalogueProducts.map((group) => (
                          <SelectGroup key={group.groupId}>
                            <SelectLabel className="px-2 py-1 text-xs font-bold uppercase text-muted-foreground bg-muted/30 flex items-center gap-1.5 sticky top-0 backdrop-blur">
                              <span>{group.icon}</span>
                              <span>{group.groupLabel}</span>
                            </SelectLabel>
                            {group.items.map((c) => (
                              <SelectItem key={c.id} value={c.id.toString()}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={txnForm.control}
                  name="transactionType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Action Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="receipt">Receipt (Arrival)</SelectItem>
                          <SelectItem value="issue">Issue (Deployment)</SelectItem>
                          <SelectItem value="loss">Loss (Wastage / Damage)</SelectItem>
                          <SelectItem value="adjustment">Adjustment (+/-)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={txnForm.control}
                  name="quantityDoses"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{selectedProductMeta?.quantityLabel || "Quantity"}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Linked Cold Chain Equipment Picker (Only for Cold Chain Equipment items) */}
              {selectedProductMeta?.showEquipmentPicker && (
                <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg space-y-2">
                  <FormLabel className="text-xs font-semibold text-cyan-700 dark:text-cyan-300 flex items-center gap-1.5">
                    <span>❄️ Linked Cold Chain Equipment (Inventory)</span>
                  </FormLabel>
                  <Select
                    onValueChange={(val) => {
                      const equip = facilityColdChainEquipment.find((e: any) => String(e.id) === val);
                      if (equip) {
                        txnForm.setValue("notes", `Linked Equipment: ${equip.brand || ""} ${equip.model || equip.equipmentType} (Serial: ${equip.serialNumber || "N/A"}) - ${equip.condition || "Working"}`);
                      }
                    }}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Pick registered facility cold chain unit..." />
                    </SelectTrigger>
                    <SelectContent>
                      {facilityColdChainEquipment.length > 0 ? (
                        facilityColdChainEquipment.map((eq: any) => (
                          <SelectItem key={eq.id} value={eq.id.toString()}>
                            [{eq.equipmentType?.toUpperCase()}] {eq.brand} {eq.model} — {eq.condition || "Working"} (SN: {eq.serialNumber || "N/A"})
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="__none__" disabled>
                          No registered cold chain equipment found for this facility
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Pulls active equipment records directly from the Cold Chain Inventory tab.
                  </p>
                </div>
              )}

              {/* Batch Number & Expiry Date (Hidden for Session Tally Sheets & Cold Chain Equipment) */}
              {(selectedProductMeta ? selectedProductMeta.showBatchNumber : true) && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={txnForm.control}
                    name="batchNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Batch Number</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. BCG-9923" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={txnForm.control}
                    name="expiryDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expiry Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* VVM Status & Supplier/Recipient */}
              <div className={(selectedProductMeta ? selectedProductMeta.showVVMStatus : true) ? "grid grid-cols-2 gap-4" : "space-y-4"}>
                {(selectedProductMeta ? selectedProductMeta.showVVMStatus : true) && (
                  <FormField
                    control={txnForm.control}
                    name="vvmStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>VVM Status</FormLabel>
                        <Select
                          onValueChange={(v) => field.onChange(parseInt(v))}
                          defaultValue={field.value?.toString() || "1"}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="VVM Stage" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="1">Stage 1: Good</SelectItem>
                            <SelectItem value="2">Stage 2: Use First</SelectItem>
                            <SelectItem value="3">Stage 3: Discard</SelectItem>
                            <SelectItem value="4">Stage 4: Discarded</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={txnForm.control}
                  name="supplierOrRecipient"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier / Recipient</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. National Store / Health Center" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={txnForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transaction Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Vial damages, temperature alerts..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="pt-2 gap-2">
                <Button type="button" variant="outline" onClick={() => setTxnDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saveTxnMutation.isPending}>
                  {saveTxnMutation.isPending ? "Logging Card..." : "Save Stock Entry"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* dialog 2: Compile Monthly Report Wizard */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              <span>WHO RED Monthly Compilation Compiler (Step {wizardStep} of 4)</span>
            </DialogTitle>
          </DialogHeader>

          {/* Step 1: Select Period */}
          {wizardStep === 1 && (
            <div className="space-y-6 pt-4">
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
                <h4 className="font-semibold text-sm mb-1">EPI Auto-Compile Wizard</h4>
                <p className="text-xs text-muted-foreground">
                  The system will automatically query the digital client registry logs and stock card ledger logs
                  to assemble your monthly WHO RED coverage metrics.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Month</label>
                  <Select
                    value={reportPeriod.month.toString()}
                    onValueChange={(v) => setReportPeriod((p) => ({ ...p, month: parseInt(v) }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pick Month" />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        "January", "February", "March", "April", "May", "June",
                        "July", "August", "September", "October", "November", "December",
                      ].map((m, idx) => (
                        <SelectItem key={m} value={(idx + 1).toString()}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Year</label>
                  <Input
                    type="number"
                    value={reportPeriod.year}
                    onChange={(e) =>
                      setReportPeriod((p) => ({ ...p, year: parseInt(e.target.value) || new Date().getFullYear() }))
                    }
                  />
                </div>
              </div>

              <DialogFooter className="pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setReportDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCompileWizardData} className="gap-1">
                  <span>Start Assembly</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Step 2: Review Compiled Coverage */}
          {wizardStep === 2 && (
            <div className="space-y-6 pt-4">
              <div className="space-y-2">
                <h3 className="font-bold text-sm">Step 2: Compiled Facility Immunization Totals</h3>
                <p className="text-xs text-muted-foreground">
                  Verify the compiled numbers aggregated from child logs for this facility in the reporting month.
                </p>
              </div>

              <div className="border rounded-md overflow-hidden bg-background">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-muted/40 font-semibold border-b">
                    <tr>
                      <th className="px-4 py-2">Vaccine / Antigen</th>
                      <th className="px-4 py-2 text-center">Compiled Vaccinations</th>
                      <th className="px-4 py-2 text-right">Manual Correction Override</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {Object.entries(compiledImmunizations).map(([name, count]) => (
                      <tr key={name}>
                        <td className="px-4 py-2 font-medium">{name}</td>
                        <td className="px-4 py-2 text-center font-bold text-primary">{count}</td>
                        <td className="px-4 py-2 text-right">
                          <Input
                            type="number"
                            className="h-7 w-20 ml-auto text-right text-xs"
                            value={compiledImmunizations[name] ?? 0}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              setCompiledImmunizations((prev) => ({
                                ...prev,
                                [name]: val,
                              }));
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <DialogFooter className="pt-4 border-t gap-2 flex justify-between">
                <Button type="button" variant="outline" onClick={() => setWizardStep(1)}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  <span>Back</span>
                </Button>
                <Button onClick={() => setWizardStep(3)} className="gap-1">
                  <span>Stock Compilation</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Step 3: Stock Summary */}
          {wizardStep === 3 && (
            <div className="space-y-6 pt-4">
              <div className="space-y-2">
                <h3 className="font-bold text-sm">Step 3: Compiled Cold Chain & Stock Ledgers</h3>
                <p className="text-xs text-muted-foreground">
                  The stock balance compilation calculates starting balances, receptions, losses, and active wastage factors.
                </p>
              </div>

              <div className="border rounded-md overflow-hidden bg-background max-h-[300px] overflow-y-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-muted/40 font-semibold border-b">
                    <tr>
                      <th className="px-3 py-2">Antigen</th>
                      <th className="px-3 py-2 text-center">Opening</th>
                      <th className="px-3 py-2 text-center">Received</th>
                      <th className="px-3 py-2 text-center">Administered</th>
                      <th className="px-3 py-2 text-center">Wasted (Loss)</th>
                      <th className="px-3 py-2 text-center">Closing</th>
                      <th className="px-3 py-2 text-right">Wastage %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {Object.entries(compiledStock).map(([name, details]: [string, any]) => {
                      const rate = Number(details.wastageRate ?? 0);
                      const status = classifyWastage(name, rate, wastageThresholds);
                      const t = getWastageThreshold(name, wastageThresholds);
                      return (
                        <tr key={name}>
                          <td className="px-3 py-2 font-medium">{name}</td>
                          <td className="px-3 py-2 text-center">{details.opening}</td>
                          <td className="px-3 py-2 text-center font-semibold text-emerald-600">{details.received}</td>
                          <td className="px-3 py-2 text-center text-primary">{details.administered}</td>
                          <td className="px-3 py-2 text-center text-destructive">{details.wasted}</td>
                          <td className="px-3 py-2 text-center font-bold">{details.closing}</td>
                          <td className="px-3 py-2 text-right">
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${wastageChipClasses(status)}`}
                              title={`WHO max ${t.max}% (warn ${t.warn}%)`}
                              data-testid={`chip-wizard-wastage-${name}`}
                              data-status={status}
                            >
                              {rate}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <DialogFooter className="pt-4 border-t gap-2 flex justify-between">
                <Button type="button" variant="outline" onClick={() => setWizardStep(2)}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  <span>Back</span>
                </Button>
                <Button onClick={() => setWizardStep(4)} className="gap-1">
                  <span>Disease Surveillance</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Step 4: Disease Surveillance */}
          {wizardStep === 4 && (
            <div className="space-y-6 pt-4">
              <div className="space-y-2">
                <h3 className="font-bold text-sm">Step 4: WHO Disease Surveillance Cases</h3>
                <p className="text-xs text-muted-foreground">
                  Record cases identified during the period for surveillance transmission. Leave zero if none.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">Measles Cases</label>
                  <Input
                    type="number"
                    value={surveillanceData.measles}
                    onChange={(e) =>
                      setSurveillanceData((p) => ({ ...p, measles: parseInt(e.target.value) || 0 }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">Acute Flaccid Paralysis (AFP) Cases</label>
                  <Input
                    type="number"
                    value={surveillanceData.afp}
                    onChange={(e) =>
                      setSurveillanceData((p) => ({ ...p, afp: parseInt(e.target.value) || 0 }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">Neonatal Tetanus (NNT) Cases</label>
                  <Input
                    type="number"
                    value={surveillanceData.nnt}
                    onChange={(e) =>
                      setSurveillanceData((p) => ({ ...p, nnt: parseInt(e.target.value) || 0 }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">AEFI Cases</label>
                  <Input
                    type="number"
                    value={surveillanceData.aefi}
                    onChange={(e) =>
                      setSurveillanceData((p) => ({ ...p, aefi: parseInt(e.target.value) || 0 }))
                    }
                  />
                </div>
              </div>

              <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400 flex gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>
                  Confirming submission locks the monthly report database and transmits it for manager review. Facility clerks cannot modify the data post-transmission.
                </span>
              </div>

              <DialogFooter className="pt-4 border-t gap-2 flex justify-between">
                <Button type="button" variant="outline" onClick={() => setWizardStep(3)}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  <span>Back</span>
                </Button>
                <Button onClick={handleSubmitMonthlyReport} disabled={saveReportMutation.isPending} className="gap-1.5 shadow-lg shadow-emerald-500/20 bg-emerald-500 hover:bg-emerald-600 text-white">
                  <CheckCircle className="h-4 w-4" />
                  <span>Lock & Submit Report</span>
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
