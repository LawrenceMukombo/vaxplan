import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Users, AlertCircle, Building2, MapPin, Network, List, Settings, Phone, IdCard } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapContainer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import { usePersistedBasemap, BasemapTileLayer, BasemapSwitcher } from "@/components/map/BasemapToggle";
import { DataTable } from "@/components/DataTable";
import { ExpandedFacilityDetails } from "@/components/ExpandedFacilityDetails";
import { GeoCascadeFilter } from "@/components/GeoCascadeFilter";
import { MapLegend } from "@/components/map/MapLegend";
import "leaflet/dist/leaflet.css";

const createGenericClusterIcon = function (cluster: any) {
  const count = cluster.getChildCount();
  const size = count > 100 ? 40 : count > 50 ? 34 : count > 10 ? 28 : 22;
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;background:rgba(59,130,246,0.85);border:2px solid rgba(147,197,253,0.6);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${count > 99 ? 9 : 11}px;font-weight:700;color:#fff;box-shadow:0 2px 8px rgba(59,130,246,0.4);">${count}</div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

interface ChvCoverageTabProps {
  facilities: any[];
  villages: any[];
  regions?: any[];
  provinces?: any[];
  districts?: any[];
  provinceLabel?: string;
  districtLabel?: string;
  skipRegionLevel?: boolean;
  onManageFacility?: (facility: any) => void;
  selectedRegionId?: number | null;
  selectedProvinceId?: number | null;
  selectedDistrictId?: number | null;
}

// Icons
const renderHumans = (count: number, color: string) => {
  const maxToDraw = Math.min(count, 5);
  const svgs = Array(maxToDraw).fill(`<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-left: -4px;"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`).join('');
  const overflow = count > 5 ? `<span style="font-size: 9px; font-weight: bold; color: ${color}; margin-left: 2px;">+${count - 5}</span>` : '';
  return `<div style="display: flex; align-items: center; padding-left: 4px;">${svgs}${overflow}</div>`;
};

const getFacilityIcon = (unassignedCount: number) => {
  if (unassignedCount > 0) {
    return L.divIcon({
      html: `
        <div style="display: flex; align-items: center; background: white; border-radius: 12px; border: 1.5px solid #2563eb; padding: 2px 4px 2px 2px; box-shadow: 0 0 4px rgba(0,0,0,0.3);">
          <div style="background-color: #2563eb; width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0;"></div>
          ${renderHumans(unassignedCount, '#f59e0b')}
        </div>
      `,
      className: "",
      iconSize: [(unassignedCount > 5 ? 60 : 20 + unassignedCount * 8), 20],
      iconAnchor: [10, 10],
    });
  }
  return L.divIcon({
    html: `<div style="background-color: #2563eb; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`,
    className: "",
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
};

const getVillageIcon = (chvCount: number) => {
  if (chvCount === 0) {
    return L.divIcon({
      html: `<div style="background-color: #dc2626; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(220,38,38,0.8);"></div>`,
      className: "",
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });
  }
  return L.divIcon({
    html: `
      <div style="display: inline-flex; align-items: center; background-color: white; border-radius: 12px; border: 1.5px solid #16a34a; padding: 2px; box-shadow: 0 0 2px rgba(0,0,0,0.3);">
        ${renderHumans(chvCount, '#16a34a')}
      </div>
    `,
    className: "",
    iconSize: [(chvCount > 5 ? 50 : 8 + chvCount * 8), 20],
    iconAnchor: [(chvCount > 5 ? 25 : 4 + chvCount * 4), 10],
  });
};

function MapBoundsFitter({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap();
  React.useEffect(() => {
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, bounds]);
  return null;
}

export function ChvCoverageTab({ 
  facilities, 
  villages, 
  regions = [], 
  provinces = [], 
  districts = [], 
  provinceLabel = "Province", 
  districtLabel = "District", 
  skipRegionLevel = false,
  selectedRegionId,
  selectedProvinceId,
  selectedDistrictId,
  onManageFacility
}: ChvCoverageTabProps) {
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [basemap, setBasemap] = usePersistedBasemap("positron");
  
      
  const [cardFilter, setCardFilter] = useState<"all" | "covered" | "gaps" | "unassigned">("all");

  const { data: chvsResponse, isLoading: chvsLoading } = useQuery<any>({
    queryKey: ["/api/chvs?pageSize=10000"], 
    staleTime: 5 * 60 * 1000,
  });

  const chvs = chvsResponse?.data || [];

  const coverageData = useMemo(() => {
    if (!facilities.length || !villages.length) return null;

    let filteredFacilities = facilities;
    if (selectedDistrictId) {
      filteredFacilities = filteredFacilities.filter(f => Number(f.districtId) === Number(selectedDistrictId));
    } else if (selectedProvinceId && districts.length) {
      const distIds = districts.filter(d => Number(d.provinceId) === Number(selectedProvinceId)).map(d => Number(d.id));
      filteredFacilities = filteredFacilities.filter(f => distIds.includes(Number(f.districtId)));
    } else if (selectedRegionId && provinces.length && districts.length) {
      const provIds = provinces.filter(p => Number(p.regionId) === Number(selectedRegionId)).map(p => Number(p.id));
      const distIds = districts.filter(d => provIds.includes(Number(d.provinceId))).map(d => Number(d.id));
      filteredFacilities = filteredFacilities.filter(f => distIds.includes(Number(f.districtId)));
    }

    let totalGaps = 0;
    let totalCovered = 0;
    let unassignedChvs = 0;
    let filteredChvsCount = 0;

    const facilityMap = new Map<number, any>();
    filteredFacilities.forEach((f) => {
      facilityMap.set(f.id, {
        ...f,
        communities: [],
        unassignedChvs: [],
      });
    });

    const villageMap = new Map<number, any>();
    villages.forEach((v) => {
      const villageNode = { ...v, chvs: [] };
      villageMap.set(v.id, villageNode);
      if (v.assignedFacilityId && facilityMap.has(v.assignedFacilityId)) {
        facilityMap.get(v.assignedFacilityId).communities.push(villageNode);
      }
    });

    chvs.forEach((chv: any) => {
      if (chv.facilityId && facilityMap.has(chv.facilityId)) {
        filteredChvsCount++;
        const targetVillageId = chv.villageId || chv.assignedVillageId;
        if (targetVillageId && villageMap.has(targetVillageId)) {
          villageMap.get(targetVillageId).chvs.push(chv);
        } else {
          facilityMap.get(chv.facilityId).unassignedChvs.push(chv);
          unassignedChvs++;
        }
      }
    });

    const facilitiesWithData = Array.from(facilityMap.values()).map(f => {
      let fGaps = 0;
      let fCovered = 0;
      
      f.communities.forEach((c: any) => {
        if (c.chvs.length === 0) {
          fGaps++;
          totalGaps++;
        } else {
          fCovered++;
          totalCovered++;
        }
      });
      
      return {
        ...f,
        gapCount: fGaps,
        coveredCount: fCovered,
        totalCommunities: f.communities.length
      };
    });

    // Generate location breakdown
    let breakdown: any[] = [];
    let breakdownType = "Location";
    
    if (!selectedProvinceId) {
      breakdownType = provinceLabel;
      const provMap = new Map();
      provinces.forEach(p => provMap.set(p.id, { id: p.id, name: p.name, total: 0, covered: 0, gaps: 0 }));
      facilitiesWithData.forEach(f => {
        const dist = districts.find(d => d.id === f.districtId);
        if (dist && provMap.has(dist.provinceId)) {
          const p = provMap.get(dist.provinceId);
          p.total += f.totalCommunities;
          p.covered += f.coveredCount;
          p.gaps += f.gapCount;
        }
      });
      breakdown = Array.from(provMap.values()).filter(p => p.total > 0);
    } else if (!selectedDistrictId) {
      breakdownType = districtLabel;
      const distMap = new Map();
      districts.filter(d => d.provinceId === selectedProvinceId).forEach(d => distMap.set(d.id, { id: d.id, name: d.name, total: 0, covered: 0, gaps: 0 }));
      facilitiesWithData.forEach(f => {
        if (distMap.has(f.districtId)) {
          const d = distMap.get(f.districtId);
          d.total += f.totalCommunities;
          d.covered += f.coveredCount;
          d.gaps += f.gapCount;
        }
      });
      breakdown = Array.from(distMap.values()).filter(d => d.total > 0);
    } else {
      breakdownType = "Health Facility";
      breakdown = facilitiesWithData.map(f => ({
        id: f.id,
        name: f.name,
        total: f.totalCommunities,
        covered: f.coveredCount,
        gaps: f.gapCount
      })).filter(f => f.total > 0);
    }

    // Sort breakdown by coverage % (lowest first)
    breakdown.sort((a, b) => {
      const covA = a.total > 0 ? a.covered / a.total : 0;
      const covB = b.total > 0 ? b.covered / b.total : 0;
      return covA - covB;
    });

    // Apply Card Filters
    let filteredTree: any[] = [];
    let bounds = new L.LatLngBounds([]);

    facilitiesWithData.forEach(f => {
      let includeFacility = false;
      let filteredCommunities = f.communities;

      if (cardFilter === "gaps") {
        filteredCommunities = f.communities.filter((c: any) => c.chvs.length === 0);
        if (filteredCommunities.length > 0) includeFacility = true;
      } else if (cardFilter === "covered") {
        filteredCommunities = f.communities.filter((c: any) => c.chvs.length > 0);
        if (filteredCommunities.length > 0) includeFacility = true;
      } else if (cardFilter === "unassigned") {
        if (f.unassignedChvs.length > 0) includeFacility = true;
      } else {
        includeFacility = true;
      }

      if (includeFacility) {
        const newF = { ...f, communities: filteredCommunities };
        filteredTree.push(newF);
        
        if (newF.latitude && newF.longitude) {
          bounds.extend([parseFloat(newF.latitude), parseFloat(newF.longitude)]);
        }
        newF.communities.forEach((c: any) => {
          if (c.latitude && c.longitude) {
            bounds.extend([parseFloat(c.latitude), parseFloat(c.longitude)]);
          }
        });
      }
    });

    return {
      tree: filteredTree.sort((a, b) => b.gapCount - a.gapCount), 
      bounds: bounds.isValid() ? bounds : null,
      stats: {
        totalChvs: filteredChvsCount,
        totalCommunities: Array.from(villageMap.values()).filter(v => v.assignedFacilityId && facilityMap.has(v.assignedFacilityId)).length,
        totalGaps,
        totalCovered,
        unassignedChvs
      },
      breakdown,
      breakdownType
    };
  }, [facilities, villages, chvs, selectedRegionId, selectedProvinceId, selectedDistrictId, provinces, districts, cardFilter]);

  if (chvsLoading || !coverageData) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const { stats, tree, bounds, breakdown, breakdownType } = coverageData;

  const columns = [
    { 
      key: "name", 
      header: "Facility Name", 
      sortable: true,
      render: (item: any) => (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold">{item.name}</span>
        </div>
      )
    },
    { 
      key: "totalCommunities", 
      header: "Total Communities", 
      sortable: true,
      render: (item: any) => (
        <span>
          {cardFilter !== "all" && cardFilter !== "unassigned" ? item.communities.length : item.totalCommunities}
        </span>
      )
    },
    { 
      key: "coveredCount", 
      header: "Covered", 
      sortable: true,
      render: (item: any) => (
        <span className="text-green-600 font-medium">
          {cardFilter === "gaps" ? 0 : cardFilter === "covered" ? item.communities.length : item.coveredCount}
        </span>
      )
    },
    { 
      key: "gapCount", 
      header: "Gaps", 
      sortable: true,
      render: (item: any) => {
        const gaps = cardFilter === "covered" ? 0 : cardFilter === "gaps" ? item.communities.length : item.gapCount;
        return gaps > 0 
          ? <Badge variant="destructive">{gaps}</Badge>
          : <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">0</Badge>;
      }
    },
    {
      key: "unassignedChvs",
      header: "Unassigned CHVs",
      render: (item: any) => item.unassignedChvs.length > 0 
        ? <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">{item.unassignedChvs.length}</Badge>
        : <span className="text-muted-foreground">0</span>
    },
    {
      key: "communitiesList",
      header: "Communities (Filtered)",
      render: (item: any) => (
        <div className="flex flex-wrap gap-1 w-full">
          {item.communities.slice(0, 5).map((c: any) => (
            <Badge key={c.id} variant={c.chvs.length === 0 ? "destructive" : "secondary"} className="text-[10px] font-normal">
              {c.name} {c.chvs.length === 0 ? "(Gap)" : ""}
            </Badge>
          ))}
          {item.communities.length > 5 && (
            <Badge variant="outline" className="text-[10px]">+{item.communities.length - 5} more</Badge>
          )}
          {item.communities.length === 0 && (
            <span className="text-xs text-muted-foreground italic">No communities</span>
          )}
        </div>
      )
    },
    {
      key: "actions",
      header: "",
      render: (item: any) => (
        <div className="flex justify-end">
          <Button 
            variant="outline" 
            size="sm"
            className="flex items-center gap-1.5 h-7 px-3 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onManageFacility?.(item);
            }}
          >
            <Settings className="h-3 w-3" />
            <span className="text-xs">Manage</span>
          </Button>
        </div>
      )
    }
  ];

  const breakdownColumns = [
    { key: "name", header: breakdownType, sortable: true },
    { key: "total", header: "Communities", sortable: true },
    { key: "covered", header: "Covered", sortable: true },
    { key: "gaps", header: "Gaps", sortable: true },
    { 
      key: "coverage", 
      header: "Coverage %", 
      sortable: true,
      render: (item: any) => {
        const percent = item.total > 0 ? Math.round((item.covered / item.total) * 100) : 0;
        return (
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={`h-full ${percent < 50 ? 'bg-red-500' : percent < 80 ? 'bg-amber-500' : 'bg-green-500'}`} 
                style={{ width: `${percent}%` }} 
              />
            </div>
            <span className="text-xs font-medium w-8 text-right">{percent}%</span>
          </div>
        );
      }
    }
  ];

  return (
    <div className="space-y-6">


      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card 
          className={`bg-primary/5 border-primary/20 cursor-pointer transition-all hover:shadow-md ${cardFilter === "all" ? "ring-2 ring-primary ring-offset-2" : "opacity-80"}`}
          onClick={() => setCardFilter("all")}
        >
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Total CHVs (All)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{stats.totalChvs}</div>
          </CardContent>
        </Card>
        
        <Card 
          className={`bg-green-50 dark:bg-green-950/20 border-green-200 cursor-pointer transition-all hover:shadow-md ${cardFilter === "covered" ? "ring-2 ring-green-500 ring-offset-2" : "opacity-80"}`}
          onClick={() => setCardFilter("covered")}
        >
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-green-700 dark:text-green-400">
              <MapPin className="h-4 w-4" />
              Covered Communities
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">{stats.totalCovered}</div>
            <p className="text-xs text-green-600/80">Click to view covered</p>
          </CardContent>
        </Card>

        <Card 
          className={`bg-red-50 dark:bg-red-950/20 border-red-200 cursor-pointer transition-all hover:shadow-md ${cardFilter === "gaps" ? "ring-2 ring-red-500 ring-offset-2" : "opacity-80"}`}
          onClick={() => setCardFilter("gaps")}
        >
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertCircle className="h-4 w-4" />
              Service Gaps
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-red-700 dark:text-red-400">{stats.totalGaps}</div>
            <p className="text-xs text-red-600/80">Click to view gaps</p>
          </CardContent>
        </Card>

        <Card 
          className={`bg-amber-50 dark:bg-amber-950/20 border-amber-200 cursor-pointer transition-all hover:shadow-md ${cardFilter === "unassigned" ? "ring-2 ring-amber-500 ring-offset-2" : "opacity-80"}`}
          onClick={() => setCardFilter("unassigned")}
        >
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <Users className="h-4 w-4" />
              Unassigned CHVs
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{stats.unassignedChvs}</div>
            <p className="text-xs text-amber-600/80">Click to view unassigned</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Coverage Metrics by {breakdownType}</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable 
            columns={breakdownColumns} 
            data={breakdown} 
            pageSize={5}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4 flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Facility & Community Breakdown {cardFilter !== "all" && <Badge variant="secondary" className="ml-2 uppercase tracking-wide text-[10px]">{cardFilter}</Badge>}</CardTitle>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "list" | "map")} className="w-[200px]">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="list"><List className="w-4 h-4 mr-2" />List</TabsTrigger>
              <TabsTrigger value="map"><Network className="w-4 h-4 mr-2" />Map</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {viewMode === "list" ? (
            <DataTable 
              columns={columns} 
              data={tree} 
              searchable 
              searchKeys={["name"]} 
              searchPlaceholder="Search facilities..."
              renderExpandedRow={(item: any) => <ExpandedFacilityDetails facility={item} />}
            />
          ) : (
            <div className="min-h-[600px] h-[calc(100vh-280px)] w-full rounded-md border overflow-hidden relative z-10">
              <MapLegend />
              <MapContainer 
                center={[-13.2543, 31.1458]} 
                zoom={6} 
                className="w-full h-full"
                maxZoom={18}
              >
                <BasemapTileLayer basemap={basemap} />
                <BasemapSwitcher basemap={basemap} onChange={setBasemap} />
                {bounds && <MapBoundsFitter bounds={bounds} />}
                
                                {/* Polylines rendered OUTSIDE MarkerClusterGroup */}
                {tree.map(facility => {
                  if (!facility.latitude || !facility.longitude) return null;
                  const fLat = parseFloat(facility.latitude);
                  const fLng = parseFloat(facility.longitude);
                  
                  return (
                    <React.Fragment key={`lines-${facility.id}`}>
                      {facility.communities.map((c: any) => {
                        if (!c.latitude || !c.longitude) return null;
                        const cLat = parseFloat(c.latitude);
                        const cLng = parseFloat(c.longitude);
                        const hasGap = c.chvs.length === 0;
                        
                        return (
                          <Polyline 
                            key={`poly-${facility.id}-${c.id}`}
                            positions={[[fLat, fLng], [cLat, cLng]]}
                            pathOptions={{
                              color: hasGap ? '#ef4444' : '#22c55e',
                              weight: 2,
                              dashArray: hasGap ? '5, 5' : undefined,
                              opacity: 0.7
                            }}
                          />
                        );
                      })}
                    </React.Fragment>
                  );
                })}

                {/* Markers rendered INSIDE MarkerClusterGroup as a single flat array to avoid breaking the clusterer! */}
                <MarkerClusterGroup chunkedLoading maxClusterRadius={40} iconCreateFunction={createGenericClusterIcon}>
                  {tree.flatMap(facility => {
                    const markers = [];
                    
                    if (facility.latitude && facility.longitude) {
                      const fLat = parseFloat(facility.latitude);
                      const fLng = parseFloat(facility.longitude);
                      
                      markers.push(
                        <Marker key={`f-marker-${facility.id}`} position={[fLat, fLng]} icon={getFacilityIcon(facility.unassignedChvs?.length || 0)}>
                          <Popup className="min-w-[280px]">
                            <div className="font-medium text-base mb-1">{facility.name}</div>
                            <div className="text-sm text-muted-foreground mb-3 flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5"/> Health Facility</div>
                            
                            <div className="flex gap-4 text-xs mb-4 bg-muted/30 p-2 rounded-md border">
                              <div className="flex flex-col">
                                <span className="text-muted-foreground uppercase text-[10px] font-semibold tracking-wider">Covered</span>
                                <span className="font-semibold text-green-600">{facility.coveredCount}</span>
                              </div>
                              <div className="flex flex-col border-l pl-4">
                                <span className="text-muted-foreground uppercase text-[10px] font-semibold tracking-wider">Gaps</span>
                                <span className="font-semibold text-red-600">{facility.gapCount}</span>
                              </div>
                            </div>

                            {facility.unassignedChvs && facility.unassignedChvs.length > 0 && (
                              <div className="flex flex-col gap-2 mt-2">
                                <div className="text-xs pb-1 border-b">
                                  <span className="font-semibold text-red-600">{facility.unassignedChvs.length}</span> Unassigned CHV(s) at Facility
                                </div>
                                <div className="max-h-48 overflow-y-auto pr-1 space-y-2">
                                  {facility.unassignedChvs.map((chv: any, idx: number) => (
                                    <div key={idx} className="text-xs bg-muted/10 p-2 rounded-md border border-border/50 hover:bg-muted/30 transition-colors">
                                      <div className="font-medium flex items-center justify-between mb-1.5">
                                        <span className="truncate pr-2">{chv.name || "Unknown Name"}</span>
                                        {chv.campaignRole && <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 shrink-0 font-medium">{chv.campaignRole}</Badge>}
                                      </div>
                                      <div className="text-muted-foreground flex flex-col gap-1">
                                        {chv.contactPhone && <span className="flex items-center gap-1.5"><Phone className="h-3 w-3 shrink-0" /> {chv.contactPhone}</span>}
                                        {chv.nrc && <span className="flex items-center gap-1.5"><IdCard className="h-3 w-3 shrink-0" /> {chv.nrc}</span>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </Popup>
                        </Marker>
                      );
                    }
                    
                    if (facility.communities) {
                      facility.communities.forEach((c: any) => {
                        if (!c.latitude || !c.longitude) return;
                        const cLat = parseFloat(c.latitude);
                        const cLng = parseFloat(c.longitude);
                        const hasGap = c.chvs.length === 0;
                        
                        markers.push(
                          <Marker key={`c-marker-${c.id}`} position={[cLat, cLng]} icon={getVillageIcon(c.chvs?.length || 0)}>
                            <Popup className="min-w-[280px]">
                              <div className="font-medium text-base mb-1">{c.name}</div>
                              <div className="text-sm text-muted-foreground mb-3">
                                <div className="flex items-center gap-1.5 mb-2">
                                  <MapPin className="w-3.5 h-3.5"/> Community
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs bg-muted/20 p-2 rounded-md border border-border/40">
                                  <div className="col-span-2 flex justify-between items-center border-b pb-1 mb-1">
                                    <span className="text-muted-foreground/80">Linked HF:</span>
                                    <strong className="text-foreground/90 truncate max-w-[140px]" title={facility.name}>{facility.name}</strong>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[9px] uppercase text-muted-foreground/70">Distance</span>
                                    <span className="font-medium">{c.distanceToFacility != null ? `${c.distanceToFacility} km` : "N/A"}</span>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[9px] uppercase text-muted-foreground/70">Time</span>
                                    <span className="font-medium">{c.travelTimeMinutes != null ? `${c.travelTimeMinutes} min` : "N/A"}</span>
                                  </div>
                                </div>
                              </div>
                              {hasGap ? (
                                <Badge variant="destructive" className="text-[10px] w-full justify-center py-1">SERVICE GAP: 0 CHVs</Badge>
                              ) : (
                                <div className="flex flex-col gap-2">
                                  <div className="text-xs pb-1 border-b flex items-center justify-between">
                                    <span><span className="font-semibold text-primary">{c.chvs.length}</span> CHV(s) assigned</span>
                                  </div>
                                  <div className="max-h-48 overflow-y-auto pr-1 space-y-2">
                                    {c.chvs.map((chv: any, idx: number) => (
                                      <div key={idx} className="text-xs bg-muted/10 p-2 rounded-md border border-border/50 hover:bg-muted/30 transition-colors">
                                        <div className="font-medium flex items-center justify-between mb-1.5">
                                          <span className="truncate pr-2">{chv.name || "Unknown Name"}</span>
                                          {chv.campaignRole && <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 shrink-0 font-medium">{chv.campaignRole}</Badge>}
                                        </div>
                                        <div className="text-muted-foreground flex flex-col gap-1">
                                          {chv.contactPhone && <span className="flex items-center gap-1.5"><Phone className="h-3 w-3 shrink-0" /> {chv.contactPhone}</span>}
                                          {chv.nrc && <span className="flex items-center gap-1.5"><IdCard className="h-3 w-3 shrink-0" /> {chv.nrc}</span>}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </Popup>
                          </Marker>
                        );
                      });
                    }
                    
                    return markers;
                  })}
                </MarkerClusterGroup>
              </MapContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
