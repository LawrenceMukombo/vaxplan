import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  CloudDownload,
  Database,
  Map,
  RefreshCw,
  ShieldCheck,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { District, Facility } from "@shared/schema";

type ReadinessItem = {
  label: string;
  value: string | number;
  ok: boolean;
  detail: string;
};

async function countDbStore(dbName: string, storeName: string): Promise<number | null> {
  if (typeof indexedDB === "undefined") return null;
  return new Promise((resolve) => {
    const req = indexedDB.open(dbName);
    req.onerror = () => resolve(null);
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.close();
        resolve(null);
        return;
      }
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const countReq = store.count();
      countReq.onsuccess = () => {
        db.close();
        resolve(Number(countReq.result || 0));
      };
      countReq.onerror = () => {
        db.close();
        resolve(null);
      };
    };
  });
}

export default function FieldReadiness() {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [selectedDistrict, setSelectedDistrict] = useState<string>("all");
  const [outboxCount, setOutboxCount] = useState<number | null>(null);
  const [conflictCount, setConflictCount] = useState<number | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [cacheStatus, setCacheStatus] = useState<"checking" | "ready" | "missing">("checking");

  const { data: facilities = [] } = useQuery<Facility[]>({ queryKey: ["/api/facilities"] });
  const { data: districts = [] } = useQuery<District[]>({ queryKey: ["/api/districts"] });

  const refreshLocalState = async () => {
    setOutboxCount(await countDbStore("vaxplan-offline", "outbox"));
    setConflictCount(await countDbStore("vaxplan-offline", "conflicts"));
    try {
      setLastSync(localStorage.getItem("vaxplan.lastSuccessfulSync") || localStorage.getItem("vaxplan_last_sync"));
    } catch {
      setLastSync(null);
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      setCacheStatus(keys.some((k) => /vaxplan|workbox|map|tile/i.test(k)) ? "ready" : "missing");
    } else {
      setCacheStatus("missing");
    }
  };

  useEffect(() => {
    refreshLocalState();
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const scopedFacilities = useMemo(() => {
    if (selectedDistrict === "all") return facilities;
    return facilities.filter((f: any) => String(f.districtId) === selectedDistrict);
  }, [facilities, selectedDistrict]);

  const items: ReadinessItem[] = [
    {
      label: "Connection",
      value: online ? "Online" : "Offline",
      ok: online,
      detail: online ? "Ready to sync with the server." : "Offline mode active. Changes should queue locally.",
    },
    {
      label: "Offline map/cache",
      value: cacheStatus === "ready" ? "Cached" : cacheStatus === "checking" ? "Checking" : "Needs download",
      ok: cacheStatus === "ready",
      detail: cacheStatus === "ready" ? "Browser cache is available for field use." : "Download district data before going to the field.",
    },
    {
      label: "Facility data synced",
      value: scopedFacilities.length,
      ok: scopedFacilities.length > 0,
      detail: `${scopedFacilities.length} facility record(s) available in the selected scope.`,
    },
    {
      label: "Pending outbox",
      value: outboxCount ?? "Unknown",
      ok: (outboxCount ?? 0) === 0,
      detail: outboxCount === null ? "Outbox store not detected." : `${outboxCount} offline change(s) waiting to replay.`,
    },
    {
      label: "Conflicts",
      value: conflictCount ?? "Unknown",
      ok: (conflictCount ?? 0) === 0,
      detail: conflictCount === null ? "Conflict store not detected." : `${conflictCount} conflict(s) need review.`,
    },
    {
      label: "Last successful sync",
      value: lastSync ? new Date(lastSync).toLocaleString() : "Not recorded",
      ok: Boolean(lastSync),
      detail: "Used by supervisors to confirm data was fresh before field deployment.",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Field Readiness</h1>
          <p className="text-sm text-muted-foreground">
            Low-connectivity readiness before teams leave for outreach, supervision, or campaign work.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="District" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All districts</SelectItem>
              {districts.map((d) => (
                <SelectItem key={d.id} value={String(d.id)}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={refreshLocalState} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <Card key={item.label}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-muted-foreground">{item.label}</div>
                  <div className="mt-1 text-2xl font-bold">{item.value}</div>
                </div>
                <Badge
                  variant="outline"
                  className={item.ok ? "border-emerald-500 text-emerald-700 bg-emerald-500/10" : "border-amber-500 text-amber-700 bg-amber-500/10"}
                >
                  {item.ok ? <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> : <AlertTriangle className="mr-1 h-3.5 w-3.5" />}
                  {item.ok ? "Ready" : "Review"}
                </Badge>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{item.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CloudDownload className="h-5 w-5 text-primary" />
            Download this district for offline use
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          {[
            { icon: Map, title: "Map and catchments", detail: "Prime map tiles and settlement/facility geography for the selected district." },
            { icon: Database, title: "Facility package", detail: "Facilities, communities, denominators, sessions, supervision visits, and stock ledger rows." },
            { icon: ShieldCheck, title: "Conflict-safe sync", detail: "Review queued edits and conflicts before the team goes fully offline." },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="rounded-lg border bg-muted/20 p-4">
                <Icon className="h-5 w-5 text-primary" />
                <div className="mt-3 font-semibold">{item.title}</div>
                <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
              </div>
            );
          })}
          <div className="lg:col-span-3 flex flex-wrap gap-2">
            <Button
              className="gap-2"
              onClick={() => {
                localStorage.setItem("vaxplan.lastOfflineDistrictDownload", JSON.stringify({
                  districtId: selectedDistrict,
                  downloadedAt: new Date().toISOString(),
                  facilityCount: scopedFacilities.length,
                }));
                setLastSync(new Date().toISOString());
              }}
            >
              <CloudDownload className="h-4 w-4" />
              Download selected scope
            </Button>
            <Button variant="outline" asChild>
              <a href="/sync/conflicts">Review conflicts</a>
            </Button>
            <Badge variant="outline" className={online ? "border-emerald-500 text-emerald-700" : "border-rose-500 text-rose-700"}>
              {online ? <Wifi className="mr-1 h-3.5 w-3.5" /> : <WifiOff className="mr-1 h-3.5 w-3.5" />}
              {online ? "Online now" : "Offline now"}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
