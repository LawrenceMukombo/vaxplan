import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RadiusSelector } from "./RadiusSelector";
import { PopulationSummaryCard } from "./PopulationSummaryCard";
import { PopulationSourceComparisonTable } from "./PopulationSourceComparisonTable";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";

interface CommunityPopulationIntelligenceProps {
  lat: number;
  lng: number;
  initialRadiusKm?: number;
  onRadiusChange?: (radius: number) => void;
  onAcceptEstimate?: (estimate: number) => void;
}

export function CommunityPopulationIntelligence({ 
  lat, 
  lng, 
  initialRadiusKm = 2,
  onRadiusChange,
  onAcceptEstimate
}: CommunityPopulationIntelligenceProps) {
  const [radiusKm, setRadiusKm] = useState<number>(initialRadiusKm);

  const handleRadiusChange = (r: number) => {
    setRadiusKm(r);
    onRadiusChange?.(r);
  };

  const { data: popData, isLoading, error } = useQuery({
    queryKey: ["/api/gis/population-intelligence", lat, lng, radiusKm],
    queryFn: async () => {
      if (!lat || !lng) return null;
      const res = await fetch(`/api/gis/population-intelligence?lat=${lat}&lng=${lng}&radiusKm=${radiusKm}`);
      if (!res.ok) throw new Error("Failed to fetch population intelligence");
      const json = await res.json();
      return json.data;
    },
    enabled: !!lat && !!lng,
  });

  return (
    <div className="space-y-6 max-h-[65vh] overflow-y-auto">
      <div className="flex justify-between items-center bg-muted/30 p-3 rounded-lg border">
        <span className="text-sm font-medium">Analysis Radius</span>
        <RadiusSelector 
          radiiKm={[1, 2, 3, 5, 10]} 
          selectedRadiusKm={radiusKm} 
          onRadiusChange={handleRadiusChange} 
          disabled={isLoading} 
        />
      </div>

      {isLoading ? (
        <div className="space-y-4 mt-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      ) : error ? (
        <div className="p-6 text-center text-red-500 bg-red-50 rounded-lg border border-red-100">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-70" />
          <p className="text-sm">Error loading population intelligence data. Please check your connection.</p>
        </div>
      ) : popData ? (
        <div className="space-y-6">
          <PopulationSummaryCard 
            recommended={popData.recommended}
            discrepancyLevel={popData.discrepancyLevel}
            discrepancyMessage={popData.discrepancyMessage}
          />
          <div>
            <h4 className="font-semibold text-md mb-3 flex items-center justify-between">
              Sources Comparison
              {onAcceptEstimate && popData.recommended && (
                <button 
                  type="button"
                  className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90 font-medium transition-colors"
                  onClick={() => onAcceptEstimate(popData.recommended.totalPopulation)}
                >
                  Use Recommended Pop
                </button>
              )}
            </h4>
            <PopulationSourceComparisonTable sources={popData.sources} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
