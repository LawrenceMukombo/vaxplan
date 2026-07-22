import { useState, useEffect, useMemo } from "react";
import { useRoute, Link } from "wouter";
import {
  ArrowLeft, Users, MapPin, Building2, Hospital,
  Clock, Footprints, Bike, Car, AlertTriangle,
  CheckCircle, XCircle, Satellite, ClipboardList, Shield,
  Syringe, Plus, ChevronDown, ChevronUp, Loader2,
} from "lucide-react";
import { 
  useGetSettlement, 
  useUpdateRecommendation, 
  useLogOutreach,
  useLinkFacility,
  useLinkCommunity,
  useConvertToCommunity,
  useUpdateSettlement,
  useGetFacilities
} from "@/hooks/vgie/useVgieApi";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";

const statusConfig = {
  served: { label: "Served", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  underserved: { label: "Underserved", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  unserved: { label: "Unserved", color: "text-red-400 bg-red-500/10 border-red-500/20" },
};
const riskConfig = {
  low: { color: "text-muted-foreground", bar: "bg-emerald-500" },
  medium: { color: "text-amber-400", bar: "bg-yellow-500" },
  high: { color: "text-red-400", bar: "bg-red-400" },
  very_high: { color: "text-red-500", bar: "bg-red-600" },
};
const priorityColors: Record<string, string> = {
  high: "text-red-400 bg-red-500/10 border-red-500/20",
  medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  low: "text-muted-foreground bg-slate-500/10 border-border/20",
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

  // New mutations
  const linkFacilityMutation = useLinkFacility();
  const linkCommunityMutation = useLinkCommunity();
  const convertToCommunityMutation = useConvertToCommunity();
  const updateSettlementMutation = useUpdateSettlement();

  // Cascade filter state for Linkage Configuration
  const [filterProvinceId, setFilterProvinceId] = useState("");
  const [filterDistrictId, setFilterDistrictId] = useState("");
  const [cascadePrePopulated, setCascadePrePopulated] = useState(false);

  // Provinces list
  const { data: allProvinces } = useQuery<any[]>({
    queryKey: ["/api/provinces"],
    queryFn: async () => {
      const res = await fetch("/api/provinces");
      if (!res.ok) throw new Error("Failed to fetch provinces");
      return res.json();
    }
  });

  // All districts (filtered client-side by province)
  const { data: allDistrictsRaw } = useQuery<any[]>({
    queryKey: ["/api/districts"],
    queryFn: async () => {
      const res = await fetch("/api/districts");
      if (!res.ok) throw new Error("Failed to fetch districts");
      return res.json();
    }
  });

  // Filtered districts for the dropdown (by selected province)
  const allDistricts = useMemo(() => {
    if (!allDistrictsRaw) return [];
    if (!filterProvinceId || filterProvinceId === "all") return allDistrictsRaw;
    return allDistrictsRaw.filter((d: any) => String(d.provinceId) === filterProvinceId);
  }, [allDistrictsRaw, filterProvinceId]);

  // Fetch facilities for the selected district (avoids downloading 20,000 across the country)
  const { data: allFacilities } = useGetFacilities(
    filterDistrictId && filterDistrictId !== "all"
      ? { districtId: filterDistrictId }
      : undefined
  );

  // Fetch communities ONLY for the selected district
  const { data: allCommunities } = useQuery<any[]>({
    queryKey: ["/api/villages", filterDistrictId],
    queryFn: async () => {
      // If no district selected yet, return empty array to prevent massive data fetch
      if (!filterDistrictId || filterDistrictId === "all") return [];
      const res = await fetch(`/api/villages?districtId=${filterDistrictId}`);
      if (!res.ok) throw new Error("Failed to fetch communities");
      return res.json();
    },
    enabled: !!filterDistrictId && filterDistrictId !== "all",
  });

  // Pre-populate cascade from settlement's own location once loaded (useEffect — never during render)
  useEffect(() => {
    if (settlement && !cascadePrePopulated && allDistrictsRaw && allProvinces) {
      let finalProvId = settlement.provinceId ? String(settlement.provinceId) : "";
      let finalDistId = settlement.districtId ? String(settlement.districtId) : "";

      // Database inconsistency self-healing:
      // If the settlement's district is in our allowed districts list, use that district's provinceId!
      if (finalDistId) {
        const matchingDistrict = allDistrictsRaw.find((d: any) => String(d.id) === finalDistId);
        if (matchingDistrict) {
          finalProvId = String(matchingDistrict.provinceId);
        }
      }

      // If the resolved provinceId is not valid in the current tenant's province list, clear it
      if (finalProvId && !allProvinces.some((p: any) => String(p.id) === finalProvId)) {
        finalProvId = "";
      }

      setFilterProvinceId(finalProvId);
      setFilterDistrictId(finalDistId);
      setCascadePrePopulated(true);
    }
  }, [settlement, cascadePrePopulated, allDistrictsRaw, allProvinces]);

  const [showForm, setShowForm] = useState(false);
  const [visitDate, setVisitDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedVaccines, setSelectedVaccines] = useState<string[]>([]);
  const [childrenCount, setChildrenCount] = useState("");
  const [outreachNotes, setOutreachNotes] = useState("");
  const [showAllSessions, setShowAllSessions] = useState(false);

  // Link form states
  const [facilityIdStr, setFacilityIdStr] = useState("");
  const [transportMode, setTransportMode] = useState("walking");
  const [linkNotes, setLinkNotes] = useState("");
  const [communityIdStr, setCommunityIdStr] = useState("");

  // Edit form states
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editLat, setEditLat] = useState("");
  const [editLng, setEditLng] = useState("");
  const [editPop, setEditPop] = useState("");
  const [editValidation, setEditValidation] = useState("");
  const [editService, setEditService] = useState("");
  const [editRisk, setEditRisk] = useState("");
  const [editHtr, setEditHtr] = useState(false);

  const openEdit = () => {
    if (!settlement) return;
    setEditName(settlement.name || "");
    setEditLat(settlement.latitude ? String(settlement.latitude) : "");
    setEditLng(settlement.longitude ? String(settlement.longitude) : "");
    setEditPop(settlement.population ? String(settlement.population) : "");
    setEditValidation(settlement.validationStatus || "pending");
    setEditService(settlement.serviceStatus || "unserved");
    setEditRisk(settlement.riskLevel || "low");
    setEditHtr(!!settlement.isHardToReach);
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateSettlementMutation.mutateAsync({
        id,
        name: editName,
        latitude: Number(editLat),
        longitude: Number(editLng),
        populationEstimate: Number(editPop),
        validationStatus: editValidation,
        serviceStatus: editService,
        riskLevel: editRisk,
        hardToReach: editHtr,
      });
      setIsEditOpen(false);
      refetch();
    } catch (err) {
      // handled
    }
  };

  const handleLinkFacility = async () => {
    if (!facilityIdStr) return;
    try {
      await linkFacilityMutation.mutateAsync({
        id,
        facilityId: Number(facilityIdStr),
        transportMode,
        notes: linkNotes || undefined,
        linkMethod: "manual"
      });
      toast({ title: "Linked to facility successfully" });
      setFacilityIdStr("");
      setLinkNotes("");
      refetch();
    } catch (err) {
      // handled
    }
  };

  const handleLinkCommunity = async () => {
    if (!communityIdStr) return;
    try {
      await linkCommunityMutation.mutateAsync({
        id,
        communityId: Number(communityIdStr)
      });
      toast({ title: "Linked to community successfully" });
      setCommunityIdStr("");
      refetch();
    } catch (err) {
      // handled
    }
  };

  const handleConvertToCommunity = async () => {
    try {
      await convertToCommunityMutation.mutateAsync(id);
      toast({ title: "Settlement converted to community successfully" });
      refetch();
    } catch (err) {
      // handled
    }
  };

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
        <Skeleton className="h-8 w-64 bg-muted" />
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 bg-muted rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!settlement) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Settlement not found.</p>
        <Link href="/settlements" className="mt-2 text-sm text-muted-foreground hover:text-foreground inline-block">← Back to settlements</Link>
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
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground -ml-2 mt-0.5">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl font-bold text-foreground">{settlement.name}</h2>
            <Badge className={`border ${sc.color}`}>{sc.label}</Badge>
            {settlement.isNewSettlement && (
              <Badge className="bg-purple-500/10 text-purple-400 border border-purple-500/20">Newly Detected</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" /> {settlement.district} District ·{" "}
            {settlement.latitude ? Number(settlement.latitude).toFixed(4) : "—"}, {settlement.longitude ? Number(settlement.longitude).toFixed(4) : "—"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" className="h-8 border hover:bg-accent text-foreground text-xs font-semibold" onClick={openEdit}>
            Edit Details
          </Button>
          {!settlement.linkedCommunity && (
            <Button size="sm" className="h-8 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold" onClick={handleConvertToCommunity}>
              Convert to Community
            </Button>
          )}
        </div>
        {settlement.riskScore != null && (
          <div className="text-right shrink-0">
            <p className="text-xs text-muted-foreground mb-1">Risk Score</p>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${rc?.bar ?? "bg-slate-500"}`}
                  style={{ width: `${settlement.riskScore}%` }}
                />
              </div>
              <span className={`text-lg font-bold ${rc?.color ?? "text-muted-foreground"}`}>{settlement.riskScore}</span>
            </div>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Population", value: settlement.population != null && settlement.population > 0 ? settlement.population.toLocaleString() : "—", icon: Users, color: "text-blue-400" },
          { label: "Households", value: settlement.households != null ? settlement.households.toLocaleString() : (settlement.population && settlement.population > 0 ? Math.round(settlement.population / 5).toLocaleString() : "—"), icon: Building2, color: "text-purple-400" },
          { label: "Children U5", value: settlement.childrenUnderFive != null ? settlement.childrenUnderFive.toLocaleString() : (settlement.under5Population ? settlement.under5Population.toLocaleString() : (settlement.population && settlement.population > 0 ? Math.round(settlement.population * 0.18).toLocaleString() : "—")), icon: Shield, color: "text-emerald-400" },
          { label: "Pregnant Women", value: settlement.pregnantWomen != null ? settlement.pregnantWomen.toLocaleString() : (settlement.population && settlement.population > 0 ? Math.round(settlement.population * 0.05).toLocaleString() : "—"), icon: Users, color: "text-pink-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="bg-background border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className={`w-5 h-5 ${color} shrink-0`} />
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-base font-bold text-foreground">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left/Middle column (2/3 width) */}
        <div className="lg:col-span-2 space-y-5">
          {/* Nearest Facility / Travel Times */}
          <Card className="bg-background border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Hospital className="w-4 h-4 text-blue-400" /> Nearest Health Facility & Travel
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {settlement.nearestFacility ? (
                <>
                  <div className="flex items-start justify-between gap-3 p-3 rounded-lg bg-muted border border-border">
                    <div className="flex items-start gap-3">
                      <Hospital className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-foreground">{settlement.nearestFacility.name}</p>
                        <p className="text-xs text-muted-foreground">{settlement.nearestFacility.type}</p>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {settlement.nearestFacility.distanceKm?.toFixed(1)} km away (nearest)
                        </p>
                      </div>
                    </div>
                    {settlement.assignedFacility && (
                      <div className="border-l border-border pl-4 text-left">
                        <p className="text-xs text-muted-foreground">Currently Linked Facility:</p>
                        <p className="font-medium text-sky-400 text-xs mt-0.5">{settlement.assignedFacility.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {settlement.distanceToFacility != null ? `${Number(settlement.distanceToFacility).toFixed(1)} km` : "—"} away
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Walking", icon: Footprints, value: settlement.nearestFacility.travelTimeWalkingMin, unit: "min" },
                      { label: "Motorcycle", icon: Bike, value: settlement.nearestFacility.travelTimeMotorcycleMin, unit: "min" },
                      { label: "Vehicle", icon: Car, value: settlement.nearestFacility.travelTimeVehicleMin, unit: "min" },
                    ].map(({ label, icon: Icon, value }) => (
                      <div key={label} className="text-center p-2.5 rounded-lg bg-muted border border-border">
                        <Icon className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
                        <p className="text-base font-bold text-foreground">{value ?? "—"}</p>
                        <p className="text-[10px] text-muted-foreground">{label}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">No linked facility</p>
              )}
            </CardContent>
          </Card>

          {/* Linkage Configuration Panel */}
          <Card className="bg-background border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Building2 className="w-4 h-4 text-sky-400" /> Linkage Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Shared Location Cascade Filters */}
              <div className="p-3 rounded-lg bg-sky-500/5 border border-sky-500/15 space-y-2">
                <p className="text-[10px] font-semibold text-sky-400 uppercase tracking-wide flex items-center gap-1.5">
                  <MapPin className="w-3 h-3" /> Location Filter (narrows facility &amp; community lists below)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {/* Province Filter */}
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">Province</label>
                    <Select
                      value={filterProvinceId}
                      onValueChange={(v) => {
                        setFilterProvinceId(v);
                        setFilterDistrictId(""); // reset district when province changes
                        setFacilityIdStr("");    // reset selection
                        setCommunityIdStr("");
                      }}
                    >
                      <SelectTrigger className="h-8 bg-background border-border text-foreground text-xs">
                        <SelectValue placeholder="All provinces" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border border-border text-foreground">
                        <SelectItem value="all" className="text-xs text-foreground hover:bg-accent cursor-pointer">All Provinces</SelectItem>
                        {allProvinces?.map((p: any) => (
                          <SelectItem key={p.id} value={String(p.id)} className="text-xs text-foreground hover:bg-accent cursor-pointer">
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* District Filter */}
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">District</label>
                    <Select
                      value={filterDistrictId}
                      onValueChange={(v) => {
                        setFilterDistrictId(v);
                        setFacilityIdStr("");   // reset selection
                        setCommunityIdStr("");
                      }}
                    >
                      <SelectTrigger className="h-8 bg-background border-border text-foreground text-xs">
                        <SelectValue placeholder="All districts" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border border-border text-foreground">
                        <SelectItem value="all" className="text-xs text-foreground hover:bg-accent cursor-pointer">All Districts</SelectItem>
                        {allDistricts
                          ?.filter((d: any) =>
                            !filterProvinceId || filterProvinceId === "all"
                              ? true
                              : d.provinceId === Number(filterProvinceId)
                          )
                          .map((d: any) => (
                            <SelectItem key={d.id} value={String(d.id)} className="text-xs text-foreground hover:bg-accent cursor-pointer">
                              {d.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {/* Active filter chips */}
                {(filterProvinceId && filterProvinceId !== "all") || (filterDistrictId && filterDistrictId !== "all") ? (
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-[10px] text-muted-foreground">Active:</span>
                    {filterProvinceId && filterProvinceId !== "all" && (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded px-1.5 py-0.5">
                        {allProvinces?.find((p: any) => String(p.id) === filterProvinceId)?.name ?? "Province"}
                        <button onClick={() => { setFilterProvinceId(""); setFilterDistrictId(""); }} className="hover:text-sky-200 leading-none">×</button>
                      </span>
                    )}
                    {filterDistrictId && filterDistrictId !== "all" && (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded px-1.5 py-0.5">
                        {allDistricts?.find((d: any) => String(d.id) === filterDistrictId)?.name ?? "District"}
                        <button onClick={() => setFilterDistrictId("")} className="hover:text-sky-200 leading-none">×</button>
                      </span>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Link Health Facility Form */}
                <div className="p-3.5 rounded-lg bg-muted border border-border space-y-3">
                  <p className="text-xs font-bold text-foreground uppercase tracking-wide">Link Health Facility</p>
                  <div className="flex flex-col gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-1">
                        Select Facility *
                        {allFacilities && (
                          <span className="ml-1 text-sky-400">
                            ({allFacilities.length} available)
                          </span>
                        )}
                      </label>
                      <Select value={facilityIdStr} onValueChange={setFacilityIdStr}>
                        <SelectTrigger className="h-8 bg-background border-border text-foreground text-xs">
                          <SelectValue placeholder="Select facility" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border border-border text-foreground">
                          {allFacilities?.length === 0 && (
                            <div className="p-2 text-xs text-muted-foreground text-center">No facilities in selected area</div>
                          )}
                          {allFacilities?.map((f: any) => (
                            <SelectItem key={f.id} value={String(f.id)} className="text-xs text-foreground hover:bg-accent cursor-pointer">
                              {f.name} — {f.district}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-1">Transport Mode</label>
                      <Select value={transportMode} onValueChange={setTransportMode}>
                        <SelectTrigger className="h-8 bg-background border-border text-foreground text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border border-border text-foreground text-xs">
                          <SelectItem value="walking">Walking</SelectItem>
                          <SelectItem value="bicycle">Bicycle</SelectItem>
                          <SelectItem value="motorbike">Motorcycle</SelectItem>
                          <SelectItem value="car">Vehicle / Car</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-1">Link Notes</label>
                      <input
                        placeholder="Add connection notes..."
                        value={linkNotes}
                        onChange={(e) => setLinkNotes(e.target.value)}
                        className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    <Button
                      size="sm"
                      disabled={!facilityIdStr || linkFacilityMutation.isPending}
                      className="h-8 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold mt-1"
                      onClick={handleLinkFacility}
                    >
                      {linkFacilityMutation.isPending ? "Linking..." : "Link Facility"}
                    </Button>
                  </div>
                </div>

                {/* Link Community Form */}
                <div className="p-3.5 rounded-lg bg-muted border border-border space-y-3">
                  <p className="text-xs font-bold text-foreground uppercase tracking-wide">Link Community</p>
                  <div className="flex flex-col gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-1">
                        Select Registered Community *
                        {allCommunities && (
                          <span className="ml-1 text-sky-400">
                            ({allCommunities.length} available)
                          </span>
                        )}
                      </label>
                      <Select value={communityIdStr} onValueChange={setCommunityIdStr}>
                        <SelectTrigger className="h-8 bg-background border-border text-foreground text-xs">
                          <SelectValue placeholder="Select community" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border border-border text-foreground">
                          {allCommunities?.length === 0 && (
                            <div className="p-2 text-xs text-muted-foreground text-center">No communities in selected area</div>
                          )}
                          {allCommunities?.map((c: any) => (
                            <SelectItem key={c.id} value={String(c.id)} className="text-xs text-foreground hover:bg-accent cursor-pointer">
                              {c.name} ({c.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {settlement.linkedCommunity ? (
                      <div className="text-[10px] text-sky-400 p-1.5 bg-sky-500/5 rounded border border-sky-500/10">
                        Linked to community: <span className="font-bold">{settlement.linkedCommunity.name}</span> ({settlement.linkedCommunity.code})
                      </div>
                    ) : (
                      <div className="text-[10px] text-muted-foreground py-1 bg-background/30 rounded p-1.5 border border-border/20">
                        Linking matches a geographic settlement to an operational planning unit (community).
                      </div>
                    )}
                    <Button
                      size="sm"
                      disabled={!communityIdStr || linkCommunityMutation.isPending}
                      className="h-8 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold mt-1"
                      onClick={handleLinkCommunity}
                    >
                      {linkCommunityMutation.isPending ? "Linking..." : "Link Community"}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Satellite / Detection Info */}
          <Card className="bg-background border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Satellite className="w-4 h-4 text-purple-400" /> Detection & Population Data
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Building Count", value: settlement.buildingCount != null ? Number(settlement.buildingCount).toLocaleString() : "—", source: "Sentinel-2 / Open Buildings" },
                  { label: "Confidence Score", value: settlement.confidenceScore != null ? `${Math.round(Number(settlement.confidenceScore) * 100)}%` : "—", source: "Satellite classification" },
                  { label: "Population Est.", value: settlement.population != null && settlement.population > 0 ? settlement.population.toLocaleString() : (settlement.under5Population ? Math.round(settlement.under5Population / 0.18).toLocaleString() : "—"), source: "WorldPop API (pre-computed)" },
                  { label: "Children U1", value: settlement.childrenUnderOne != null ? settlement.childrenUnderOne.toLocaleString() : (settlement.population != null && settlement.population > 0 ? Math.round(settlement.population * 0.04).toLocaleString() : "—"), source: "Meta population density" },
                ].map(({ label, value, source }) => (
                  <div key={label} className="p-2.5 rounded-lg bg-muted border border-border">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-base font-bold text-foreground">{value}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{source}</p>
                  </div>
                ))}
              </div>
              <div className="p-2.5 rounded-lg bg-muted border border-border">
                <p className="text-[10px] text-muted-foreground">
                  Population data sourced from WorldPop 2024 and Meta High Resolution Settlement Layer (HRSL). Building detection via Sentinel-2 L2A imagery + Google Open Buildings v3 (simulated). Travel times via OSM road-network routing (pre-computed).
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Outreach Sessions */}
          <Card className="bg-background border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Syringe className="w-4 h-4 text-emerald-400" /> Outreach History
                  {outreachSessions.length > 0 && (
                    <span className="text-xs text-muted-foreground font-normal">({outreachSessions.length} session{outreachSessions.length !== 1 ? "s" : ""})</span>
                  )}
                </CardTitle>
                <Button
                  size="sm"
                  className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  onClick={() => setShowForm(f => !f)}
                >
                  <Plus className="w-3 h-3 mr-1" /> Log outreach
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Log form */}
              {showForm && (
                <div className="p-4 rounded-lg bg-muted border border-emerald-500/20 space-y-4">
                  <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">New outreach session</p>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Visit date *</label>
                      <input
                        type="date"
                        value={visitDate}
                        onChange={e => setVisitDate(e.target.value)}
                        max={new Date().toISOString().slice(0, 10)}
                        className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Children vaccinated *</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="e.g. 24"
                        value={childrenCount}
                        onChange={e => setChildrenCount(e.target.value)}
                        className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground block mb-2">Vaccine types covered *</label>
                    <div className="flex flex-wrap gap-1.5">
                      {VACCINE_OPTIONS.map(v => (
                        <button
                          key={v}
                          onClick={() => toggleVaccine(v)}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                            selectedVaccines.includes(v)
                              ? "bg-emerald-600 border-emerald-500 text-white"
                              : "bg-background border-border text-muted-foreground hover:border-border"
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Notes (optional)</label>
                    <textarea
                      rows={2}
                      placeholder="Any relevant notes about this session…"
                      value={outreachNotes}
                      onChange={e => setOutreachNotes(e.target.value)}
                      className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:border-emerald-500 resize-none"
                    />
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-3 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => setShowForm(false)}
                      disabled={outreachPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
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
                <p className="text-sm text-muted-foreground py-3 text-center italic">No outreach sessions recorded yet</p>
              ) : (
                visibleSessions.map((s: any) => {
                  const ago = monthsAgo(s.visitDate);
                  const recencyColor = ago <= 6 ? "text-emerald-400" : ago <= 12 ? "text-amber-400" : "text-muted-foreground";
                  return (
                    <div key={s.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted border border-border">
                      <div className="mt-0.5 w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                        <Syringe className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">{formatDate(s.visitDate)}</p>
                          <span className={`text-[10px] font-medium ${recencyColor}`}>
                            {ago < 1 ? "This month" : ago <= 1.5 ? "~1 month ago" : `${Math.round(ago)}mo ago`}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          <span className="font-semibold text-foreground">{s.childrenVaccinated}</span> children · {s.vaccineTypes}
                        </p>
                        {s.notes && <p className="text-[11px] text-muted-foreground mt-0.5 italic">{s.notes}</p>}
                      </div>
                    </div>
                  );
                })
              )}

              {outreachSessions.length > 3 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-xs text-muted-foreground hover:text-foreground font-semibold"
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
        </div>

        {/* Right column (1/3 width) */}
        <div className="space-y-5">
          {/* Smart Suggestions */}
          <Card className="bg-background border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Shield className="w-4 h-4 text-purple-400" /> Smart Suggestions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {settlement.suggestions && settlement.suggestions.length > 0 ? (
                settlement.suggestions.map((sug: any, idx: number) => (
                  <div key={idx} className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/10 hover:border-purple-500/20 transition-all space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-purple-400">{sug.title}</span>
                      <Badge variant="outline" className="text-[9px] px-1 bg-purple-500/10 text-purple-400 border-purple-500/20 font-bold">
                        {(sug.confidence * 100).toFixed(0)}% Conf
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{sug.description}</p>
                    <p className="text-[10px] text-purple-400/80 italic">Reason: {sug.reason}</p>
                    {sug.actionable && (
                      <div className="pt-1">
                        {sug.type === "link_facility" || sug.type === "catchment_polygon" || sug.type === "reassign_facility" ? (
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-purple-600 hover:bg-purple-700 text-white font-semibold"
                            onClick={() => {
                              linkFacilityMutation.mutate({
                                id,
                                facilityId: sug.suggestedFacilityId,
                                transportMode: "walking",
                                linkMethod: "system_suggested"
                              }, {
                                onSuccess: () => {
                                  toast({ title: "Linked to facility from suggestion" });
                                  refetch();
                                }
                              });
                            }}
                            disabled={linkFacilityMutation.isPending}
                          >
                            Link Suggested Facility
                          </Button>
                        ) : sug.type === "merge_community" ? (
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-purple-600 hover:bg-purple-700 text-white font-semibold"
                            onClick={() => {
                              linkCommunityMutation.mutate({
                                id,
                                communityId: sug.suggestedCommunityId
                              }, {
                                onSuccess: () => {
                                  toast({ title: "Linked to community from suggestion" });
                                  refetch();
                                }
                              });
                            }}
                            disabled={linkCommunityMutation.isPending}
                          >
                            Link Suggested Community
                          </Button>
                        ) : null}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground italic text-center py-4">No suggestions available. Geographic linkages appear optimized.</p>
              )}
            </CardContent>
          </Card>

          {/* Alerts */}
          {activeAlerts.length > 0 && (
            <Card className="bg-background border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" /> Active Alerts ({activeAlerts.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {activeAlerts.map((alert: any) => (
                  <div key={alert.id} className="flex items-start gap-2.5 p-3 rounded-lg bg-muted border border-border">
                    <Badge className={`text-[10px] px-1.5 py-0 shrink-0 mt-0.5 border ${severityColors[alert.severity]}`}>{alert.severity}</Badge>
                    <p className="text-sm text-muted-foreground">{alert.message}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {settlement.recommendations && settlement.recommendations.length > 0 && (
            <Card className="bg-background border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-emerald-400" /> Recommendations ({settlement.recommendations.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {settlement.recommendations.map((rec: any) => (
                  <div key={rec.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted border border-border">
                    <Badge className={`text-[10px] px-1.5 py-0 shrink-0 mt-0.5 border ${priorityColors[rec.priority]}`}>{rec.priority}</Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{rec.recommendationType}</p>
                      {rec.notes && <p className="text-xs text-muted-foreground mt-0.5">{rec.notes}</p>}
                      <div className="flex items-center gap-3 mt-1.5">
                        {rec.expectedChildren != null && (
                          <span className="text-[10px] text-muted-foreground">{rec.expectedChildren} children U5</span>
                        )}
                        {rec.expectedInfants != null && (
                          <span className="text-[10px] text-muted-foreground">{rec.expectedInfants} infants U1</span>
                        )}
                      </div>
                    </div>
                    {rec.status === "pending" && (
                      <div className="flex gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                          onClick={() => handleAccept(rec.id)}
                          disabled={recPending}
                        >
                          <CheckCircle className="w-3 h-3 mr-1" /> Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground font-semibold"
                          onClick={() => handleDismiss(rec.id)}
                          disabled={recPending}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                    {rec.status !== "pending" && (
                      <Badge className={rec.status === "accepted" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-slate-500/10 text-muted-foreground border border-border/20"}>
                        {rec.status}
                      </Badge>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Edit Details Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="bg-background border border-border sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-foreground font-bold">Edit Settlement Details</DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Modify geographic and population attributes for {settlement.name}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 py-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Settlement Name</label>
              <Input
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-9 bg-background border-border text-foreground"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Latitude</label>
                <Input
                  required
                  type="number"
                  step="any"
                  value={editLat}
                  onChange={(e) => setEditLat(e.target.value)}
                  className="h-9 bg-background border-border text-foreground"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Longitude</label>
                <Input
                  required
                  type="number"
                  step="any"
                  value={editLng}
                  onChange={(e) => setEditLng(e.target.value)}
                  className="h-9 bg-background border-border text-foreground"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Population Estimate</label>
              <Input
                type="number"
                value={editPop}
                onChange={(e) => setEditPop(e.target.value)}
                className="h-9 bg-background border-border text-foreground"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Validation Status</label>
              <Select value={editValidation} onValueChange={setEditValidation}>
                <SelectTrigger className="h-9 bg-background border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border text-foreground">
                  <SelectItem value="pending" className="cursor-pointer hover:bg-accent">Pending Review</SelectItem>
                  <SelectItem value="approved" className="cursor-pointer hover:bg-accent">Approved</SelectItem>
                  <SelectItem value="rejected" className="cursor-pointer hover:bg-accent">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Service Status</label>
                <Select value={editService} onValueChange={setEditService}>
                  <SelectTrigger className="h-9 bg-background border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border border-border text-foreground">
                    <SelectItem value="served" className="cursor-pointer hover:bg-accent">Served</SelectItem>
                    <SelectItem value="underserved" className="cursor-pointer hover:bg-accent">Underserved</SelectItem>
                    <SelectItem value="unserved" className="cursor-pointer hover:bg-accent">Unserved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Risk Level</label>
                <Select value={editRisk} onValueChange={setEditRisk}>
                  <SelectTrigger className="h-9 bg-background border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border border-border text-foreground">
                    <SelectItem value="low" className="cursor-pointer hover:bg-accent">Low</SelectItem>
                    <SelectItem value="medium" className="cursor-pointer hover:bg-accent">Medium</SelectItem>
                    <SelectItem value="high" className="cursor-pointer hover:bg-accent">High</SelectItem>
                    <SelectItem value="very_high" className="cursor-pointer hover:bg-accent">Very High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-muted border border-border mt-2">
              <label className="text-xs font-semibold text-foreground">Hard to Reach (HTR) Zone</label>
              <input
                type="checkbox"
                checked={editHtr}
                onChange={(e) => setEditHtr(e.target.checked)}
                className="w-4 h-4 border-border rounded text-primary focus:ring-primary focus:ring-1"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)} className="h-9 text-xs border text-foreground">
                Cancel
              </Button>
              <Button type="submit" disabled={updateSettlementMutation.isPending} className="h-9 text-xs bg-primary text-primary-foreground font-semibold">
                {updateSettlementMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
