import { useState, useMemo } from "react";
import { Link } from "wouter";
import {
  Hospital, Search, Building2, ChevronRight, ChevronUp, ChevronDown,
  ChevronsLeft, ChevronsRight, ChevronLeft
} from "lucide-react";
import { useGetFacilities } from "@/hooks/vgie/useVgieApi";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type FacilityRow = {
  id: number;
  name: string;
  type: string;
  district: string;
  province: string | null;
  hmisCode: string | null;
  ownership: string | null;
  catchmentRadiusKm: number;
  catchmentPopulation: number | null;
  servedSettlementsCount: number;
  totalCatchmentPopulation: number;
  latitude: number;
  longitude: number;
};

type SortKey = "name" | "district" | "province" | "type" | "ownership" | "catchmentRadiusKm" | "catchmentPopulation" | "servedSettlementsCount";
type SortDir = "asc" | "desc";

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

const typeColors: Record<string, string> = {
  "Hospital - Level 3":              "text-purple-400 bg-purple-500/10 border-purple-500/20",
  "Hospital - Level 2":              "text-blue-400 bg-blue-500/10 border-blue-500/20",
  "Hospital - Level 1":              "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
  "Hospital Affiliated Health Centre": "text-violet-400 bg-violet-500/10 border-violet-500/20",
  "Zonal Health Centre":             "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  "Urban Health Centre":             "text-teal-400 bg-teal-500/10 border-teal-500/20",
  "Rural Health Centre":             "text-amber-400 bg-amber-500/10 border-amber-500/20",
  "Health Post":                     "text-slate-400 bg-slate-500/10 border-slate-500/20",
  "Border Health Post":              "text-orange-400 bg-orange-500/10 border-orange-500/20",
};

const ownershipColors: Record<string, string> = {
  GRZ:     "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  NGO:     "text-blue-400 bg-blue-500/10 border-blue-500/20",
  Private: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  Military:"text-slate-400 bg-slate-500/10 border-slate-500/20",
  Police:  "text-orange-400 bg-orange-500/10 border-orange-500/20",
};

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronUp className="w-3 h-3 opacity-20" />;
  return sortDir === "asc"
    ? <ChevronUp className="w-3 h-3 text-emerald-400" />
    : <ChevronDown className="w-3 h-3 text-emerald-400" />;
}

function Th({
  label, col, sortKey, sortDir, onSort, className = "",
}: {
  label: string; col: SortKey; sortKey: SortKey; sortDir: SortDir;
  onSort: (c: SortKey) => void; className?: string;
}) {
  return (
    <th
      className={`px-3 py-2.5 text-left text-[11px] font-medium text-slate-400 uppercase tracking-wide cursor-pointer select-none whitespace-nowrap hover:text-slate-200 transition-colors ${className}`}
      onClick={() => onSort(col)}
    >
      <span className="flex items-center gap-1">
        {label}
        <SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
      </span>
    </th>
  );
}

