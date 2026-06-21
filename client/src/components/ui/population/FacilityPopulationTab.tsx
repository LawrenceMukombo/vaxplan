import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RadiusSelector } from "./RadiusSelector";
import { PopulationSummaryCard } from "./PopulationSummaryCard";
import { PopulationSourceComparisonTable } from "./PopulationSourceComparisonTable";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, MapPin } from "lucide-react";

interface FacilityPopulationTabProps {
  facilityId: number;
}

export function FacilityPopulationTab({ facilityId }: FacilityPopulationTabProps) {
  const [radiusKm, setRadiusKm] = useState<number>(5);

  const { data: popData, isLoading, error } = useQuery({
    queryKey: ["/api/facilities", facilityId, "population-intelligence", radiusKm],
    queryFn: async () => {
      const res = await fetch(`/api/facilities/${facilityId}/population-intelligence?radiusKm=${radiusKm}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch population intelligence");
      const json = await res.json();
      return json.data;
    },
    enabled: !!facilityId,
  });

  return (
    <div className="p-6 h-[65vh] overflow-y-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Population Intelligence
          </h3>
          <p className="text-sm text-muted-foreground">
            Aggressive comparison of estimated population around this facility.
          </p>
        </div>
        <RadiusSelector 
          radiiKm={[1, 3, 5, 10, 25]} 
          selectedRadiusKm={radiusKm} 
          onRadiusChange={setRadiusKm} 
          disabled={isLoading} 
        />
      </div>

      {isLoading ? (
        <div className="space-y-4 mt-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      ) : error ? (
        <div className="p-8 text-center text-red-500">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Error loading population intelligence data.</p>
        </div>
      ) : popData ? (
        <div className="space-y-6">
          <PopulationSummaryCard 
            recommended={popData.recommended}
            discrepancyLevel={popData.discrepancyLevel}
            discrepancyMessage={popData.discrepancyMessage}
          />
          <div>
            <h4 className="font-semibold text-md mb-3">Sources Comparison</h4>
            <PopulationSourceComparisonTable sources={popData.sources} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
