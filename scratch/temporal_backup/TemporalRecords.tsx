import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, GitCompare, History, Search, ShieldCheck, TimerReset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type TemporalVersion = {
  id: string;
  stableEntityId: string;
  entityType: string;
  versionNumber: number;
  validFrom: string;
  validTo?: string | null;
  recordedAt: string;
  recordedUntil?: string | null;
  status: string;
  isCurrent: boolean;
  isFuture: boolean;
  isCorrection: boolean;
  changeType: string;
  changeReason?: string | null;
  changeSummary?: string | null;
  sourceReference?: string | null;
  sourceSystem?: string | null;
  snapshot?: Record<string, unknown>;
  affectedRecords?: unknown[];
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function formatDate(value?: string | null) {
  if (!value) return "Open ended";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function VersionCard({ version }: { version: TemporalVersion }) {
  const fields = Object.keys(version.snapshot || {}).slice(0, 8);
  return (
    <Card className="border-slate-200">
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Version {version.versionNumber}</CardTitle>
          <div className="flex flex-wrap gap-2">
            {version.isCurrent && <Badge className="bg-emerald-600">Current</Badge>}
            {version.isFuture && <Badge variant="secondary">Future</Badge>}
            {version.isCorrection && <Badge variant="destructive">Correction</Badge>}
            <Badge variant="outline">{version.status}</Badge>
          </div>
        </div>
        <CardDescription>{version.changeSummary || "No summary recorded."}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 text-sm">
          <div><span className="font-medium">Effective from:</span> {formatDate(version.validFrom)}</div>
          <div><span className="font-medium">Effective to:</span> {formatDate(version.validTo)}</div>
          <div><span className="font-medium">Recorded on:</span> {formatDate(version.recordedAt)}</div>
          <div><span className="font-medium">Recorded until:</span> {formatDate(version.recordedUntil)}</div>
          <div><span className="font-medium">Change type:</span> {version.changeType}</div>
          <div><span className="font-medium">Reason:</span> {version.changeReason || "Not recorded"}</div>
          <div><span className="font-medium">Source:</span> {[version.sourceSystem, version.sourceReference].filter(Boolean).join(" / ") || "Not recorded"}</div>
        </div>
        <div className="rounded-md border bg-slate-50 p-3 text-sm">
          <div className="mb-2 font-medium text-slate-700">Snapshot preview</div>
          {fields.length === 0 ? (
            <p className="text-muted-foreground">No snapshot fields recorded.</p>
          ) : (
            <dl className="space-y-1">
              {fields.map((field) => (
                <div className="grid grid-cols-[9rem_1fr] gap-2" key={field}>
                  <dt className="truncate text-slate-500">{field}</dt>
                  <dd className="truncate">{String((version.snapshot || {})[field] ?? "")}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function TemporalRecords() {
  const [entityType, setEntityType] = useState("facility");
  const [entityId, setEntityId] = useState("");
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10));
  const [query, setQuery] = useState<{ entityType: string; entityId: string; asOf: string } | null>(null);

  const base = useMemo(() => {
    if (!query) return null;
    return `/api/temporal/${encodeURIComponent(query.entityType)}/${encodeURIComponent(query.entityId)}`;
  }, [query]);

  const current = useQuery<TemporalVersion>({
    queryKey: ["temporal-current", base],
    queryFn: () => fetchJson(`${base}/current`),
    enabled: !!base,
    retry: false,
  });
  const history = useQuery<TemporalVersion[]>({
    queryKey: ["temporal-history", base],
    queryFn: () => fetchJson(`${base}/history`),
    enabled: !!base,
    retry: false,
  });
  const future = useQuery<TemporalVersion[]>({
    queryKey: ["temporal-future", base],
    queryFn: () => fetchJson(`${base}/future`),
    enabled: !!base,
    retry: false,
  });
  const asOfQuery = useQuery<{ selectedDate: string; version: TemporalVersion }>({
    queryKey: ["temporal-as-of", base, query?.asOf],
    queryFn: () => fetchJson(`${base}/as-of?validDate=${encodeURIComponent(`${query!.asOf}T00:00:00.000Z`)}`),
    enabled: !!base && !!query?.asOf,
    retry: false,
  });

  const versions = history.data || [];
  const comparison = useMemo(() => {
    if (versions.length < 2) return null;
    const latest = versions[0];
    const previous = versions[1];
    const fields = new Set([...Object.keys(previous.snapshot || {}), ...Object.keys(latest.snapshot || {})]);
    const changed = Array.from(fields).filter((field) => JSON.stringify(previous.snapshot?.[field]) !== JSON.stringify(latest.snapshot?.[field]));
    return { latest, previous, changed };
  }, [versions]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Temporal History Workbench</h1>
          <p className="text-muted-foreground">
            Review current, historical, future-dated, corrected, and superseded versions using valid-time and system-time evidence.
          </p>
        </div>
        <Badge variant="outline" className="gap-2 px-3 py-2">
          <ShieldCheck className="h-4 w-4" />
          Tenant-isolated
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Search className="h-5 w-5" /> View as of date</CardTitle>
          <CardDescription>Use stable entity IDs, not names or codes, because names and external codes can change over time.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[1fr_1fr_220px_auto]">
          <div className="space-y-2">
            <Label>Entity type</Label>
            <Input value={entityType} onChange={(e) => setEntityType(e.target.value)} placeholder="facility, population, district, user_role" />
          </div>
          <div className="space-y-2">
            <Label>Stable entity ID</Label>
            <Input value={entityId} onChange={(e) => setEntityId(e.target.value)} placeholder="Stable internal ID" />
          </div>
          <div className="space-y-2">
            <Label>As-of date</Label>
            <Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button disabled={!entityType || !entityId} onClick={() => setQuery({ entityType, entityId, asOf })}>Load history</Button>
          </div>
        </CardContent>
      </Card>

      {!query ? (
        <Card>
          <CardContent className="flex min-h-48 items-center justify-center text-center text-muted-foreground">
            Enter an entity type and stable ID to review temporal history.
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="current" className="space-y-4">
          <TabsList>
            <TabsTrigger value="current"><Clock className="mr-2 h-4 w-4" />Current</TabsTrigger>
            <TabsTrigger value="asof"><TimerReset className="mr-2 h-4 w-4" />As of</TabsTrigger>
            <TabsTrigger value="history"><History className="mr-2 h-4 w-4" />History</TabsTrigger>
            <TabsTrigger value="future">Future</TabsTrigger>
            <TabsTrigger value="compare"><GitCompare className="mr-2 h-4 w-4" />Compare</TabsTrigger>
          </TabsList>

          <TabsContent value="current">
            {current.data ? <VersionCard version={current.data} /> : <Card><CardContent className="p-6 text-muted-foreground">{current.isLoading ? "Loading current version..." : "No current version found."}</CardContent></Card>}
          </TabsContent>
          <TabsContent value="asof">
            {asOfQuery.data?.version ? <VersionCard version={asOfQuery.data.version} /> : <Card><CardContent className="p-6 text-muted-foreground">{asOfQuery.isLoading ? "Loading as-of version..." : "No version was valid on the selected date."}</CardContent></Card>}
          </TabsContent>
          <TabsContent value="history" className="space-y-4">
            {versions.length ? versions.map((version) => <VersionCard key={version.id} version={version} />) : <Card><CardContent className="p-6 text-muted-foreground">No history found.</CardContent></Card>}
          </TabsContent>
          <TabsContent value="future" className="space-y-4">
            {(future.data || []).length ? future.data!.map((version) => <VersionCard key={version.id} version={version} />) : <Card><CardContent className="p-6 text-muted-foreground">No future-dated changes found.</CardContent></Card>}
          </TabsContent>
          <TabsContent value="compare">
            <Card>
              <CardHeader>
                <CardTitle>Latest Version Comparison</CardTitle>
                <CardDescription>Compares the latest two versions and highlights changed snapshot fields.</CardDescription>
              </CardHeader>
              <CardContent>
                {!comparison ? (
                  <p className="text-muted-foreground">At least two versions are required for comparison.</p>
                ) : (
                  <div className="space-y-3">
                    {comparison.changed.length === 0 ? <p>No changed fields detected.</p> : comparison.changed.map((field) => (
                      <div className="grid gap-2 rounded-md border p-3 md:grid-cols-[14rem_1fr_1fr]" key={field}>
                        <div className="font-medium">{field}</div>
                        <div><span className="text-muted-foreground">Previous:</span> {String(comparison.previous.snapshot?.[field] ?? "")}</div>
                        <div><span className="text-muted-foreground">Latest:</span> {String(comparison.latest.snapshot?.[field] ?? "")}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
