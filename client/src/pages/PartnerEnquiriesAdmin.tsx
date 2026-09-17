import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Mail, MapPin, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type Enquiry = {
  id: string; name: string; organisation: string; role?: string; country: string;
  email: string; interest: string; message: string; stage: string; createdAt: string;
  utmSource?: string; utmMedium?: string; utmCampaign?: string;
};
type Analytics = { totals: Record<string, number>; sampledEvents: number };
const stages = ["new", "qualified", "demo_scheduled", "concept_shared", "pilot_discussion", "closed"];

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || "Request failed");
  return response.json();
}

export default function PartnerEnquiriesAdmin() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const enquiries = useQuery({ queryKey: ["partner-enquiries"], queryFn: () => jsonFetch<Enquiry[]>("/api/admin/partner-enquiries") });
  const analytics = useQuery({ queryKey: ["partner-analytics"], queryFn: () => jsonFetch<Analytics>("/api/admin/partner-analytics") });
  const updateStage = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) => jsonFetch(`/api/admin/partner-enquiries/${id}/stage`, { method: "PATCH", body: JSON.stringify({ stage }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["partner-enquiries"] }),
    onError: (error: Error) => toast({ title: "Could not update enquiry", description: error.message, variant: "destructive" }),
  });
  const totals = analytics.data?.totals || {};
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <Badge variant="secondary">Institutional outreach</Badge>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Partnership enquiries</h1>
        <p className="text-muted-foreground">A secure national-admin view of institutional leads and outreach engagement.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Enquiries", enquiries.data?.length || 0],
          ["Partner page views", totals.partners_page_view || 0],
          ["Demo starts", totals.demo_start || 0],
          ["Brief downloads", totals.pdf_download || 0],
        ].map(([label, value]) => <Card key={String(label)}><CardContent className="pt-6"><div className="text-2xl font-bold">{value}</div><p className="text-sm text-muted-foreground">{label}</p></CardContent></Card>)}
      </div>
      <div className="space-y-4">
        {enquiries.isLoading && <Card><CardContent className="p-8 text-muted-foreground">Loading enquiries…</CardContent></Card>}
        {enquiries.data?.length === 0 && <Card><CardContent className="p-8 text-muted-foreground">No partnership enquiries yet.</CardContent></Card>}
        {enquiries.data?.map((item) => (
          <Card key={item.id}>
            <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div><CardTitle>{item.organisation}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{item.name}{item.role ? ` · ${item.role}` : ""}</p></div>
              <Select value={item.stage} onValueChange={(stage) => updateStage.mutate({ id: item.id, stage })}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>{stages.map((stage) => <SelectItem key={stage} value={stage}>{stage.replaceAll("_", " ")}</SelectItem>)}</SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Building2 className="h-4 w-4" />{item.interest}</span>
                <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{item.country}</span>
                <a className="flex items-center gap-1 text-primary hover:underline" href={`mailto:${item.email}`}><Mail className="h-4 w-4" />{item.email}</a>
                <span className="flex items-center gap-1"><Users className="h-4 w-4" />{new Date(item.createdAt).toLocaleString()}</span>
              </div>
              <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-4 text-sm">{item.message}</p>
              {(item.utmSource || item.utmMedium || item.utmCampaign) && <p className="text-xs text-muted-foreground">Campaign: {[item.utmSource, item.utmMedium, item.utmCampaign].filter(Boolean).join(" / ")}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
