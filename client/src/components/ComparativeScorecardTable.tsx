import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Award,
  Building2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Filter,
  ArrowUpDown,
  Search,
  Columns,
  Layers,
  MapPin,
  ListChecks,
} from "lucide-react";
import {
  computeChecklistScore,
  computeSectionScores,
  getScoreTrafficLight,
  getRiskClassification,
  type ChecklistAnswer,
} from "@shared/supervisionChecklist";

import { useQuery } from "@tanstack/react-query";

export interface ComparativeScorecardRow {
  id: string | number;
  name: string;
  scopeType: "province" | "district" | "facility";
  parentName?: string;
  totalVisits: number;
  conductedVisits: number;
  avgScore: number;
  riskLevel: "low" | "medium" | "high";
  riskLabel: string;
  sectionScores: Record<string, number>; // sectionTitle -> score %
  rawFacility?: any;
  rawLastVisit?: any;
}

export interface ComparativeScorecardTableProps {
  visits: any[];
  facilities: any[];
  districts: any[];
  onSelectFacility?: (facility: any, visit?: any) => void;
}

export function ComparativeScorecardTable({
  visits,
  facilities,
  districts,
  onSelectFacility,
}: ComparativeScorecardTableProps) {
  const [scope, setScope] = useState<"province" | "district" | "facility">("facility");
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<string>("avgScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Column visibility state
  const [visibleSections, setVisibleSections] = useState<Record<string, boolean>>({});

  const { data: provinces = [] } = useQuery<any[]>({ queryKey: ["/api/provinces"] });

  const provById = useMemo(() => {
    const m = new Map<number, any>();
    provinces.forEach((p) => m.set(p.id, p));
    return m;
  }, [provinces]);

  const distById = useMemo(() => {
    const m = new Map<number, any>();
    districts.forEach((d) => m.set(d.id, d));
    return m;
  }, [districts]);

  // Helper to get clean province name for a facility
  const getFacilityProvinceName = (f: any): string => {
    if (f.province && f.province.trim() && f.province !== "Unassigned Province") {
      return f.province;
    }
    if (f.districtId && distById.has(f.districtId)) {
      const d = distById.get(f.districtId);
      if (d?.provinceId && provById.has(d.provinceId)) {
        return provById.get(d.provinceId).name;
      }
      if (d?.provinceName) return d.provinceName;
      if (d?.name) return `${d.name} Region`;
    }
    return "National Scope";
  };

  // Extract all unique section titles across visits
  const allSectionTitles = useMemo(() => {
    const titlesSet = new Set<string>();
    visits.forEach((v) => {
      if (Array.isArray(v.checklist)) {
        v.checklist.forEach((a: ChecklistAnswer) => {
          if (a.sectionTitle) titlesSet.add(a.sectionTitle);
        });
      }
    });
    return Array.from(titlesSet);
  }, [visits]);

  // Initialize visible sections map if empty
  useMemo(() => {
    if (Object.keys(visibleSections).length === 0 && allSectionTitles.length > 0) {
      const initial: Record<string, boolean> = {};
      allSectionTitles.forEach((t, i) => {
        initial[t] = i < 4; // default show first 4 section columns
      });
      setVisibleSections(initial);
    }
  }, [allSectionTitles]);

  // Aggregate rows based on selected scope
  const aggregatedRows = useMemo(() => {
    const conductedVisits = visits.filter((v) => v.status === "conducted" && v.checklist);

    if (scope === "facility") {
      const rows: ComparativeScorecardRow[] = facilities.map((f) => {
        const facVisits = conductedVisits.filter((v) => v.facilityId === f.id);
        const lastVisit = facVisits.sort((a, b) => +new Date(b.conductedDate || b.scheduledDate) - +new Date(a.conductedDate || a.scheduledDate))[0];
        const score = lastVisit && typeof lastVisit.score === "number" ? lastVisit.score : lastVisit?.checklist ? computeChecklistScore(lastVisit.checklist) : 0;
        const r = getRiskClassification(score);

        const secScoresMap: Record<string, number> = {};
        if (lastVisit?.checklist) {
          const secSummaries = computeSectionScores(lastVisit.checklist);
          secSummaries.forEach((s) => {
            secScoresMap[s.sectionTitle] = s.score;
          });
        }

        const distName = f.districtId ? distById.get(f.districtId)?.name || getFacilityProvinceName(f) : getFacilityProvinceName(f);

        return {
          id: f.id,
          name: f.name,
          scopeType: "facility",
          parentName: distName,
          totalVisits: visits.filter((v) => v.facilityId === f.id).length,
          conductedVisits: facVisits.length,
          avgScore: score,
          riskLevel: r.level,
          riskLabel: r.label,
          sectionScores: secScoresMap,
          rawFacility: f,
          rawLastVisit: lastVisit,
        };
      });
      return rows;
    }

    if (scope === "district") {
      // Group facilities by district
      const distGroups = new Map<number, { districtName: string; provinceName?: string; facs: any[] }>();
      facilities.forEach((f) => {
        const did = f.districtId || 0;
        const dName = distById.get(did)?.name || `District #${did}`;
        const pName = getFacilityProvinceName(f);
        if (!distGroups.has(did)) {
          distGroups.set(did, { districtName: dName, provinceName: pName, facs: [] });
        }
        distGroups.get(did)!.facs.push(f);
      });

      const rows: ComparativeScorecardRow[] = Array.from(distGroups.entries()).map(([did, grp]) => {
        const facIds = new Set(grp.facs.map((f) => f.id));
        const distVisits = conductedVisits.filter((v) => facIds.has(v.facilityId));
        
        let scoreSum = 0;
        let scoreCount = 0;
        const secSumMap: Record<string, { sum: number; count: number }> = {};

        distVisits.forEach((v) => {
          const s = typeof v.score === "number" ? v.score : computeChecklistScore(v.checklist || []);
          scoreSum += s;
          scoreCount += 1;

          if (v.checklist) {
            const secSummaries = computeSectionScores(v.checklist);
            secSummaries.forEach((sec) => {
              if (!secSumMap[sec.sectionTitle]) secSumMap[sec.sectionTitle] = { sum: 0, count: 0 };
              secSumMap[sec.sectionTitle].sum += sec.score;
              secSumMap[sec.sectionTitle].count += 1;
            });
          }
        });

        const avgScore = scoreCount > 0 ? Math.round(scoreSum / scoreCount) : 0;
        const r = getRiskClassification(avgScore);

        const secScoresMap: Record<string, number> = {};
        Object.entries(secSumMap).forEach(([t, val]) => {
          secScoresMap[t] = val.count > 0 ? Math.round(val.sum / val.count) : 0;
        });

        return {
          id: `dist-${did}`,
          name: grp.districtName,
          scopeType: "district",
          parentName: grp.provinceName || "Province",
          totalVisits: visits.filter((v) => facIds.has(v.facilityId)).length,
          conductedVisits: distVisits.length,
          avgScore,
          riskLevel: r.level,
          riskLabel: r.label,
          sectionScores: secScoresMap,
        };
      });
      return rows;
    }

    // Province Scope
    const provGroups = new Map<string, any[]>();
    facilities.forEach((f) => {
      const pname = getFacilityProvinceName(f);
      if (!provGroups.has(pname)) provGroups.set(pname, []);
      provGroups.get(pname)!.push(f);
    });

    const rows: ComparativeScorecardRow[] = Array.from(provGroups.entries()).map(([pname, facs]) => {
      const facIds = new Set(facs.map((f) => f.id));
      const provVisits = conductedVisits.filter((v) => facIds.has(v.facilityId));

      let scoreSum = 0;
      let scoreCount = 0;
      const secSumMap: Record<string, { sum: number; count: number }> = {};

      provVisits.forEach((v) => {
        const s = typeof v.score === "number" ? v.score : computeChecklistScore(v.checklist || []);
        scoreSum += s;
        scoreCount += 1;

        if (v.checklist) {
          const secSummaries = computeSectionScores(v.checklist);
          secSummaries.forEach((sec) => {
            if (!secSumMap[sec.sectionTitle]) secSumMap[sec.sectionTitle] = { sum: 0, count: 0 };
            secSumMap[sec.sectionTitle].sum += sec.score;
            secSumMap[sec.sectionTitle].count += 1;
          });
        }
      });

      const avgScore = scoreCount > 0 ? Math.round(scoreSum / scoreCount) : 0;
      const r = getRiskClassification(avgScore);

      const secScoresMap: Record<string, number> = {};
      Object.entries(secSumMap).forEach(([t, val]) => {
        secScoresMap[t] = val.count > 0 ? Math.round(val.sum / val.count) : 0;
      });

      return {
        id: `prov-${pname}`,
        name: pname,
        scopeType: "province",
        parentName: "National Scope",
        totalVisits: visits.filter((v) => facIds.has(v.facilityId)).length,
        conductedVisits: provVisits.length,
        avgScore,
        riskLevel: r.level,
        riskLabel: r.label,
        sectionScores: secScoresMap,
      };
    });
    return rows;
  }, [scope, visits, facilities, distById, provById]);

  // Filtering
  const filteredRows = useMemo(() => {
    return aggregatedRows.filter((r) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || r.name.toLowerCase().includes(q) || (r.parentName && r.parentName.toLowerCase().includes(q));
      const matchesRisk = riskFilter === "all" || r.riskLevel === riskFilter;
      return matchesSearch && matchesRisk;
    });
  }, [aggregatedRows, searchQuery, riskFilter]);

  // Sorting
  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      let valA: any = a[sortKey as keyof ComparativeScorecardRow];
      let valB: any = b[sortKey as keyof ComparativeScorecardRow];

      if (sortKey.startsWith("sec_")) {
        const secTitle = sortKey.replace("sec_", "");
        valA = a.sectionScores[secTitle] ?? -1;
        valB = b.sectionScores[secTitle] ?? -1;
      }

      if (typeof valA === "string") {
        return sortDir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortDir === "asc" ? (valA ?? 0) - (valB ?? 0) : (valB ?? 0) - (valA ?? 0);
    });
  }, [filteredRows, sortKey, sortDir]);

  // Pagination
  const totalPages = Math.ceil(sortedRows.length / pageSize) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = sortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ["Name", "Parent Boundary", "Scope", "Total Visits", "Conducted Visits", "Average Score %", "Risk Level"];
    const activeSecTitles = allSectionTitles.filter((t) => visibleSections[t]);
    headers.push(...activeSecTitles);

    const rows = sortedRows.map((r) => {
      const rowData = [
        `"${r.name.replace(/"/g, '""')}"`,
        `"${(r.parentName || "").replace(/"/g, '""')}"`,
        r.scopeType,
        r.totalVisits,
        r.conductedVisits,
        `${r.avgScore}%`,
        r.riskLevel,
      ];
      activeSecTitles.forEach((t) => {
        rowData.push(`${r.sectionScores[t] ?? 0}%`);
      });
      return rowData.join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Supportive_Supervision_Comparative_Scorecard_${scope}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card className="shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Comparative Supervision Scorecard Matrix
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Compare supportive supervision quality scores across Provinces, Districts, and Health Facilities.
            </CardDescription>
          </div>

          {/* Scope Selector Toggle Buttons */}
          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg self-start lg:self-auto">
            <Button
              size="sm"
              variant={scope === "province" ? "default" : "ghost"}
              onClick={() => { setScope("province"); setPage(1); }}
              className="text-xs h-7 px-3"
            >
              Provinces ({facilities.reduce((acc, f) => acc.add(f.province), new Set()).size})
            </Button>
            <Button
              size="sm"
              variant={scope === "district" ? "default" : "ghost"}
              onClick={() => { setScope("district"); setPage(1); }}
              className="text-xs h-7 px-3"
            >
              Districts ({districts.length || "—"})
            </Button>
            <Button
              size="sm"
              variant={scope === "facility" ? "default" : "ghost"}
              onClick={() => { setScope("facility"); setPage(1); }}
              className="text-xs h-7 px-3"
            >
              Health Facilities ({facilities.length})
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Controls Bar: Search, Risk Filter, Column Picker, Export */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Search ${scope}s...`}
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="pl-9 text-xs h-9"
              />
            </div>

            <Select value={riskFilter} onValueChange={(v) => { setRiskFilter(v); setPage(1); }}>
              <SelectTrigger className="w-36 h-9 text-xs">
                <SelectValue placeholder="Risk level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risk Levels</SelectItem>
                <SelectItem value="high">High Risk (&lt; 50%)</SelectItem>
                <SelectItem value="medium">Medium Risk (50-79%)</SelectItem>
                <SelectItem value="low">Low Risk (&ge; 80%)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Column Picker Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline" className="text-xs h-9 gap-1.5">
                  <Columns className="h-4 w-4" />
                  Columns
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3 text-xs space-y-2" align="end">
                <div className="font-semibold text-foreground border-b pb-1.5">
                  Visible Section Columns
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {allSectionTitles.map((t) => (
                    <label key={t} className="flex items-center gap-2 cursor-pointer text-xs">
                      <Checkbox
                        checked={visibleSections[t] !== false}
                        onCheckedChange={(c) => setVisibleSections((prev) => ({ ...prev, [t]: !!c }))}
                      />
                      <span className="truncate">{t}</span>
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* CSV Export Button */}
            <Button size="sm" variant="outline" onClick={handleExportCSV} className="text-xs h-9 gap-1.5">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Enterprise Data Table */}
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead
                  className="cursor-pointer font-semibold text-xs min-w-[180px]"
                  onClick={() => toggleSort("name")}
                >
                  <div className="flex items-center gap-1">
                    {scope === "province" ? "Province" : scope === "district" ? "District" : "Health Facility"}
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>

                <TableHead className="font-semibold text-xs min-w-[120px]">
                  Parent Boundary
                </TableHead>

                <TableHead
                  className="cursor-pointer font-semibold text-xs text-center min-w-[100px]"
                  onClick={() => toggleSort("conductedVisits")}
                >
                  <div className="flex items-center justify-center gap-1">
                    Visits
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>

                <TableHead
                  className="cursor-pointer font-semibold text-xs text-center min-w-[130px]"
                  onClick={() => toggleSort("avgScore")}
                >
                  <div className="flex items-center justify-center gap-1">
                    Overall Score
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>

                {/* Dynamic Section Columns */}
                {allSectionTitles.map((secTitle) => {
                  if (visibleSections[secTitle] === false) return null;
                  return (
                    <TableHead
                      key={secTitle}
                      className="cursor-pointer font-semibold text-xs text-center min-w-[140px] max-w-[180px] py-2.5 align-bottom"
                      onClick={() => toggleSort(`sec_${secTitle}`)}
                    >
                      <div className="flex items-center justify-center gap-1 leading-snug whitespace-normal break-words text-center">
                        <span>{secTitle}</span>
                        <ArrowUpDown className="h-3 w-3 shrink-0" />
                      </div>
                    </TableHead>
                  );
                })}

                <TableHead className="font-semibold text-xs text-right min-w-[100px]">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {paginatedRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5 + allSectionTitles.filter((t) => visibleSections[t] !== false).length}
                    className="text-center py-8 text-xs text-muted-foreground italic"
                  >
                    No matching comparative scorecard records found.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRows.map((row) => {
                  const trafficLight = getScoreTrafficLight(row.avgScore);
                  return (
                    <TableRow
                      key={row.id}
                      className="hover:bg-muted/40 transition-colors cursor-pointer"
                      onClick={() => {
                        if (row.scopeType === "facility" && row.rawFacility && onSelectFacility) {
                          onSelectFacility(row.rawFacility, row.rawLastVisit);
                        }
                      }}
                    >
                      <TableCell className="font-medium text-xs">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-primary shrink-0" />
                          <span className="font-semibold text-foreground">{row.name}</span>
                        </div>
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground">
                        {row.parentName || "—"}
                      </TableCell>

                      <TableCell className="text-center text-xs">
                        <Badge variant="secondary" className="font-mono text-[11px]">
                          {row.conductedVisits} / {row.totalVisits}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Badge variant="outline" className={`font-mono text-xs font-bold ${trafficLight.badgeClass}`}>
                            {row.avgScore}%
                          </Badge>
                          <Progress value={row.avgScore} className="h-1.5 w-16" />
                        </div>
                      </TableCell>

                      {/* Dynamic Section Cells */}
                      {allSectionTitles.map((secTitle) => {
                        if (visibleSections[secTitle] === false) return null;
                        const scoreVal = row.sectionScores[secTitle];
                        const secLight = typeof scoreVal === "number" ? getScoreTrafficLight(scoreVal) : null;
                        return (
                          <TableCell key={secTitle} className="text-center">
                            {typeof scoreVal === "number" && secLight ? (
                              <Badge variant="outline" className={`font-mono text-[11px] ${secLight.badgeClass}`}>
                                {scoreVal}%
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        );
                      })}

                      <TableCell className="text-right">
                        {row.scopeType === "facility" ? (
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-primary">
                            View Scorecard
                          </Button>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">Summary</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Enterprise Table Pagination Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground pt-2">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
              <SelectTrigger className="w-16 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <span>
              Showing {sortedRows.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{" "}
              {Math.min(currentPage * pageSize, sortedRows.length)} of {sortedRows.length} records
            </span>
          </div>

          <div className="flex items-center gap-1 self-end sm:self-auto">
            <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={currentPage === 1} onClick={() => setPage(1)}>
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={currentPage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 font-medium text-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={currentPage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={currentPage === totalPages} onClick={() => setPage(totalPages)}>
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
