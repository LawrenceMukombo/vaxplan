import { useState, useMemo } from "react";
import { Link } from "wouter";
import {
  Search, ChevronRight, Users, Building2,
  CheckCircle, XCircle, Clock, ChevronsUpDown, ChevronUp, ChevronDown
} from "lucide-react";
import { useGetSettlements } from "@/hooks/vgie/useVgieApi";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

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

type SortKey = "name" | "district" | "population" | "riskScore";
type SortDir = "asc" | "desc";

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown className="w-3 h-3 opacity-30 ml-1 inline" />;
  return sortDir === "asc"
    ? <ChevronUp className="w-3 h-3 ml-1 inline text-emerald-400" />
    : <ChevronDown className="w-3 h-3 ml-1 inline text-emerald-400" />;
}

export default function Settlements() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [riskLevel, setRiskLevel] = useState<string>("all");
  const [district, setDistrict] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("riskScore");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { data: settlements, isLoading } = useGetSettlements({
    status: status !== "all" ? status : undefined,
    riskLevel: riskLevel !== "all" ? riskLevel : undefined,
    district: district !== "all" ? district : undefined,
    search: search || undefined,
  } as any);

  const sorted = useMemo(() => {
    if (!settlements) return [];
    return [...settlements].sort((a, b) => {
      let av: any = a[sortKey];
      let bv: any = b[sortKey];
      if (av == null) av = sortDir === "asc" ? Infinity : -Infinity;
      if (bv == null) bv = sortDir === "asc" ? Infinity : -Infinity;
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [settlements, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const thClass = "px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer select-none hover:text-foreground transition-colors whitespace-nowrap";

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Settlements</h2>
          <p className="text-sm text-muted-foreground">{sorted.length} settlements found</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48 max-w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search settlements..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm bg-background border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36 h-8 text-sm bg-background border-border text-foreground">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-background border-border">
            <SelectItem value="all" className="text-foreground">All statuses</SelectItem>
            <SelectItem value="served" className="text-foreground">Served</SelectItem>
            <SelectItem value="underserved" className="text-foreground">Underserved</SelectItem>
            <SelectItem value="unserved" className="text-foreground">Unserved</SelectItem>
          </SelectContent>
        </Select>
        <Select value={riskLevel} onValueChange={setRiskLevel}>
          <SelectTrigger className="w-36 h-8 text-sm bg-background border-border text-foreground">
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
        <Select value={district} onValueChange={setDistrict}>
          <SelectTrigger className="w-36 h-8 text-sm bg-background border-border text-foreground">
            <SelectValue placeholder="District" />
          </SelectTrigger>
          <SelectContent className="bg-background border-border">
            <SelectItem value="all" className="text-foreground">All districts</SelectItem>
            <SelectItem value="Lusaka" className="text-foreground">Lusaka</SelectItem>
            <SelectItem value="Kafue" className="text-foreground">Kafue</SelectItem>
            <SelectItem value="Chilanga" className="text-foreground">Chilanga</SelectItem>
          </SelectContent>
        </Select>
        {(status !== "all" || riskLevel !== "all" || district !== "all" || search) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => { setStatus("all"); setRiskLevel("all"); setDistrict("all"); setSearch(""); }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Table */}
      <Card className="bg-card border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className={`${thClass} text-left`} onClick={() => handleSort("name")}>
                  Settlement <SortIcon col="name" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th className={`${thClass} text-left`} onClick={() => handleSort("district")}>
                  District <SortIcon col="district" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th className={`${thClass} text-right`} onClick={() => handleSort("population")}>
                  Population <SortIcon col="population" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider text-center">Status</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider text-center">Risk</th>
                <th className={`${thClass} text-right`} onClick={() => handleSort("riskScore")}>
                  Risk Score <SortIcon col="riskScore" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <Skeleton className="h-4 bg-muted rounded" />
                        </td>
                      ))}
                    </tr>
                  ))
                  : sorted.map((s: any) => {
                      const sc = statusConfig[s.serviceStatus as keyof typeof statusConfig] ?? statusConfig.unserved;
                      const rc = s.riskLevel ? riskConfig[s.riskLevel as keyof typeof riskConfig] : null;
                    return (
                      <tr key={s.id} className="hover:bg-muted transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="font-medium text-foreground truncate max-w-52">{s.name}</span>
                            {s.isNewSettlement && (
                              <Badge className="text-[10px] px-1 py-0 bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">NEW</Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{s.district}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Users className="w-3 h-3 text-muted-foreground" />
                            <span className="text-foreground">{s.population.toLocaleString()}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge className={`text-[10px] px-1.5 py-0 border ${sc.color}`}>{sc.label}</Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {rc ? (
                            <Badge className={`text-[10px] px-1.5 py-0 border ${rc.color}`}>{rc.label}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {s.riskScore != null ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${s.riskScore >= 75 ? "bg-red-500" : s.riskScore >= 50 ? "bg-amber-500" : s.riskScore >= 25 ? "bg-yellow-500" : "bg-emerald-500"}`}
                                  style={{ width: `${s.riskScore}%` }}
                                />
                              </div>
                              <span className="text-muted-foreground text-xs w-6 text-right">{s.riskScore}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/settlements/${s.id}`}>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground">
                              <ChevronRight className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
          {!isLoading && sorted.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Building2 className="w-8 h-8 mb-2" />
              <p className="text-sm">No settlements match your filters</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
