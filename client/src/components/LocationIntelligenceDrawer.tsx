import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Activity, AlertTriangle, Building } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadiusSelector } from "./ui/population/RadiusSelector";
import { PopulationSummaryCard } from "./ui/population/PopulationSummaryCard";
import { PopulationSourceComparisonTable } from "./ui/population/PopulationSourceComparisonTable";

interface Point {
  lat: number;
  lng: number;
}

interface LocationIntelligenceDrawerProps {
  point: Point | null;
  onClose: () => void;
}

export function LocationIntelligenceDrawer({ point, onClose }: LocationIntelligenceDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [radiusKm, setRadiusKm] = useState<number>(5);

  useEffect(() => {
    if (point) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [point]);

  // Fetch contextual infrastructure (facilities, communities)
  const { data: locationData, isLoading: isLoadingLocation, error: locationError } = useQuery({
    queryKey: ["/api/gis/location-intelligence", point?.lat, point?.lng, radiusKm],
    queryFn: async () => {
      if (!point) return null;
      const res = await fetch(`/api/gis/location-intelligence?lat=${point.lat}&lng=${point.lng}&radiusKm=${radiusKm}`);
      if (!res.ok) throw new Error("Failed to fetch location intelligence");
      const json = await res.json();
      return json.data;
    },
    enabled: !!point,
  });

  // Fetch deep population intelligence
  const { data: popData, isLoading: isLoadingPop, error: popError } = useQuery({
    queryKey: ["/api/gis/population-intelligence", point?.lat, point?.lng, radiusKm],
    queryFn: async () => {
      if (!point) return null;
      const res = await fetch(`/api/gis/population-intelligence?lat=${point.lat}&lng=${point.lng}&radiusKm=${radiusKm}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch population intelligence");
      const json = await res.json();
      return json.data;
    },
    enabled: !!point,
  });

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) onClose();
  };

  const isLoading = isLoadingLocation || isLoadingPop;
  const error = locationError || popError;

  return (
    <Drawer open={isOpen} onOpenChange={handleOpenChange}>
      <DrawerContent className="h-[90vh] max-h-[90vh] flex flex-col">
        <DrawerHeader className="border-b pb-4">
          <div className="flex justify-between items-center max-w-5xl mx-auto w-full">
            <div>
              <DrawerTitle className="text-xl font-bold flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                GIS Point Intelligence
              </DrawerTitle>
              <DrawerDescription>
                {point && `Analysis for selected location: ${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`}
              </DrawerDescription>
            </div>
            <RadiusSelector 
              radiiKm={[1, 3, 5, 10, 25]} 
              selectedRadiusKm={radiusKm} 
              onRadiusChange={setRadiusKm} 
              disabled={isLoading} 
            />
          </div>
        </DrawerHeader>

        <ScrollArea className="flex-1 px-4 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-4 mt-4 p-4 max-w-5xl mx-auto">
              <Skeleton className="h-32 w-full rounded-xl" />
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-48 rounded-xl" />
                <Skeleton className="h-48 rounded-xl" />
              </div>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-500">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Error loading intelligence data.</p>
            </div>
          ) : locationData && popData ? (
            <div className="space-y-6 py-6 max-w-5xl mx-auto">
              
              {/* Aggregated Population Summary */}
              <PopulationSummaryCard 
                recommended={popData.recommended}
                discrepancyLevel={popData.discrepancyLevel}
                discrepancyMessage={popData.discrepancyMessage}
              />

              {/* Source Comparison */}
              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2 mb-3">
                  Data Sources Comparison
                </h3>
                <PopulationSourceComparisonTable sources={popData.sources} />
              </div>

              {/* Context / Admin Hierarchy */}
              <div className="bg-muted/30 p-4 rounded-lg border">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Administrative Context
                </h3>
                <div className="text-sm text-muted-foreground grid grid-cols-2 gap-y-2">
                  <div>Province: <span className="font-medium text-foreground">{locationData.adminHierarchy[1] || "Unknown"}</span></div>
                  <div>District: <span className="font-medium text-foreground">{locationData.adminHierarchy[2] || "Unknown"}</span></div>
                  <div>Constituency: <span className="font-medium text-foreground">{locationData.adminHierarchy[3] || "Unknown"}</span></div>
                  <div>Ward: <span className="font-medium text-foreground">{locationData.adminHierarchy[4] || "Unknown"}</span></div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Nearby Facilities */}
                <div>
                  <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
                    <Building className="h-5 w-5" />
                    Nearby Facilities ({locationData.facilities.length})
                  </h3>
                  <div className="space-y-3">
                    {locationData.facilities.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">No facilities within {locationData.radiusKm}km</p>
                    ) : (
                      locationData.facilities.map((f: any) => (
                        <div key={f.id} className="p-3 border rounded-lg bg-card hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start">
                            <span className="font-medium">{f.name}</span>
                            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
                              {f.distance_km} km
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 capitalize">{f.type} • {f.status}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Nearby Communities */}
                <div>
                  <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
                    <Activity className="h-5 w-5" />
                    Nearby Communities ({locationData.communities.length})
                  </h3>
                  <div className="space-y-3">
                    {locationData.communities.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">No communities within {locationData.radiusKm}km</p>
                    ) : (
                      locationData.communities.slice(0, 8).map((c: any) => (
                        <div key={c.id} className="p-3 border rounded-lg bg-card flex justify-between items-center">
                          <div>
                            <p className="font-medium text-sm">{c.name}</p>
                            <p className="text-xs text-muted-foreground">Pop: {c.population || 0}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-semibold">{c.distance_km} km</p>
                            {c.is_hard_to_reach && (
                              <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">HTR</span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                    {locationData.communities.length > 8 && (
                      <div className="text-center text-xs text-muted-foreground pt-2">
                        + {locationData.communities.length - 8} more communities
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </ScrollArea>
        <DrawerFooter className="border-t max-w-5xl mx-auto w-full">
          <DrawerClose asChild>
            <Button variant="outline" className="w-full sm:w-auto">Close Analysis</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
