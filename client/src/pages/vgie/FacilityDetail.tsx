import { Link, useRoute } from "wouter";
import {
  ArrowLeft, Hospital, MapPin, Users, Activity,
  Clock, CheckCircle, XCircle, AlertTriangle, Ruler
} from "lucide-react";
import { useGetFacility } from "@/hooks/vgie/useVgieApi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const statusConfig = {
  served: { label: "Served", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", icon: CheckCircle },
  underserved: { label: "Underserved", color: "text-amber-400 bg-amber-500/10 border-amber-500/20", icon: AlertTriangle },
  unserved: { label: "Unserved", color: "text-red-400 bg-red-500/10 border-red-500/20", icon: XCircle },
};

export default function FacilityDetail() {
  const [, params] = useRoute("/facilities/:id");
  const id = params?.id ? parseInt(params.id) : null;
  const { data: facility, isLoading } = useGetFacility(id ?? 0);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48 bg-muted" />
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 bg-muted rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 bg-muted rounded-lg" />
      </div>
    );
  }

  if (!facility) {
    return (
      <div className="p-6 flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Hospital className="w-10 h-10 mb-3" />
        <p className="text-sm">Facility not found</p>
        <Link href="/facilities">
          <Button variant="ghost" size="sm" className="mt-3 text-emerald-500">Back to Facilities</Button>
        </Link>
      </div>
    );
  }

  const { stats, settlements } = facility as any;

  const coveragePct = stats?.servedCount && settlements?.length
    ? Math.round((stats.servedCount / settlements.length) * 100)
    : 0;

  return (
    <div className="p-6 space-y-5">
      {/* Back */}
      <Link href="/facilities">
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground -ml-1 h-8 gap-1.5">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Facilities
        </Button>
      </Link>

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
          <Hospital className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-100">{facility.name}</h2>
          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
            <span className="flex items-center gap-1">
              <Activity className="w-3.5 h-3.5" /> {facility.type}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> {facility.district} District
            </span>
            <span className="flex items-center gap-1">
              <Ruler className="w-3.5 h-3.5" /> {facility.catchmentRadiusKm}km catchment radius
            </span>
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Catchment Settlements", value: settlements?.length ?? 0, sub: "linked settlements" },
          { label: "Coverage Rate", value: `${coveragePct}%`, sub: `${stats?.servedCount ?? 0} served` },
          { label: "Catchment Population", value: (stats?.totalPopulation ?? 0).toLocaleString(), sub: "total pop." },
          { label: "Unserved Settlements", value: stats?.unservedCount ?? 0, sub: `${stats?.underservedCount ?? 0} underserved` },
        ].map((item) => (
          <Card key={item.label} className="bg-background border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
              <p className="text-xl font-bold text-slate-100">{item.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{item.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Catchment Settlements Table */}
      <Card className="bg-background border-border">
        <CardHeader className="px-4 pt-4 pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">
            Catchment Settlements
            <span className="ml-2 text-xs font-normal text-muted-foreground">sorted by distance</span>
          </CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Settlement</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Population</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Distance</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Walking</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {(settlements ?? []).map((s: any) => {
                const sc = statusConfig[s.serviceStatus as keyof typeof statusConfig];
                return (
                  <tr key={s.id} className="hover:bg-muted transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{s.name}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      <span className="flex items-center justify-end gap-1">
                        <Users className="w-3 h-3 text-muted-foreground" />
                        {s.population?.toLocaleString() ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {s.distanceKm != null ? `${s.distanceKm.toFixed(1)} km` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {s.travelTimeWalkingMin != null ? (
                        <span className="flex items-center justify-end gap-1">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          {s.travelTimeWalkingMin} min
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge className={`text-[10px] px-1.5 py-0 border ${sc?.color ?? ""}`}>
                        {sc?.label ?? s.serviceStatus}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/settlements/${s.id}`}>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground">
                          <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {(!settlements || settlements.length === 0) && (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <p className="text-sm">No catchment settlements found</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
