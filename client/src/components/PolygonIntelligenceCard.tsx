import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Info, CheckCircle2, Map } from "lucide-react";

export interface IntelligenceResult {
  radiusKm: number;
  sources: Array<{
    source: string;
    totalPopulation: number;
    under5Population: number;
    method: string;
    confidence: string;
    year: number;
  }>;
  recommended: any;
  discrepancyLevel: "None" | "Minor" | "Moderate" | "Major";
  discrepancyMessage: string;
}

export function PolygonIntelligenceCard({ data }: { data: IntelligenceResult | null }) {
  if (!data || !data.sources.length) return null;

  return (
    <Card className="mt-4 shadow-sm border-blue-100">
      <CardHeader className="pb-2 bg-blue-50/50">
        <CardTitle className="text-sm flex items-center gap-2">
          <Map className="h-4 w-4 text-blue-600" />
          Polygon Intelligence
        </CardTitle>
        <CardDescription className="text-xs">
          Aggressively calculated population using spatial intersections.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 text-sm space-y-3">
        {data.sources.map((src, i) => (
          <div key={i} className="flex justify-between items-center border-b pb-2 last:border-0 last:pb-0">
            <div>
              <p className="font-medium text-slate-800">{src.source}</p>
              <p className="text-xs text-slate-500">{src.method} ({src.year})</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-slate-900">{src.totalPopulation.toLocaleString()}</p>
              <p className="text-xs text-slate-500">Under 5: {src.under5Population.toLocaleString()}</p>
            </div>
          </div>
        ))}
        
        {data.discrepancyLevel !== "None" && (
          <div className={`mt-3 p-2 rounded flex gap-2 text-xs items-start ${
            data.discrepancyLevel === "Major" ? "bg-red-50 text-red-700" :
            data.discrepancyLevel === "Moderate" ? "bg-amber-50 text-amber-700" :
            "bg-blue-50 text-blue-700"
          }`}>
            {data.discrepancyLevel === "Major" ? <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> :
             data.discrepancyLevel === "Moderate" ? <Info className="h-4 w-4 shrink-0 mt-0.5" /> :
             <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />}
            <span>{data.discrepancyMessage}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
