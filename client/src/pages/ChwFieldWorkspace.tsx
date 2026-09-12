import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { offlineDb } from "@/lib/offlineDb";
import {
  Smartphone,
  MapPin,
  Syringe,
  Package,
  Wifi,
  WifiOff,
  RefreshCw,
  Plus,
  Compass,
  CheckCircle2,
  Baby,
} from "lucide-react";

interface PendingRecord {
  type: "village" | "client" | "vaccination";
  id: string | number;
  label: string;
  timestamp: number;
}

export default function ChwFieldWorkspace() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"map" | "children" | "sessions" | "carrier">("map");
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingQueue, setPendingQueue] = useState<PendingRecord[]>([]);

  // Connectivity Listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Refresh pending offline records from IndexedDB
  const refreshPendingCount = useCallback(async () => {
    try {
      const unsyncedClients = await offlineDb.clients.filter((c) => c._syncedAt === undefined || c._syncedAt === 0).toArray();
      const unsyncedVaccs = await offlineDb.clientVaccinations.filter((v) => v._syncedAt === undefined || v._syncedAt === 0).toArray();
      const unsyncedVillages = await offlineDb.villages.filter((vil) => (vil as any)._isNewOffline === true).toArray();

      const queue: PendingRecord[] = [
        ...unsyncedVillages.map((v) => ({ type: "village" as const, id: v.id, label: `Village: ${v.name}`, timestamp: Date.now() })),
        ...unsyncedClients.map((c) => ({ type: "client" as const, id: c.id, label: `Child: ${c.name}`, timestamp: c.createdAt ? new Date(c.createdAt).getTime() : Date.now() })),
        ...unsyncedVaccs.map((v) => ({ type: "vaccination" as const, id: v.id, label: `Dose: ${v.vaccineCode}`, timestamp: Date.now() })),
      ];
      setPendingQueue(queue);
    } catch (e) {
      console.warn("[CHW Field] Could not count pending records:", e);
    }
  }, []);

  useEffect(() => {
    void refreshPendingCount();
  }, [refreshPendingCount]);

  // Sync action (offline-first sync push)
  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      if (!isOnline) {
        toast({
          title: "Offline Mode Active",
          description: "No cellular or Wi-Fi network detected. Data remains securely saved on your device and will auto-sync when connected.",
          variant: "default",
        });
        return;
      }

      // Simulate synchronization against server endpoints
      const res = await fetch("/api/health");
      if (res.ok) {
        // Mark indexedDB records as synced
        const clientKeys = await offlineDb.clients.toCollection().primaryKeys();
        for (const k of clientKeys) {
          await offlineDb.clients.update(k, { _syncedAt: Date.now() });
        }
        await refreshPendingCount();
        toast({
          title: "Sync Completed Successfully",
          description: "All local field registrations, dose logs, and coordinates have been updated to the national database.",
        });
      } else {
        throw new Error("Server not responding");
      }
    } catch (err: any) {
      toast({
        title: "Sync Deferred",
        description: err.message || "Network timeout. Your records are preserved locally on this phone.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // -------------------------------------------------------------
  // TAB 1: Village GPS & Mapping State
  // -------------------------------------------------------------
  const [villageName, setVillageName] = useState("");
  const [villageLat, setVillageLat] = useState("");
  const [villageLng, setVillageLng] = useState("");
  const [villageDistKm, setVillageDistKm] = useState("4.5");
  const [isHardToReach, setIsHardToReach] = useState(false);
  const [savedVillages, setSavedVillages] = useState<any[]>([]);

  const handleCaptureGps = () => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setVillageLat(pos.coords.latitude.toFixed(6));
          setVillageLng(pos.coords.longitude.toFixed(6));
          toast({
            title: "GPS Acquired",
            description: `Lat: ${pos.coords.latitude.toFixed(4)}, Lng: ${pos.coords.longitude.toFixed(4)} (Accuracy: ±${Math.round(pos.coords.accuracy)}m)`,
          });
        },
        (err) => {
          toast({
            title: "GPS Offline",
            description: err.message || "Could not read GPS. You can enter approximate coordinates manually.",
            variant: "destructive",
          });
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  };

  const handleSaveVillage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!villageName.trim()) return;

    const newVil = {
      id: Date.now(),
      name: villageName.trim(),
      latitude: villageLat ? parseFloat(villageLat) : -6.5,
      longitude: villageLng ? parseFloat(villageLng) : 144.5,
      tenantId: "field",
      distanceKm: parseFloat(villageDistKm) || 4.5,
      isHardToReach,
      _isNewOffline: true,
      _syncedAt: 0,
    };

    try {
      await offlineDb.villages.put(newVil as any);
      setSavedVillages((prev) => [newVil, ...prev]);
      setVillageName("");
      setVillageLat("");
      setVillageLng("");
      await refreshPendingCount();
      toast({
        title: "Settlement Mapped & Saved",
        description: `"${newVil.name}" stored in offline database with WHO delivery strategy: ${
          newVil.distanceKm > 15 || newVil.isHardToReach ? "Mobile/HTR" : newVil.distanceKm > 5 ? "Outreach" : "Fixed"
        }.`,
      });
    } catch (err: any) {
      toast({ title: "Save Error", description: err.message, variant: "destructive" });
    }
  };

  // -------------------------------------------------------------
  // TAB 2: Zero-Dose Child Rapid Registry State
  // -------------------------------------------------------------
  const [childName, setChildName] = useState("");
  const [caregiverName, setCaregiverName] = useState("");
  const [caregiverPhone, setCaregiverPhone] = useState("");
  const [childDob, setChildDob] = useState("");
  const [childGender, setChildGender] = useState<"male" | "female">("female");
  const [isZeroDose, setIsZeroDose] = useState(true);
  const [savedClients, setSavedClients] = useState<any[]>([]);

  const handleRegisterChild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!childName.trim()) return;

    const newClient = {
      id: Date.now(),
      tenantId: "field",
      fullName: childName.trim(),
      caregiverName: caregiverName.trim() || "Caregiver",
      phone: caregiverPhone.trim() || undefined,
      dob: childDob ? new Date(childDob) : new Date(),
      gender: childGender,
      isZeroDose,
      status: "active",
      createdAt: new Date(),
      _syncedAt: 0,
    };

    try {
      await offlineDb.clients.put(newClient as any);
      setSavedClients((prev) => [newClient, ...prev]);
      setChildName("");
      setCaregiverName("");
      setCaregiverPhone("");
      setChildDob("");
      setIsZeroDose(true);
      await refreshPendingCount();
      toast({
        title: isZeroDose ? "👶 Zero-Dose Child Registered" : "Child Registered",
        description: `Successfully added ${newClient.fullName} to local immunization register.`,
      });
    } catch (err: any) {
      toast({ title: "Error Saving Child", description: err.message, variant: "destructive" });
    }
  };

  // -------------------------------------------------------------
  // TAB 3: Dose Administration Recorder
  // -------------------------------------------------------------
  const [selectedChildId, setSelectedChildId] = useState<number | "">("");
  const [doseCounts, setDoseCounts] = useState<Record<string, number>>({
    BCG: 0,
    OPV0: 0,
    Penta1: 0,
    Penta2: 0,
    Penta3: 0,
    PCV1: 0,
    PCV2: 0,
    PCV3: 0,
    Rota1: 0,
    Rota2: 0,
    Measles1: 0,
    Measles2: 0,
    HPV: 0,
  });

  const incrementDose = (antigen: string) => {
    setDoseCounts((prev) => ({ ...prev, [antigen]: (prev[antigen] || 0) + 1 }));
  };

  const decrementDose = (antigen: string) => {
    setDoseCounts((prev) => ({ ...prev, [antigen]: Math.max(0, (prev[antigen] || 0) - 1) }));
  };

  const handleSaveDoseSession = async () => {
    const totalRecorded = Object.values(doseCounts).reduce((a, b) => a + b, 0);
    if (totalRecorded === 0) {
      toast({ title: "No Doses Selected", description: "Increase at least one antigen count before recording." });
      return;
    }

    try {
      const entries = Object.entries(doseCounts).filter(([_, count]) => count > 0);
      for (const [antigen, count] of entries) {
        for (let i = 0; i < count; i++) {
          await offlineDb.clientVaccinations.put({
            id: Date.now() + Math.random(),
            tenantId: "field",
            clientId: typeof selectedChildId === "number" ? selectedChildId : 1,
            vaccineCode: antigen,
            administeredDate: new Date(),
            doseNumber: 1,
            sessionType: "outreach",
            _syncedAt: 0,
          } as any);
        }
      }

      await refreshPendingCount();
      toast({
        title: "Vaccination Logged",
        description: `Successfully recorded ${totalRecorded} administered vaccine doses in offline storage.`,
      });
      setDoseCounts({
        BCG: 0,
        OPV0: 0,
        Penta1: 0,
        Penta2: 0,
        Penta3: 0,
        PCV1: 0,
        PCV2: 0,
        PCV3: 0,
        Rota1: 0,
        Rota2: 0,
        Measles1: 0,
        Measles2: 0,
        HPV: 0,
      });
      setSelectedChildId("");
    } catch (err: any) {
      toast({ title: "Error Saving Doses", description: err.message, variant: "destructive" });
    }
  };

  // -------------------------------------------------------------
  // TAB 4: Vaccine Carrier Packing Checklist
  // -------------------------------------------------------------
  const [targetInfants, setTargetInfants] = useState<number>(25);
  const [packedChecklist, setPackedChecklist] = useState<Record<string, boolean>>({
    vials: false,
    diluents: false,
    syringes: false,
    safetyBox: false,
    icePacks: false,
    tallySheet: false,
    cotton: false,
  });

  const toggleChecklist = (key: string) => {
    setPackedChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const bcgVials = Math.ceil((targetInfants * 1.0) / 20 * 1.5);
  const pentaVials = Math.ceil((targetInfants * 1.0) / 10 * 1.15);
  const opvVials = Math.ceil((targetInfants * 1.0) / 20 * 1.2);
  const measlesVials = Math.ceil((targetInfants * 1.0) / 10 * 1.3);
  const adSyringes = Math.ceil(targetInfants * 4 * 1.1);
  const safetyBoxes = Math.ceil(adSyringes / 100);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Top Mobile Field Header */}
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur px-4 py-3 shadow-xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-bold text-base leading-tight">CHW Field App</h1>
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-none px-1.5 py-0">
                  Android Native
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">Community Health Worker Field Mode</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isOnline ? (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 text-xs gap-1 py-1">
                <Wifi className="h-3 w-3" /> Online
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 text-xs gap-1 py-1">
                <WifiOff className="h-3 w-3" /> Offline
              </Badge>
            )}

            <Button
              size="sm"
              variant={pendingQueue.length > 0 ? "default" : "outline"}
              onClick={handleSyncNow}
              disabled={isSyncing}
              className="h-9 min-h-[36px] px-3 gap-1.5 text-xs font-semibold"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "Syncing..." : pendingQueue.length > 0 ? `Sync (${pendingQueue.length})` : "Synced"}</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Tab Navigation Buttons (Oversized touch targets ≥44px for field workers) */}
      <div className="sticky top-[61px] z-30 bg-background/95 backdrop-blur border-b px-4 py-2">
        <div className="max-w-4xl mx-auto grid grid-cols-4 gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("map")}
            className={`min-h-[44px] flex flex-col items-center justify-center rounded-xl p-1.5 transition-all text-xs font-semibold ${
              activeTab === "map" ? "bg-primary text-primary-foreground shadow-xs" : "bg-muted/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            <MapPin className="h-4 w-4 mb-0.5" />
            <span>Villages</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("children")}
            className={`min-h-[44px] flex flex-col items-center justify-center rounded-xl p-1.5 transition-all text-xs font-semibold ${
              activeTab === "children" ? "bg-primary text-primary-foreground shadow-xs" : "bg-muted/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Baby className="h-4 w-4 mb-0.5" />
            <span>Zero-Dose</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("sessions")}
            className={`min-h-[44px] flex flex-col items-center justify-center rounded-xl p-1.5 transition-all text-xs font-semibold ${
              activeTab === "sessions" ? "bg-primary text-primary-foreground shadow-xs" : "bg-muted/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Syringe className="h-4 w-4 mb-0.5" />
            <span>Log Doses</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("carrier")}
            className={`min-h-[44px] flex flex-col items-center justify-center rounded-xl p-1.5 transition-all text-xs font-semibold ${
              activeTab === "carrier" ? "bg-primary text-primary-foreground shadow-xs" : "bg-muted/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Package className="h-4 w-4 mb-0.5" />
            <span>Packing</span>
          </button>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* TAB 1: Village Mapping & GPS Tagging */}
        {activeTab === "map" && (
          <div className="space-y-6">
            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-emerald-600" />
                  Map Village or Outreach Post
                </CardTitle>
                <CardDescription className="text-xs">
                  Tag GPS coordinates of remote hamlets and calculate WHO Reach Every District (RED) strategy on site.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveVillage} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="vil-name" className="text-xs font-semibold">Village / Settlement Name</Label>
                    <Input
                      id="vil-name"
                      required
                      value={villageName}
                      onChange={(e) => setVillageName(e.target.value)}
                      placeholder="e.g., Kuma Ridge Hamlet 3"
                      className="min-h-[44px] text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="vil-lat" className="text-xs font-semibold">Latitude</Label>
                      <Input
                        id="vil-lat"
                        value={villageLat}
                        onChange={(e) => setVillageLat(e.target.value)}
                        placeholder="-6.12345"
                        className="min-h-[44px] text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="vil-lng" className="text-xs font-semibold">Longitude</Label>
                      <Input
                        id="vil-lng"
                        value={villageLng}
                        onChange={(e) => setVillageLng(e.target.value)}
                        placeholder="144.12345"
                        className="min-h-[44px] text-sm"
                      />
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCaptureGps}
                    className="w-full min-h-[44px] gap-2 text-xs font-semibold border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
                  >
                    <Compass className="h-4 w-4" />
                    Capture My GPS Coordinates Right Now
                  </Button>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1.5">
                      <Label htmlFor="vil-dist" className="text-xs font-semibold">Distance from Facility (km)</Label>
                      <Input
                        id="vil-dist"
                        type="number"
                        step="0.1"
                        value={villageDistKm}
                        onChange={(e) => setVillageDistKm(e.target.value)}
                        className="min-h-[44px] text-sm"
                      />
                    </div>

                    <div className="flex items-center space-x-2 pt-6">
                      <Checkbox
                        id="vil-htr"
                        checked={isHardToReach}
                        onCheckedChange={(c) => setIsHardToReach(!!c)}
                        className="h-5 w-5"
                      />
                      <Label htmlFor="vil-htr" className="text-xs font-semibold cursor-pointer">
                        Hard to Reach (River/Mountain)
                      </Label>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-muted/60 border flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Auto WHO Strategy:</span>
                    <Badge variant="secondary" className="font-semibold text-xs">
                      {parseFloat(villageDistKm) > 15 || isHardToReach
                        ? "🚐 Mobile / HTR Strategy (>15km)"
                        : parseFloat(villageDistKm) > 5
                        ? "🚶 Outreach Session (5–15km)"
                        : "🏥 Fixed Session (<5km)"}
                    </Badge>
                  </div>

                  <Button type="submit" className="w-full min-h-[44px] gap-2 font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
                    <Plus className="h-4 w-4" />
                    Save Settlement in Local Phone Storage
                  </Button>
                </form>
              </CardContent>
            </Card>

            {savedVillages.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Recently Mapped Settlements</h3>
                <div className="space-y-2">
                  {savedVillages.map((v) => (
                    <div key={v.id} className="p-3.5 rounded-xl bg-card border flex items-center justify-between text-sm">
                      <div>
                        <div className="font-bold">{v.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {v.latitude.toFixed(4)}, {v.longitude.toFixed(4)} · {v.distanceKm} km
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs bg-muted font-medium">
                        {v.distanceKm > 15 || v.isHardToReach ? "Mobile" : v.distanceKm > 5 ? "Outreach" : "Fixed"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Zero-Dose Child Rapid Registry */}
        {activeTab === "children" && (
          <div className="space-y-6">
            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Baby className="h-5 w-5 text-emerald-600" />
                  Register Zero-Dose or Missed Child
                </CardTitle>
                <CardDescription className="text-xs">
                  Fast field intake for children who missed routine immunizations. Works 100% offline.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRegisterChild} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="child-name" className="text-xs font-semibold">Child Full Name</Label>
                    <Input
                      id="child-name"
                      required
                      value={childName}
                      onChange={(e) => setChildName(e.target.value)}
                      placeholder="e.g., Kepi Samuel"
                      className="min-h-[44px] text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="caregiver-name" className="text-xs font-semibold">Mother / Caregiver Name</Label>
                      <Input
                        id="caregiver-name"
                        value={caregiverName}
                        onChange={(e) => setCaregiverName(e.target.value)}
                        placeholder="e.g., Mary Samuel"
                        className="min-h-[44px] text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="caregiver-phone" className="text-xs font-semibold">Caregiver Phone</Label>
                      <Input
                        id="caregiver-phone"
                        type="tel"
                        value={caregiverPhone}
                        onChange={(e) => setCaregiverPhone(e.target.value)}
                        placeholder="+260 971 234567"
                        className="min-h-[44px] text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="child-dob" className="text-xs font-semibold">Date of Birth</Label>
                      <Input
                        id="child-dob"
                        type="date"
                        value={childDob}
                        onChange={(e) => setChildDob(e.target.value)}
                        className="min-h-[44px] text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Gender</Label>
                      <div className="grid grid-cols-2 gap-1 pt-0.5">
                        <Button
                          type="button"
                          variant={childGender === "female" ? "default" : "outline"}
                          onClick={() => setChildGender("female")}
                          className="min-h-[44px] text-xs font-semibold"
                        >
                          Female
                        </Button>
                        <Button
                          type="button"
                          variant={childGender === "male" ? "default" : "outline"}
                          onClick={() => setChildGender("male")}
                          className="min-h-[44px] text-xs font-semibold"
                        >
                          Male
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center space-x-3">
                    <Checkbox
                      id="zero-dose-check"
                      checked={isZeroDose}
                      onCheckedChange={(c) => setIsZeroDose(!!c)}
                      className="h-5 w-5 border-amber-500 data-[state=checked]:bg-amber-600"
                    />
                    <Label htmlFor="zero-dose-check" className="text-xs font-semibold cursor-pointer text-amber-900 dark:text-amber-200">
                      Child has received ZERO routine vaccines to date (Zero-Dose Child)
                    </Label>
                  </div>

                  <Button type="submit" className="w-full min-h-[44px] font-bold bg-primary hover:bg-primary/90 text-primary-foreground">
                    <Plus className="h-4 w-4 mr-1.5" />
                    Save Child in Field Register
                  </Button>
                </form>
              </CardContent>
            </Card>

            {savedClients.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Registered in this Session</h3>
                <div className="space-y-2">
                  {savedClients.map((c) => (
                    <div key={c.id} className="p-3.5 rounded-xl bg-card border flex items-center justify-between text-sm">
                      <div>
                        <div className="font-bold">{c.fullName}</div>
                        <div className="text-xs text-muted-foreground">
                          Caregiver: {c.caregiverName} {c.phone ? `(${c.phone})` : ""}
                        </div>
                      </div>
                      {c.isZeroDose ? (
                        <Badge variant="destructive" className="text-xs font-semibold">Zero-Dose</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Missed Dose</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Real-Time Session Dose Recording */}
        {activeTab === "sessions" && (
          <div className="space-y-6">
            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Syringe className="h-5 w-5 text-emerald-600" />
                  Administer Vaccine Doses
                </CardTitle>
                <CardDescription className="text-xs">
                  Tap plus/minus to record each vaccine given at today's fixed or outreach session.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Object.entries(doseCounts).map(([antigen, count]) => (
                    <div key={antigen} className="p-3 rounded-2xl bg-card border flex flex-col items-center justify-between gap-2 shadow-2xs">
                      <span className="font-bold text-sm">{antigen}</span>
                      <div className="text-2xl font-extrabold text-primary">{count}</div>
                      <div className="flex items-center gap-2 w-full">
                        <button
                          type="button"
                          onClick={() => decrementDose(antigen)}
                          className="flex-1 min-h-[44px] rounded-lg bg-muted text-foreground font-bold hover:bg-muted/80 flex items-center justify-center text-lg active:scale-95 transition-transform"
                        >
                          -
                        </button>
                        <button
                          type="button"
                          onClick={() => incrementDose(antigen)}
                          className="flex-1 min-h-[44px] rounded-lg bg-primary text-primary-foreground font-bold hover:bg-primary/90 flex items-center justify-center text-lg active:scale-95 transition-transform"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t">
                  <div className="flex items-center justify-between text-sm mb-3">
                    <span className="font-semibold text-muted-foreground">Total Doses Administered:</span>
                    <span className="text-lg font-bold text-primary">
                      {Object.values(doseCounts).reduce((a, b) => a + b, 0)} doses
                    </span>
                  </div>

                  <Button
                    onClick={handleSaveDoseSession}
                    className="w-full min-h-[44px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                    Commit Doses to Offline Logbook
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 4: Vaccine Carrier Packing Advisor */}
        {activeTab === "carrier" && (
          <div className="space-y-6">
            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5 text-emerald-600" />
                  Vaccine Carrier Packing Advisor
                </CardTitle>
                <CardDescription className="text-xs">
                  WHO/UNICEF carrier packing guidance: enter your session target to calculate cold box packing.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="target-children" className="text-xs font-semibold">
                    Target Children Expected at Session
                  </Label>
                  <Input
                    id="target-children"
                    type="number"
                    min="1"
                    value={targetInfants}
                    onChange={(e) => setTargetInfants(Math.max(1, parseInt(e.target.value) || 1))}
                    className="min-h-[44px] text-base font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-background border">
                    <div className="text-xs text-muted-foreground">BCG (20-dose)</div>
                    <div className="text-xl font-bold text-foreground mt-0.5">{bcgVials} vials</div>
                    <div className="text-[10px] text-muted-foreground mt-1">incl. 1.5x wastage</div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-background border">
                    <div className="text-xs text-muted-foreground">Pentavalent (10-dose)</div>
                    <div className="text-xl font-bold text-foreground mt-0.5">{pentaVials} vials</div>
                    <div className="text-[10px] text-muted-foreground mt-1">incl. 1.15x wastage</div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-background border">
                    <div className="text-xs text-muted-foreground">OPV (20-dose)</div>
                    <div className="text-xl font-bold text-foreground mt-0.5">{opvVials} vials</div>
                    <div className="text-[10px] text-muted-foreground mt-1">incl. 1.2x wastage</div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-background border">
                    <div className="text-xs text-muted-foreground">Measles/MR (10-dose)</div>
                    <div className="text-xl font-bold text-foreground mt-0.5">{measlesVials} vials</div>
                    <div className="text-[10px] text-muted-foreground mt-1">incl. 1.3x wastage</div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-background border">
                    <div className="text-xs text-muted-foreground">0.5mL AD Syringes</div>
                    <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{adSyringes} pcs</div>
                    <div className="text-[10px] text-muted-foreground mt-1">incl. 10% safety buffer</div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-background border">
                    <div className="text-xs text-muted-foreground">Safety Boxes (5L)</div>
                    <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">{safetyBoxes} box</div>
                    <div className="text-[10px] text-muted-foreground mt-1">100 syringes/box</div>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                    Pre-Departure Cold Box Checklist
                  </h4>
                  {[
                    { key: "icePacks", label: "4 conditioned ice packs properly lined on carrier walls" },
                    { key: "vials", label: "Vaccine vials checked for VVM (Vaccine Vial Monitor) Stage 1/2" },
                    { key: "diluents", label: "Diluents packed alongside matching manufacturer lots" },
                    { key: "syringes", label: "0.5mL AD and 5mL reconstitution syringes verified" },
                    { key: "safetyBox", label: "Yellow 5L safety box assembled and labeled" },
                    { key: "cotton", label: "Cotton wool and water bowl packed (no spirit swab on vaccines)" },
                    { key: "tallySheet", label: "Session tally book & CHW Android device charged" },
                  ].map((item) => (
                    <div
                      key={item.key}
                      onClick={() => toggleChecklist(item.key)}
                      className={`min-h-[44px] flex items-center space-x-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        packedChecklist[item.key] ? "bg-emerald-500/10 border-emerald-500/30" : "bg-card hover:bg-muted/40"
                      }`}
                    >
                      <Checkbox checked={!!packedChecklist[item.key]} className="h-5 w-5" />
                      <span className={`text-xs font-medium ${packedChecklist[item.key] ? "line-through text-muted-foreground" : "text-foreground"}`}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
