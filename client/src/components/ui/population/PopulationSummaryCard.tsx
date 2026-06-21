import React from "react";
import { Users, Target, AlertTriangle, CheckCircle } from "lucide-react";

export interface PopulationSourceData {
  source: string;
  totalPopulation: number;
  under5Population: number;
  method: string;
  confidence: string;
  year: number;
}

interface PopulationSummaryCardProps {
  recommended: PopulationSourceData | null;
  discrepancyLevel: "None" | "Minor" | "Moderate" | "Major";
  discrepancyMessage: string;
}

export function PopulationSummaryCard({ recommended, discrepancyLevel, discrepancyMessage }: PopulationSummaryCardProps) {
  
  if (!recommended) {
    return (
      <div className="bg-muted p-6 rounded-xl border text-center">
        <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
        <p className="text-muted-foreground font-medium">No population intelligence available for this area.</p>
      </div>
    );
  }

  const discrepancyConfig = {
    None: { color: "text-green-600", bg: "bg-green-100", icon: CheckCircle },
    Minor: { color: "text-blue-600", bg: "bg-blue-100", icon: CheckCircle },
    Moderate: { color: "text-orange-600", bg: "bg-orange-100", icon: AlertTriangle },
    Major: { color: "text-red-600", bg: "bg-red-100", icon: AlertTriangle }
  };

  const Config = discrepancyConfig[discrepancyLevel] || discrepancyConfig.None;
  const DiscrepancyIcon = Config.icon;

  return (
    <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
      <div className="p-4 flex flex-col md:flex-row gap-6 items-center">
        
        {/* Recommended Hero */}
        <div className="flex-1 text-center md:text-left">
          <p className="text-sm text-muted-foreground font-semibold mb-1 uppercase tracking-wide">Recommended Denominator</p>
          <div className="flex items-baseline justify-center md:justify-start gap-2">
            <h2 className="text-4xl font-extrabold">{recommended.totalPopulation.toLocaleString()}</h2>
            <span className="text-sm font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              {recommended.source}
            </span>
          </div>
          <div className="flex items-center justify-center md:justify-start gap-4 mt-3">
            <div className="flex items-center text-sm text-muted-foreground">
              <Target className="h-4 w-4 mr-1.5" />
              Est. Under-5: {recommended.under5Population.toLocaleString()}
            </div>
            <div className="flex items-center text-sm text-muted-foreground">
              <Users className="h-4 w-4 mr-1.5" />
              Year: {recommended.year}
            </div>
          </div>
        </div>

        {/* Discrepancy Alert */}
        {discrepancyLevel !== "None" && (
          <div className={`flex items-start gap-3 p-4 rounded-lg border ${Config.bg} ${Config.color} md:max-w-xs`}>
            <DiscrepancyIcon className="h-5 w-5 mt-0.5 shrink-0" />
            <div>
              <p className="font-bold text-sm mb-1">{discrepancyLevel} Discrepancy</p>
              <p className="text-xs leading-relaxed opacity-90">{discrepancyMessage}</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