export default function Facilities() {
  const [search, setSearch]           = useState("");
  const [province, setProvince]       = useState("all");
  const [facilityType, setFacilityType] = useState("all");
  const [sortKey, setSortKey]         = useState<SortKey>("name");
  const [sortDir, setSortDir]         = useState<SortDir>("asc");
  const [page, setPage]               = useState(1);
  const [pageSize, setPageSize]       = useState(50);

  const { data: raw, isLoading } = useGetFacilities();
  const facilities = (raw ?? []) as unknown as FacilityRow[];

  const provinces = useMemo(() => {
    const s = new Set<string>();
    facilities.forEach(f => { if (f.province) s.add(f.province); });
    return Array.from(s).sort();
  }, [facilities]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return facilities.filter(f => {
      if (province !== "all" && f.province !== province) return false;
      if (facilityType !== "all" && f.type !== facilityType) return false;
      if (q && !f.name.toLowerCase().includes(q) &&
              !f.district.toLowerCase().includes(q) &&
              !(f.province ?? "").toLowerCase().includes(q) &&
              !(f.hmisCode ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [facilities, search, province, facilityType]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av: string | number | null, bv: string | number | null;
      switch (sortKey) {
        case "name":                   av = a.name; bv = b.name; break;
        case "district":               av = a.district; bv = b.district; break;
        case "province":               av = a.province ?? ""; bv = b.province ?? ""; break;
        case "type":                   av = a.type; bv = b.type; break;
        case "ownership":              av = a.ownership ?? ""; bv = b.ownership ?? ""; break;
        case "catchmentRadiusKm":      av = a.catchmentRadiusKm; bv = b.catchmentRadiusKm; break;
        case "catchmentPopulation":    av = a.catchmentPopulation ?? 0; bv = b.catchmentPopulation ?? 0; break;
        case "servedSettlementsCount": av = a.servedSettlementsCount; bv = b.servedSettlementsCount; break;
        default: return 0;
      }
      if (av === null || av === undefined) av = "";
      if (bv === null || bv === undefined) bv = "";
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage   = Math.min(page, totalPages);
  const pageStart  = (safePage - 1) * pageSize;
  const pageRows   = sorted.slice(pageStart, pageStart + pageSize);

  function handleSort(col: SortKey) {
    if (col === sortKey) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(col); setSortDir("asc"); }
    setPage(1);
  }

  function handleFilterChange(fn: () => void) { fn(); setPage(1); }

  const totalPop    = facilities.reduce((s, f) => s + (f.totalCatchmentPopulation ?? 0), 0);
  const totalServed = facilities.reduce((s, f) => s + (f.servedSettlementsCount ?? 0), 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="px-6 pt-5 pb-3 shrink-0 space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Health Facilities</h2>
          <p className="text-sm text-slate-500">
            {isLoading ? "Loading…" : `${filtered.length.toLocaleString()} of ${facilities.length.toLocaleString()} facilities · ${totalServed} served settlements · ${totalPop.toLocaleString()} catchment pop.`}
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <Input
              placeholder="Search name, district, province, HMIS…"
              value={search}
              onChange={e => handleFilterChange(() => setSearch(e.target.value))}
              className="pl-8 h-8 text-sm bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-600 w-72"
            />
          </div>
          <Select value={province} onValueChange={v => handleFilterChange(() => setProvince(v))}>
            <SelectTrigger className="w-40 h-8 text-sm bg-slate-900 border-slate-700 text-slate-300">
              <SelectValue placeholder="Province" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700 max-h-60">
              <SelectItem value="all" className="text-slate-300">All provinces</SelectItem>
              {provinces.map(p => (
                <SelectItem key={p} value={p} className="text-slate-300">{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={facilityType} onValueChange={v => handleFilterChange(() => setFacilityType(v))}>
            <SelectTrigger className="w-44 h-8 text-sm bg-slate-900 border-slate-700 text-slate-300">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700 max-h-60">
              <SelectItem value="all" className="text-slate-300">All types</SelectItem>
              {Object.keys(typeColors).map(t => (
                <SelectItem key={t} value={t} className="text-slate-300">{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(search || province !== "all" || facilityType !== "all") && (
            <Button variant="ghost" size="sm" className="h-8 text-xs text-slate-500 hover:text-slate-300"
              onClick={() => handleFilterChange(() => { setSearch(""); setProvince("all"); setFacilityType("all"); })}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Table + pagination wrapper */}
      <div className="flex-1 overflow-auto min-h-0 px-6 pb-4">
        <div className="rounded-lg border border-slate-800 overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800">
              <tr>
                <Th label="Name"        col="name"                sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="min-w-[220px]" />
                <Th label="District"    col="district"            sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <Th label="Province"    col="province"            sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <Th label="Type"        col="type"                sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="min-w-[160px]" />
                <Th label="Ownership"   col="ownership"           sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <th className="px-3 py-2.5 text-left text-[11px] font-medium text-slate-400 uppercase tracking-wide whitespace-nowrap">
                  HMIS Code
                </th>
                <Th label="Catchment"   col="catchmentRadiusKm"   sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="text-right" />
                <Th label="Pop."        col="catchmentPopulation"  sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="text-right" />
                <Th label="Served"      col="servedSettlementsCount" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="text-right" />
                <th className="px-3 py-2.5 w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading
                ? Array.from({ length: 12 }).map((_, i) => (
                    <tr key={i} className="bg-slate-950">
                      {Array.from({ length: 10 }).map((__, j) => (
                        <td key={j} className="px-3 py-2.5">
                          <Skeleton className="h-4 bg-slate-800 rounded" style={{ width: j === 0 ? 180 : j === 3 ? 120 : 60 }} />
                        </td>
                      ))}
                    </tr>
                  ))
                : pageRows.map((f, idx) => {
                    const typeColor  = typeColors[f.type]           ?? "text-slate-400 bg-slate-500/10 border-slate-500/20";
                    const ownColor   = ownershipColors[f.ownership ?? ""] ?? "text-slate-400 bg-slate-500/10 border-slate-500/20";
                    const rowBg      = idx % 2 === 0 ? "bg-slate-950" : "bg-slate-900/30";
                    return (
                      <tr key={f.id} className={`${rowBg} hover:bg-slate-800/50 transition-colors group`}>
                        {/* Name */}
                        <td className="px-3 py-2.5">
                          <span className="text-slate-200 font-medium text-xs leading-snug line-clamp-2">{f.name}</span>
                        </td>
                        {/* District */}
                        <td className="px-3 py-2.5 text-xs text-slate-400 whitespace-nowrap">{f.district}</td>
                        {/* Province */}
                        <td className="px-3 py-2.5 text-xs text-slate-400 whitespace-nowrap">{f.province ?? "—"}</td>
                        {/* Type */}
                        <td className="px-3 py-2.5">
                          <Badge className={`text-[10px] px-1.5 py-0 border whitespace-nowrap ${typeColor}`}>{f.type}</Badge>
                        </td>
                        {/* Ownership */}
                        <td className="px-3 py-2.5">
                          {f.ownership
                            ? <Badge className={`text-[10px] px-1.5 py-0 border ${ownColor}`}>{f.ownership}</Badge>
                            : <span className="text-slate-600 text-xs">—</span>}
                        </td>
                        {/* HMIS */}
                        <td className="px-3 py-2.5">
                          {f.hmisCode
                            ? <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                                <Building2 className="w-2.5 h-2.5 shrink-0" />{f.hmisCode}
                              </span>
                            : <span className="text-slate-600 text-xs">—</span>}
                        </td>
                        {/* Catchment radius */}
                        <td className="px-3 py-2.5 text-xs text-slate-400 text-right whitespace-nowrap">
                          {f.catchmentRadiusKm} km
                        </td>
                        {/* Population */}
                        <td className="px-3 py-2.5 text-xs text-slate-400 text-right whitespace-nowrap">
                          {f.catchmentPopulation != null ? f.catchmentPopulation.toLocaleString() : "—"}
                        </td>
                        {/* Served */}
                        <td className="px-3 py-2.5 text-right">
                          <span className={`text-xs font-medium ${f.servedSettlementsCount > 0 ? "text-emerald-400" : "text-slate-600"}`}>
                            {f.servedSettlementsCount}
                          </span>
                        </td>
                        {/* Details */}
                        <td className="px-3 py-2.5 text-right">
                          <Link href={`/facilities/${f.id}`}>
                            <button className="text-[11px] text-emerald-500 hover:text-emerald-400 flex items-center gap-0.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                              Details <ChevronRight className="w-3 h-3" />
                            </button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>

          {!isLoading && pageRows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-600">
              <Hospital className="w-8 h-8 mb-2" />
              <p className="text-sm">No facilities match your filters</p>
            </div>
          )}
        </div>
      </div>

      {/* Pagination footer */}
      {!isLoading && sorted.length > 0 && (
        <div className="shrink-0 px-6 pb-4 flex items-center justify-between gap-4 text-xs text-slate-500">
          {/* Left: rows per page + count */}
          <div className="flex items-center gap-3">
            <span>Rows per page</span>
            <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(1); }}>
              <SelectTrigger className="w-16 h-7 text-xs bg-slate-900 border-slate-700 text-slate-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                {PAGE_SIZE_OPTIONS.map(n => (
                  <SelectItem key={n} value={String(n)} className="text-slate-300 text-xs">{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-slate-600">
              {pageStart + 1}–{Math.min(pageStart + pageSize, sorted.length)} of {sorted.length.toLocaleString()}
            </span>
          </div>

          {/* Right: page navigation */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="w-7 h-7 text-slate-400 hover:text-slate-100 hover:bg-slate-800 disabled:opacity-30"
              disabled={safePage === 1} onClick={() => setPage(1)}>
              <ChevronsLeft className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="w-7 h-7 text-slate-400 hover:text-slate-100 hover:bg-slate-800 disabled:opacity-30"
              disabled={safePage === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>

            {/* Page number pills */}
            {(() => {
              const pages: (number | "…")[] = [];
              const delta = 2;
              const left  = Math.max(2, safePage - delta);
              const right = Math.min(totalPages - 1, safePage + delta);
              pages.push(1);
              if (left > 2) pages.push("…");
              for (let i = left; i <= right; i++) pages.push(i);
              if (right < totalPages - 1) pages.push("…");
              if (totalPages > 1) pages.push(totalPages);
              return pages.map((p, i) =>
                p === "…"
                  ? <span key={`e${i}`} className="px-1 text-slate-600">…</span>
                  : <button key={p}
                      onClick={() => setPage(p as number)}
                      className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                        p === safePage
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                      }`}>
                      {p}
                    </button>
              );
            })()}

            <Button variant="ghost" size="icon" className="w-7 h-7 text-slate-400 hover:text-slate-100 hover:bg-slate-800 disabled:opacity-30"
              disabled={safePage === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="w-7 h-7 text-slate-400 hover:text-slate-100 hover:bg-slate-800 disabled:opacity-30"
              disabled={safePage === totalPages} onClick={() => setPage(totalPages)}>
              <ChevronsRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
