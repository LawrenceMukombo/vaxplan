import { useState } from "react";
import { useRoute, Link } from "wouter";
import {
  ArrowLeft, Users, MapPin, Building2, Hospital,
  Clock, Footprints, Bike, Car, AlertTriangle,
  CheckCircle, XCircle, Satellite, ClipboardList, Shield,
  Syringe, Plus, ChevronDown, ChevronUp, Loader2,
} from "lucide-react";
import { useGetSettlement, useUpdateRecommendation, useLogOutreach } from "@/hooks/vgie/useVgieApi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const statusConfig = {
  served: { label: "Served", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  underserved: { label: "Underserved", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  unserved: { label: "Unserved", color: "text-red-400 bg-red-500/10 border-red-500/20" },
};
const riskConfig = {
  low: { color: "text-slate-400", bar: "bg-emerald-500" },
  medium: { color: "text-amber-400", bar: "bg-yellow-500" },
  high: { color: "text-red-400", bar: "bg-red-400" },
  very_high: { color: "text-red-500", bar: "bg-red-600" },
};
const priorityColors: Record<string, string> = {
  high: "text-red-400 bg-red-500/10 border-red-500/20",
  medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  low: "text-slate-400 bg-slate-500/10 border-slate-500/20",
};
const severityColors: Record<string, string> = {
  critical: "text-red-400 bg-red-500/10 border-red-500/20",
  warning: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  info: "text-blue-400 bg-blue-500/10 border-blue-500/20",
};

const VACCINE_OPTIONS = [
  "BCG", "OPV", "Penta", "PCV", "Rota", "IPV", "MR", "Yellow Fever", "Td", "HPV",
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function monthsAgo(dateStr: string): number {
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24 * 30);
}

export default function SettlementDetail() {
  const [, params] = useRoute("/settlements/:id");
  const id = Number(params?.id);
  const { toast } = useToast();
  const { data: settlement, isLoading, refetch } = useGetSettlement(id);
  const { mutate: updateRec, isPending: recPending } = useUpdateRecommendation();
  const { mutate: logOutreach, isPending: outreachPending } = useLogOutreach();

  const [showForm, setShowForm] = useState(false);
  const [visitDate, setVisitDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedVaccines, setSelectedVaccines] = useState<string[]>([]);
  const [childrenCount, setChildrenCount] = useState("");
  const [outreachNotes, setOutreachNotes] = useState("");
  const [showAllSessions, setShowAllSessions] = useState(false);

  const handleAccept = (recId: number) => {
    updateRec({ id: recId, status: "accepted" }, {
      onSuccess: () => { toast({ title: "Recommendation accepted" }); refetch(); },
    });
  };
  const handleDismiss = (recId: number) => {
    updateRec({ id: recId, status: "dismissed" }, {
      onSuccess: () => { toast({ title: "Recommendation dismissed" }); refetch(); },
    });
  };

  const toggleVaccine = (v: string) => {
    setSelectedVaccines(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  };

  const handleSubmitOutreach = () => {
    if (!visitDate || selectedVaccines.length === 0 || !childrenCount) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    logOutreach(
      {
        id,
        data: {
          visitDate,
          vaccineTypes: selectedVaccines.join(", "),
          childrenVaccinated: parseInt(childrenCount),
          notes: outreachNotes || undefined,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Outreach session logged", description: `${childrenCount} children vaccinated` });
          setShowForm(false);
          setSelectedVaccines([]);
          setChildrenCount("");
          setOutreachNotes("");
          refetch();
        },
        onError: () => {
          toast({ title: "Failed to log outreach", variant: "destructive" });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-5">
        <Skeleton className="h-8 w-64 bg-slate-800" />
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 bg-slate-800 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!settlement) {
    return (
      <div className="p-6">
        <p className="text-slate-500">Settlement not found.</p>
        <Link href="/settlements" className="mt-2 text-sm text-slate-400 hover:text-slate-200 inline-block">← Back to settlements</Link>
      </div>
    );
  }

  const sc = statusConfig[settlement.serviceStatus as keyof typeof statusConfig] ?? statusConfig.unserved;
  const rc = settlement.riskLevel ? riskConfig[settlement.riskLevel as keyof typeof riskConfig] : null;
  const pendingRecs = settlement.recommendations?.filter((r: any) => r.status === "pending") ?? [];
  const activeAlerts = settlement.alerts?.filter((a: any) => !a.dismissed) ?? [];
  const outreachSessions = (settlement as any).outreachSessions ?? [];
  const lastSession = outreachSessions[0] ?? null;
  const visibleSessions = showAllSessions ? outreachSessions : outreachSessions.slice(0, 3);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/settlements">
          <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-300 -ml-2 mt-0.5">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl font-bold text-slate-100">{settlement.name}</h2>
            <Badge className={`border ${sc.color}`}>{sc.label}</Badge>
            {settlement.isNewSettlement && (
              <Badge className="bg-purple-500/10 text-purple-400 border border-purple-500/20">Newly Detected</Badge>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" /> {settlement.district} District ·{" "}
            {settlement.latitude.toFixed(4)}, {settlement.longitude.toFixed(4)}
          </p>
        </div>
        {settlement.riskScore != null && (
          <div className="text-right shrink-0">
            <p className="text-xs text-slate-500 mb-1">Risk Score</p>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full ${rc?.bar ?? "bg-slate-500"}`}
                  style={{ width: `${settlement.riskScore}%` }}
                />
              </div>
              <span className={`text-lg font-bold ${rc?.color ?? "text-slate-400"}`}>{settlement.riskScore}</span>
            </div>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Population", value: settlement.population.toLocaleString(), icon: Users, color: "text-blue-400" },
          { label: "Households", value: settlement.households?.toLocaleString() ?? "—", icon: Building2, color: "text-purple-400" },
          { label: "Children U5", value: settlement.childrenUnderFive?.toLocaleString() ?? "—", icon: Shield, color: "text-emerald-400" },
          { label: "Pregnant Women", value: settlement.pregnantWomen?.toLocaleString() ?? "—", icon: Users, color: "text-pink-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="bg-slate-900 border-slate-800">
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className={`w-5 h-5 ${color} shrink-0`} />
              <div>
                <p className="text-xs text-slate-500">{label}</p>
                <p className="text-base font-bold text-slate-100">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Nearest Facility / Travel Times */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Hospital className="w-4 h-4 text-blue-400" /> Nearest Health Facility
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {settlement.nearestFacility ? (
              <>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                  <Hospital className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-slate-200">{settlement.nearestFacility.name}</p>
                    <p className="text-xs text-slate-500">{settlement.nearestFacility.type}</p>
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {settlement.nearestFacility.distanceKm?.toFixed(1)} km away
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Walking", icon: Footprints, value: settlement.nearestFacility.travelTimeWalkingMin, unit: "min" },
                    { label: "Motorcycle", icon: Bike, value: settlement.nearestFacility.travelTimeMotorcycleMin, unit: "min" },
                    { label: "Vehicle", icon: Car, value: settlement.nearestFacility.travelTimeVehicleMin, unit: "min" },
                  ].map(({ label, icon: Icon, value }) => (
                    <div key={label} className="text-center p-2.5 rounded-lg bg-slate-800/50 border border-slate-800">
                      <Icon className="w-4 h-4 text-slate-500 mx-auto mb-1" />
                      <p className="text-base font-bold text-slate-200">{value ?? "—"}</p>
                      <p className="text-[10px] text-slate-600">{label}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-600 py-4 text-center">No linked facility</p>
            )}
          </CardContent>
        </Card>

        {/* Satellite / Detection Info */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Satellite className="w-4 h-4 text-purple-400" /> Detection & Population Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Building Count", value: settlement.buildingCount?.toLocaleString() ?? "—", source: "Sentinel-2 / Open Buildings (sim.)" },
                { label: "Confidence Score", value: settlement.confidenceScore != null ? `${Math.round(settlement.confidenceScore * 100)}%` : "—", source: "Satellite classification" },
                { label: "Population Est.", value: settlement.population.toLocaleString(), source: "WorldPop API (pre-computed)" },
                { label: "Children U1", value: settlement.childrenUnderOne?.toLocaleString() ?? "—", source: "Meta population density" },
              ].map(({ label, value, source }) => (
                <div key={label} className="p-2.5 rounded-lg bg-slate-800/50 border border-slate-800">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="text-base font-bold text-slate-200">{value}</p>
                  <p className="text-[10px] text-slate-600 mt-0.5 truncate">{source}</p>
                </div>
              ))}
            </div>
            <div className="p-2.5 rounded-lg bg-slate-800/30 border border-slate-800/50">
              <p className="text-[10px] text-slate-600">
                Population data sourced from WorldPop 2024 and Meta High Resolution Settlement Layer (HRSL). Building detection via Sentinel-2 L2A imagery + Google Open Buildings v3 (simulated). Travel times via OSM road-network routing (pre-computed).
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Outreach Sessions */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Syringe className="w-4 h-4 text-emerald-400" /> Outreach History
              {outreachSessions.length > 0 && (
                <span className="text-xs text-slate-500 font-normal">({outreachSessions.length} session{outreachSessions.length !== 1 ? "s" : ""})</span>
              )}
            </CardTitle>
            <Button
              size="sm"
              className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => setShowForm(f => !f)}
            >
              <Plus className="w-3 h-3 mr-1" /> Log outreach
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">

          {/* Log form */}
          {showForm && (
            <div className="p-4 rounded-lg bg-slate-800/60 border border-emerald-500/20 space-y-4">
              <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">New outreach session</p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Visit date *</label>
                  <input
                    type="date"
                    value={visitDate}
                    onChange={e => setVisitDate(e.target.value)}
                    max={new Date().toISOString().slice(0, 10)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Children vaccinated *</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 24"
                    value={childrenCount}
                    onChange={e => setChildrenCount(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-2">Vaccine types covered *</label>
                <div className="flex flex-wrap gap-1.5">
                  {VACCINE_OPTIONS.map(v => (
                    <button
                      key={v}
                      onClick={() => toggleVaccine(v)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        selectedVaccines.includes(v)
                          ? "bg-emerald-600 border-emerald-500 text-white"
                          : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Notes (optional)</label>
                <textarea
                  rows={2}
                  placeholder="Any relevant notes about this session…"
                  value={outreachNotes}
                  onChange={e => setOutreachNotes(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-3 text-xs text-slate-500 hover:text-slate-300"
                  onClick={() => setShowForm(false)}
                  disabled={outreachPending}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-7 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleSubmitOutreach}
                  disabled={outreachPending}
                >
                  {outreachPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                  Save session
                </Button>
              </div>
            </div>
          )}

          {/* Session list */}
          {outreachSessions.length === 0 && !showForm ? (
            <p className="text-sm text-slate-600 py-3 text-center italic">No outreach sessions recorded yet</p>
          ) : (
            visibleSessions.map((s: any) => {
              const ago = monthsAgo(s.visitDate);
              const recencyColor = ago <= 6 ? "text-emerald-400" : ago <= 12 ? "text-amber-400" : "text-slate-500";
              return (
                <div key={s.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/40 border border-slate-800">
                  <div className="mt-0.5 w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <Syringe className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-200">{formatDate(s.visitDate)}</p>
                      <span className={`text-[10px] font-medium ${recencyColor}`}>
                        {ago < 1 ? "This month" : ago <= 1.5 ? "~1 month ago" : `${Math.round(ago)}mo ago`}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      <span className="font-semibold text-slate-300">{s.childrenVaccinated}</span> children · {s.vaccineTypes}
                    </p>
                    {s.notes && <p className="text-[11px] text-slate-500 mt-0.5 italic">{s.notes}</p>}
                  </div>
                </div>
              );
            })
          )}

          {outreachSessions.length > 3 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 text-xs text-slate-500 hover:text-slate-300"
              onClick={() => setShowAllSessions(v => !v)}
            >
              {showAllSessions
                ? <><ChevronUp className="w-3 h-3 mr-1" /> Show less</>
                : <><ChevronDown className="w-3 h-3 mr-1" /> Show all {outreachSessions.length} sessions</>
              }
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Alerts */}
      {activeAlerts.length > 0 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" /> Active Alerts ({activeAlerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeAlerts.map((alert: any) => (
              <div key={alert.id} className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-800/50 border border-slate-800">
                <Badge className={`text-[10px] px-1.5 py-0 shrink-0 mt-0.5 border ${severityColors[alert.severity]}`}>{alert.severity}</Badge>
                <p className="text-sm text-slate-400">{alert.message}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {settlement.recommendations && settlement.recommendations.length > 0 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-emerald-400" /> Recommendations ({settlement.recommendations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {settlement.recommendations.map((rec: any) => (
              <div key={rec.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-800">
                <Badge className={`text-[10px] px-1.5 py-0 shrink-0 mt-0.5 border ${priorityColors[rec.priority]}`}>{rec.priority}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200">{rec.recommendationType}</p>
                  {rec.notes && <p className="text-xs text-slate-500 mt-0.5">{rec.notes}</p>}
                  <div className="flex items-center gap-3 mt-1.5">
                    {rec.expectedChildren != null && (
                      <span className="text-[10px] text-slate-600">{rec.expectedChildren} children U5</span>
                    )}
                    {rec.expectedInfants != null && (
                      <span className="text-[10px] text-slate-600">{rec.expectedInfants} infants U1</span>
                    )}
                  </div>
                </div>
                {rec.status === "pending" && (
                  <div className="flex gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => handleAccept(rec.id)}
                      disabled={recPending}
                    >
                      <CheckCircle className="w-3 h-3 mr-1" /> Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2.5 text-xs text-slate-500 hover:text-slate-300"
                      onClick={() => handleDismiss(rec.id)}
                      disabled={recPending}
                    >
                      <XCircle className="w-3 h-3" />
                    </Button>
                  </div>
                )}
                {rec.status !== "pending" && (
                  <Badge className={rec.status === "accepted" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-slate-500/10 text-slate-500 border border-slate-600/20"}>
                    {rec.status}
                  </Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
