import React, { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Check,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MapPin,
  Building2,
  Users,
  Layers,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";

export interface PopulationSourceData {
  source: string;
  totalPopulation: number;
  under5Population: number;
  method: string;
  confidence: string;
  year: number;
  communityName?: string;
  communityCode?: string;
  villageId?: number | null;
  facilityId?: number | null;
  entityType?: "community" | "facility" | "grid" | "estimate";
}

interface PopulationSourceComparisonTableProps {
  sources: PopulationSourceData[];
  selectedSource?: string;
  onSelectSource?: (source: PopulationSourceData) => void;
}

type SortField = "communityName" | "source" | "totalPopulation" | "under5Population" | "confidence" | "year";
type SortOrder = "asc" | "desc";

export function PopulationSourceComparisonTable({
  sources = [],
  selectedSource,
  onSelectSource,
}: PopulationSourceComparisonTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("totalPopulation");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Extract unique sources for filter dropdown
  const uniqueSources = useMemo(() => {
    const set = new Set<string>();
    sources.forEach((s) => set.add(s.source));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [sources]);

  // Handle Sort Toggle
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder(field === "totalPopulation" || field === "under5Population" ? "desc" : "asc");
    }
    setCurrentPage(1);
  };

  // Filtered and Sorted Data
  const filteredAndSortedSources = useMemo(() => {
    let result = [...sources];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (s) =>
          (s.communityName && s.communityName.toLowerCase().includes(q)) ||
          (s.communityCode && s.communityCode.toLowerCase().includes(q)) ||
          s.source.toLowerCase().includes(q) ||
          s.method.toLowerCase().includes(q) ||
          String(s.year).includes(q) ||
          s.confidence.toLowerCase().includes(q)
      );
    }

    // Source filter
    if (sourceFilter !== "all") {
      result = result.filter((s) => s.source === sourceFilter);
    }

    // Sort
    result.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === "communityName") {
        valA = a.communityName || a.source || "";
        valB = b.communityName || b.source || "";
        return sortOrder === "asc"
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      }

      if (sortField === "source" || sortField === "confidence") {
        return sortOrder === "asc"
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      }

      // Numeric sorts
      const numA = Number(valA) || 0;
      const numB = Number(valB) || 0;
      return sortOrder === "asc" ? numA - numB : numB - numA;
    });

    return result;
  }, [sources, searchQuery, sourceFilter, sortField, sortOrder]);

  // Pagination calculation
  const totalRecords = filteredAndSortedSources.length;
  const totalPages = Math.ceil(totalRecords / pageSize) || 1;
  const paginatedSources = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedSources.slice(start, start + pageSize);
  }, [filteredAndSortedSources, currentPage, pageSize]);

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40 inline" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="h-3 w-3 ml-1 text-primary inline font-bold" />
    ) : (
      <ArrowDown className="h-3 w-3 ml-1 text-primary inline font-bold" />
    );
  };

  const getEntityIcon = (entityType?: string) => {
    switch (entityType) {
      case "community":
        return <Users className="h-3.5 w-3.5 text-emerald-600 shrink-0" />;
      case "facility":
        return <Building2 className="h-3.5 w-3.5 text-blue-600 shrink-0" />;
      case "grid":
        return <Layers className="h-3.5 w-3.5 text-purple-600 shrink-0" />;
      default:
        return <MapPin className="h-3.5 w-3.5 text-amber-600 shrink-0" />;
    }
  };

  if (!sources || sources.length === 0) {
    return (
      <div className="p-8 text-center border rounded-lg bg-muted/20">
        <MapPin className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
        <p className="text-sm font-medium text-muted-foreground">No population demographic sources available.</p>
        <p className="text-xs text-muted-foreground/70 mt-1">Add community population data or run spatial catchment extraction.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pb-1">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by community name, source, or method..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-8 h-8 text-xs bg-background"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <Select
              value={sourceFilter}
              onValueChange={(val) => {
                setSourceFilter(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-8 text-xs w-[140px] bg-background">
                <SelectValue placeholder="All Sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources ({sources.length})</SelectItem>
                {uniqueSources.map((src) => (
                  <SelectItem key={src} value={src}>
                    {src}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>Show:</span>
            <Select
              value={String(pageSize)}
              onValueChange={(val) => {
                setPageSize(Number(val));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-[70px] text-xs bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Enterprise Data Table */}
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/60 border-b">
              <TableRow className="hover:bg-transparent">
                <TableHead
                  className="cursor-pointer select-none font-semibold text-foreground text-xs py-2.5"
                  onClick={() => handleSort("communityName")}
                >
                  <div className="flex items-center gap-1">
                    Community / Target Catchment
                    {renderSortIcon("communityName")}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none font-semibold text-foreground text-xs py-2.5"
                  onClick={() => handleSort("source")}
                >
                  <div className="flex items-center gap-1">
                    Source
                    {renderSortIcon("source")}
                  </div>
                </TableHead>
                <TableHead className="font-semibold text-foreground text-xs py-2.5">
                  Methodology
                </TableHead>
                <TableHead
                  className="text-right cursor-pointer select-none font-semibold text-foreground text-xs py-2.5"
                  onClick={() => handleSort("totalPopulation")}
                >
                  <div className="flex items-center justify-end gap-1">
                    Total Pop
                    {renderSortIcon("totalPopulation")}
                  </div>
                </TableHead>
                <TableHead
                  className="text-right cursor-pointer select-none font-semibold text-foreground text-xs py-2.5"
                  onClick={() => handleSort("under5Population")}
                >
                  <div className="flex items-center justify-end gap-1">
                    Under-5 Pop
                    {renderSortIcon("under5Population")}
                  </div>
                </TableHead>
                <TableHead
                  className="text-center cursor-pointer select-none font-semibold text-foreground text-xs py-2.5"
                  onClick={() => handleSort("confidence")}
                >
                  <div className="flex items-center justify-center gap-1">
                    Confidence
                    {renderSortIcon("confidence")}
                  </div>
                </TableHead>
                <TableHead
                  className="text-center cursor-pointer select-none font-semibold text-foreground text-xs py-2.5"
                  onClick={() => handleSort("year")}
                >
                  <div className="flex items-center justify-center gap-1">
                    Year
                    {renderSortIcon("year")}
                  </div>
                </TableHead>
                {onSelectSource && (
                  <TableHead className="text-right font-semibold text-foreground text-xs py-2.5">
                    Action
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedSources.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={onSelectSource ? 8 : 7} className="h-24 text-center text-xs text-muted-foreground">
                    No matching population source records found.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedSources.map((source, i) => {
                  const isSelected = selectedSource === source.source;
                  const displayName = source.communityName || (source.entityType === "grid" ? "Spatial Catchment Grid" : (source.entityType === "community" ? "Catchment Community" : "Whole Facility Catchment"));

                  return (
                    <TableRow
                      key={`${source.source}-${source.communityName || ""}-${source.year}-${i}`}
                      className={isSelected ? "bg-primary/5 font-medium" : "hover:bg-muted/40 transition-colors"}
                    >
                      {/* Community Name Column */}
                      <TableCell className="py-2 text-xs">
                        <div className="flex items-center gap-2">
                          {getEntityIcon(source.entityType)}
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground truncate max-w-[200px]">
                              {displayName}
                            </span>
                            {source.communityCode && (
                              <span className="text-[10px] text-muted-foreground font-mono">
                                Code: {source.communityCode}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Source */}
                      <TableCell className="py-2 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-foreground">{source.source}</span>
                          {isSelected && (
                            <Badge variant="secondary" className="text-[10px] bg-primary/20 text-primary h-4 px-1 py-0">
                              Active
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      {/* Method */}
                      <TableCell className="py-2 text-xs text-muted-foreground">
                        <span className="truncate block max-w-[180px]">{source.method}</span>
                      </TableCell>

                      {/* Total Pop */}
                      <TableCell className="py-2 text-xs text-right font-bold text-foreground">
                        {source.totalPopulation.toLocaleString()}
                      </TableCell>

                      {/* Under-5 Pop */}
                      <TableCell className="py-2 text-xs text-right text-muted-foreground font-medium">
                        {source.under5Population.toLocaleString()}
                      </TableCell>

                      {/* Confidence */}
                      <TableCell className="py-2 text-center">
                        <Badge
                          variant={
                            source.confidence === "High"
                              ? "default"
                              : source.confidence === "Moderate"
                              ? "secondary"
                              : "outline"
                          }
                          className="text-[10px] h-5 font-medium"
                        >
                          {source.confidence}
                        </Badge>
                      </TableCell>

                      {/* Year */}
                      <TableCell className="py-2 text-xs text-center text-muted-foreground font-mono">
                        {source.year}
                      </TableCell>

                      {/* Action */}
                      {onSelectSource && (
                        <TableCell className="py-2 text-right">
                          <Button
                            variant={isSelected ? "default" : "outline"}
                            size="sm"
                            className="h-7 text-xs px-2.5"
                            onClick={() => onSelectSource(source)}
                          >
                            {isSelected ? (
                              <>
                                <Check className="h-3 w-3 mr-1" />
                                Selected
                              </>
                            ) : (
                              "Use Denominator"
                            )}
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Table Footer with Pagination */}
        <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
          <div>
            Showing{" "}
            <span className="font-medium text-foreground">
              {totalRecords === 0 ? 0 : (currentPage - 1) * pageSize + 1}
            </span>{" "}
            to{" "}
            <span className="font-medium text-foreground">
              {Math.min(currentPage * pageSize, totalRecords)}
            </span>{" "}
            of <span className="font-medium text-foreground">{totalRecords}</span> population records
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs mr-2">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
