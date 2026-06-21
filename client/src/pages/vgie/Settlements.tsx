import { useState, useMemo, useEffect } from "react";
import { Link } from "wouter";
import {
  Search, ChevronRight, Users, Building2,
  CheckCircle, XCircle, Clock, ChevronsUpDown, ChevronUp, ChevronDown,
  SlidersHorizontal, Filter, Download, AlertTriangle, X
} from "lucide-react";
import { useGetSettlements } from "@/hooks/vgie/useVgieApi";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { GeoCascadeFilter } from "@/components/GeoCascadeFilter";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

const statusConfig = {
  served: { label: "Served", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", icon: CheckCircle },
  underserved: { label: "Underserved", color: "text-amber-400 bg-amber-500/10 border-amber-500/20", icon: Clock },
  unserved: { label: "Unserved", color: "text-red-400 bg-red-500/10 border-red-500/20", icon: XCircle },
};

const riskConfig = {
  low: { label: "Low", color: "text-muted-foreground bg-slate-500/10 border-border/20" },
  medium: { label: "Medium", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  high: { label: "High", color: "text-red-400 bg-red-500/10 border-red-500/20" },
  very_high: { label: "Very High", color: "text-red-500 bg-red-600/10 border-red-500/20" },
};

type SortKey = "name" | "province" | "district" | "facility" | "population" | "riskScore";
type SortDir = "asc" | "desc";

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown className="w-3 h-3 opacity-30 ml-1 inline shrink-0" />;
  return sortDir === "asc"
    ? <ChevronUp className="w-3 h-3 ml-1 inline text-primary shrink-0" />
    : <ChevronDown className="w-3 h-3 ml-1 inline text-primary shrink-0" />;
}

export default function Settlements() {
  // Pagination State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Search & Filter State
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [riskLevel, setRiskLevel] = useState<string>("all");
  const [provinceId, setProvinceId] = useState<number | null>(null);
  const [districtId, setDistrictId] = useState<number | null>(null);
  const [facilityId, setFacilityId] = useState<number | null>(null);

  // Sorting State
  const [sortKey, setSortKey] = useState<SortKey>("riskScore");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Column Visibility State
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    name: true,
    province: true,
    district: true,
    facility: true,
    population: true,
    status: true,
    risk: true,
    riskScore: true,
  });

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Fetch paginated settlements
  const { data: res, isLoading, error } = useGetSettlements({
    page,
    pageSize,
    search: debouncedSearch || undefined,
    status: status !== "all" ? status : undefined,
    risk: riskLevel !== "all" ? riskLevel : undefined,
    provinceId: provinceId?.toString(),
    districtId: districtId?.toString(),
    facilityId: facilityId?.toString(),
    sortBy: sortKey,
    sortOrder: sortDir,
  } as any);

  const items = res?.data?.items ?? [];
  const pagination = res?.data?.pagination;
  const counts = res?.data?.counts;
  const total = pagination?.total ?? 0;
  const totalPages = pagination?.totalPages ?? 0;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(1);
  };

  const handleClearFilters = () => {
    setStatus("all");
    setRiskLevel("all");
    setProvinceId(null);
    setDistrictId(null);
    setFacilityId(null);
    setSearch("");
    setPage(1);
  };

  // Build active filter chips for rendering
  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (debouncedSearch) {
      chips.push({ key: "search", label: `Search: "${debouncedSearch}"`, clear: () => setSearch("") });
    }
    if (status !== "all") {
      chips.push({ key: "status", label: `Status: ${status}`, clear: () => { setStatus("all"); setPage(1); } });
    }
    if (riskLevel !== "all") {
      chips.push({ key: "risk", label: `Risk: ${riskLevel.replace("_", " ")}`, clear: () => { setRiskLevel("all"); setPage(1); } });
    }
    if (provinceId) {
      chips.push({ key: "province", label: "Province filtered", clear: () => { setProvinceId(null); setDistrictId(null); setFacilityId(null); setPage(1); } });
    }
    if (districtId) {
      chips.push({ key: "district", label: "District filtered", clear: () => { setDistrictId(null); setFacilityId(null); setPage(1); } });
    }
    if (facilityId) {
      chips.push({ key: "facility", label: "Facility filtered", clear: () => { setFacilityId(null); setPage(1); } });
    }
    return chips;
  }, [debouncedSearch, status, riskLevel, provinceId, districtId, facilityId]);

  const thClass = "px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer select-none hover:text-foreground transition-colors whitespace-nowrap align-middle";

  return (
    <div className="p-6 space-y-6 flex flex-col h-screen overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Master Settlements Registry
          </h2>
          <p className="text-sm text-muted-foreground">
            Dynamic database-scanned registry of communities, catchment populations, and coverage status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Column Visibility Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs font-semibold gap-1.5 border hover:bg-accent text-foreground">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover border border-border w-48">
              <div className="px-2 py-1.5 text-xs font-bold text-muted-foreground">Toggle Columns</div>
              <DropdownMenuSeparator className="bg-border" />
              {Object.keys(visibleColumns).map((col) => (
                <DropdownMenuCheckboxItem
                  key={col}
                  checked={visibleColumns[col]}
                  onCheckedChange={(checked) => setVisibleColumns((p) => ({ ...p, [col]: checked }))}
                  className="capitalize text-xs text-foreground cursor-pointer"
                >
                  {col.replace(/([A-Z])/g, " $1")}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Export Option */}
          <Button variant="outline" size="sm" className="h-8 text-xs font-semibold gap-1.5 border hover:bg-accent text-foreground">
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* KPI Cards section matching the counts response */}
      {counts && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 shrink-0">
          <Card className="bg-card/45 border-border backdrop-blur-sm">
            <CardContent className="p-3.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Total Registered</p>
              <h3 className="text-lg font-bold text-foreground mt-1">{counts.total.toLocaleString()}</h3>
            </CardContent>
          </Card>
          <Card className="bg-card/45 border-border backdrop-blur-sm">
            <CardContent className="p-3.5">
              <p className="text-xs font-semibold text-emerald-500 uppercase">Served</p>
              <h3 className="text-lg font-bold text-emerald-400 mt-1">{counts.served.toLocaleString()}</h3>
            </CardContent>
          </Card>
          <Card className="bg-card/45 border-border backdrop-blur-sm">
            <CardContent className="p-3.5">
              <p className="text-xs font-semibold text-amber-500 uppercase">Underserved</p>
              <h3 className="text-lg font-bold text-amber-400 mt-1">{counts.underserved.toLocaleString()}</h3>
            </CardContent>
          </Card>
          <Card className="bg-card/45 border-border backdrop-blur-sm">
            <CardContent className="p-3.5">
              <p className="text-xs font-semibold text-red-500 uppercase">Unserved</p>
              <h3 className="text-lg font-bold text-red-400 mt-1">{counts.unserved.toLocaleString()}</h3>
            </CardContent>
          </Card>
          <Card className="bg-card/45 border-border backdrop-blur-sm col-span-2 md:col-span-1">
            <CardContent className="p-3.5">
              <p className="text-xs font-semibold text-purple-500 uppercase">High Risk</p>
              <h3 className="text-lg font-bold text-purple-400 mt-1">{counts.highRisk.toLocaleString()}</h3>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 shrink-0">
        <div className="relative flex-1 min-w-48 max-w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm bg-background border-border text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary"
          />
        </div>
        <Select value={status} onValueChange={(val) => { setStatus(val); setPage(1); }}>
          <SelectTrigger className="w-36 h-9 text-sm bg-background border-border text-foreground">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-background border-border">
            <SelectItem value="all" className="text-foreground">All statuses</SelectItem>
            <SelectItem value="served" className="text-foreground">Served</SelectItem>
            <SelectItem value="underserved" className="text-foreground">Underserved</SelectItem>
            <SelectItem value="unserved" className="text-foreground">Unserved</SelectItem>
          </SelectContent>
        </Select>
        <Select value={riskLevel} onValueChange={(val) => { setRiskLevel(val); setPage(1); }}>
          <SelectTrigger className="w-36 h-9 text-sm bg-background border-border text-foreground">
            <SelectValue placeholder="Risk Level" />
          </SelectTrigger>
          <SelectContent className="bg-background border-border">
            <SelectItem value="all" className="text-foreground">All risks</SelectItem>
            <SelectItem value="very_high" className="text-foreground">Very High</SelectItem>
            <SelectItem value="high" className="text-foreground">High</SelectItem>
            <SelectItem value="medium" className="text-foreground">Medium</SelectItem>
            <SelectItem value="low" className="text-foreground">Low</SelectItem>
          </SelectContent>
        </Select>
        <GeoCascadeFilter
          provinceId={provinceId}
          districtId={districtId}
          facilityId={facilityId}
          onProvinceChange={(id) => { setProvinceId(id); setDistrictId(null); setFacilityId(null); setPage(1); }}
          onDistrictChange={(id) => { setDistrictId(id); setFacilityId(null); setPage(1); }}
          onFacilityChange={(id) => { setFacilityId(id); setPage(1); }}
          showFacility={true}
        />
      </div>

      {/* Active Filter Chips */}
      {activeChips.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
            <Filter className="w-3 h-3" /> Active Filters:
          </span>
          {activeChips.map((chip) => (
            <Badge key={chip.key} variant="secondary" className="gap-1 px-2 py-0.5 text-xs text-foreground bg-muted border border-border">
              {chip.label}
              <button onClick={chip.clear} className="text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground font-semibold"
          >
            Clear all
          </Button>
        </div>
      )}

      {/* Main Table Card */}
      <Card className="bg-card/40 border-border flex-1 overflow-hidden flex flex-col backdrop-blur-sm shadow-xl">
        <div className="overflow-auto flex-1 relative">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-popover z-10 border-b border-border shadow-sm">
              <tr className="border-b border-border">
                {visibleColumns.name && (
                  <th className={`${thClass} text-left`} onClick={() => handleSort("name")}>
                    <div className="flex items-center">
                      Settlement <SortIcon col="name" sortKey={sortKey} sortDir={sortDir} />
                    </div>
                  </th>
                )}
                {visibleColumns.province && (
                  <th className={`${thClass} text-left`} onClick={() => handleSort("province")}>
                    <div className="flex items-center">
                      Province <SortIcon col="province" sortKey={sortKey} sortDir={sortDir} />
                    </div>
                  </th>
                )}
                {visibleColumns.district && (
                  <th className={`${thClass} text-left`} onClick={() => handleSort("district")}>
                    <div className="flex items-center">
                      District <SortIcon col="district" sortKey={sortKey} sortDir={sortDir} />
                    </div>
                  </th>
                )}
                {visibleColumns.facility && (
                  <th className={`${thClass} text-left`} onClick={() => handleSort("facility")}>
                    <div className="flex items-center">
                      Nearest Facility <SortIcon col="facility" sortKey={sortKey} sortDir={sortDir} />
                    </div>
                  </th>
                )}
                {visibleColumns.population && (
                  <th className={`${thClass} text-right`} onClick={() => handleSort("population")}>
                    <div className="flex items-center justify-end">
                      Population <SortIcon col="population" sortKey={sortKey} sortDir={sortDir} />
                    </div>
                  </th>
                )}
                {visibleColumns.status && (
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center align-middle">Status</th>
                )}
                {visibleColumns.risk && (
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center align-middle">Risk</th>
                )}
                {visibleColumns.riskScore && (
                  <th className={`${thClass} text-right`} onClick={() => handleSort("riskScore")}>
                    <div className="flex items-center justify-end">
                      Risk Score <SortIcon col="riskScore" sortKey={sortKey} sortDir={sortDir} />
                    </div>
                  </th>
                )}
                <th className="px-4 py-3 align-middle" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Object.keys(visibleColumns).filter(c => visibleColumns[c]).map((_, j) => (
                      <td key={j} className="px-4 py-3.5">
                        <Skeleton className="h-4 w-full bg-muted/65 rounded" />
                      </td>
                    ))}
                    <td className="px-4 py-3.5">
                      <Skeleton className="h-6 w-6 bg-muted/65 rounded-full" />
                    </td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={Object.keys(visibleColumns).filter(c => visibleColumns[c]).length + 1} className="py-12">
                    <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                      <AlertTriangle className="w-8 h-8 text-rose-500" />
                      <p className="text-sm font-semibold">Settlements could not be loaded</p>
                      <Button variant="outline" size="sm" onClick={() => setPage(page)} className="mt-2 text-foreground font-semibold">
                        Retry loading
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={Object.keys(visibleColumns).filter(c => visibleColumns[c]).length + 1} className="py-16">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Building2 className="w-10 h-10 mb-2 opacity-50" />
                      <p className="text-sm font-semibold">
                        {debouncedSearch 
                          ? "No settlements match your search" 
                          : activeChips.length > 0 
                          ? "No settlements match the selected filters" 
                          : "No settlements have been loaded for this country yet."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((s: any) => {
                  const sc = statusConfig[s.serviceStatus as keyof typeof statusConfig] ?? statusConfig.unserved;
                  const rc = s.riskLevel ? riskConfig[s.riskLevel as keyof typeof riskConfig] : null;
                  return (
                    <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                      {visibleColumns.name && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="font-semibold text-foreground truncate max-w-52">{s.name}</span>
                            {s.isNewSettlement && (
                              <Badge className="text-[10px] px-1 py-0 bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0 font-bold">NEW</Badge>
                            )}
                          </div>
                        </td>
                      )}
                      {visibleColumns.province && <td className="px-4 py-3 text-muted-foreground">{s.province}</td>}
                      {visibleColumns.district && <td className="px-4 py-3 text-muted-foreground">{s.district}</td>}
                      {visibleColumns.facility && <td className="px-4 py-3 text-muted-foreground truncate max-w-44">{s.facility || "—"}</td>}
                      {visibleColumns.population && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1 font-medium">
                            <Users className="w-3 h-3 text-muted-foreground" />
                            <span className="text-foreground">{s.population?.toLocaleString() ?? "0"}</span>
                          </div>
                        </td>
                      )}
                      {visibleColumns.status && (
                        <td className="px-4 py-3 text-center">
                          <Badge className={`text-[10px] px-1.5 py-0 border font-semibold ${sc.color}`}>{sc.label}</Badge>
                        </td>
                      )}
                      {visibleColumns.risk && (
                        <td className="px-4 py-3 text-center">
                          {rc ? (
                            <Badge className={`text-[10px] px-1.5 py-0 border font-semibold ${rc.color}`}>{rc.label}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      )}
                      {visibleColumns.riskScore && (
                        <td className="px-4 py-3 text-right">
                          {s.riskScore != null ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden shrink-0">
                                <div
                                  className={`h-full rounded-full ${s.riskScore >= 75 ? "bg-red-500" : s.riskScore >= 50 ? "bg-amber-500" : s.riskScore >= 25 ? "bg-yellow-500" : "bg-emerald-500"}`}
                                  style={{ width: `${s.riskScore}%` }}
                                />
                              </div>
                              <span className="text-muted-foreground text-xs w-6 text-right font-medium">{s.riskScore}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3 text-right">
                        <Link href={`/settlements/${s.id}`}>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full">
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination Controls */}
        {!isLoading && !error && total > 0 && (
          <div className="flex items-center justify-between p-4 border-t border-border bg-muted/10 shrink-0 flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground font-semibold">
              <span>Rows per page:</span>
              <Select
                value={String(pageSize)}
                onValueChange={(val) => {
                  setPageSize(Number(val));
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-18 text-xs bg-background border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border-border">
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              <span className="hidden sm:inline">
                Showing {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, total)} of {total.toLocaleString()} settlements
              </span>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 hover:bg-accent border text-foreground"
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                >
                  {"<<"}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 hover:bg-accent border text-foreground"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  {"<"}
                </Button>

                {/* Visible page number indicators */}
                {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                  let pageNum = page;
                  if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  
                  // Safe bounds check
                  if (pageNum < 1 || pageNum > totalPages) return null;

                  return (
                    <Button
                      key={pageNum}
                      variant={page === pageNum ? "default" : "outline"}
                      className={`h-8 w-8 text-xs font-bold ${page === pageNum ? "bg-primary text-primary-foreground hover:bg-primary/90" : "hover:bg-accent text-foreground"}`}
                      onClick={() => setPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}

                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 hover:bg-accent border text-foreground"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  {">"}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 hover:bg-accent border text-foreground"
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                >
                  {">>"}
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
