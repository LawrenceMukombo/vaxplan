import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { FacilityCascadePicker } from "@/components/FacilityCascadePicker";
import { LifeCourseForecast } from "@/components/LifeCourseForecast";
import { PlanningDraftControls } from "@/components/PlanningDraftControls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { planningRequest } from "@/lib/planningEvidenceClient";
import { extensionKinds, extensionForms, extensionSchemas, summarizeFinance, type ExtensionKind, type ExtensionRecord } from "@shared/planningExtensions";

export default function PlanningEvidence() {
  const cache = useQueryClient();
  const initial = new URLSearchParams(location.search);
  const [facility, setFacility] = useState(initial.get("facilityId") || "");
  const [kind, setKind] = useState<ExtensionKind>(initial.get("kind") !== "red_microplanning" && extensionKinds.includes(initial.get("kind") as ExtensionKind) ? initial.get("kind") as ExtensionKind : "consultation");
  const [microplan, setMicroplan] = useState(initial.get("microplanId") || "");
  const [editing, setEditing] = useState<ExtensionRecord | null>(null);
  const [draft, setDraft] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [history, setHistory] = useState<any[] | null>(null);
  const [programManagement, setProgramManagement] = useState(false);
  const { data: facilities = [] } = useQuery<any[]>({ queryKey: ["/api/facilities"] });
  const { data: tenant } = useQuery<any>({ queryKey: ["/api/me/tenant"] });
  const { data: communities = [] } = useQuery<any[]>({ queryKey: [`/api/villages?facilityId=${facility}`], enabled: Boolean(facility) });
  const { data: plans = [] } = useQuery<any[]>({ queryKey: ["/api/microplans"] });
  const key = `/api/planning-evidence?facilityId=${facility}&kind=${kind}`;
  const query = useQuery<{ records: ExtensionRecord[]; canWrite: boolean }>({ queryKey: [key], queryFn: () => planningRequest(key), enabled: Boolean(facility), retry: false });
  const groupKey = `/api/planning-evidence?facilityId=${facility}&kind=target_group`;
  const groups = useQuery<{ records: ExtensionRecord[] }>({ queryKey: [groupKey], queryFn: () => planningRequest(groupKey), enabled: Boolean(facility) && kind === "population_estimate", retry: false });
  const { data: budgets = [] } = useQuery<any[]>({ queryKey: ["/api/budget-items"], enabled: Boolean(facility) && kind === "finance" });
  const { data: sessions = [] } = useQuery<any[]>({ queryKey: ["/api/sessions"], enabled: Boolean(facility) && kind === "service_review" });
  const form = extensionForms[kind];
  const barrierSubcategories: string[] = tenant?.settings?.planningBarrierSubcategories || ["Service hours", "Transport costs", "Waiting time", "Language", "Unreliable sessions", "Respectful care", "Accessibility", "Vaccine confidence", "Misinformation", "Decision-making authority", "Control of money or transport", "Caregiving workload", "Safety"];
  const totals = kind === "finance" ? summarizeFinance((query.data?.records || []).map(record => record.payload as any)) : {};
  function start() {
    const values: Record<string, any> = {};
    form.fields.forEach(field => { values[field.name] = field.name === "countryScope" ? true : field.name === "definitionVersion" ? 1 : field.type === "checkbox" ? false : field.type === "number" ? 0 : field.type === "select" ? field.options?.[0] : ""; });
    setEditing(null); setDraft(values); setError("");
  }
  async function save() {
    const candidate = { ...draft, ...(kind === "finance" ? { expectedDate: draft?.expectedDate || null } : {}) };
    const valid = extensionSchemas[kind].safeParse(candidate);
    if (!valid.success) { setError(valid.error.issues.map(issue => `${form.fields.find(field => field.name === issue.path[0])?.label || issue.path.join(".")}: ${issue.message}`).join("; ")); return; }
    setSaving(true); setError("");
    try {
      await planningRequest(editing ? `/api/planning-evidence/${editing.id}` : "/api/planning-evidence", editing ? "PUT" : "POST", {
        facilityId: Number(facility), kind, microplanId: microplan ? Number(microplan) : null, payload: valid.data,
        ...(editing ? { version: editing.version } : { requestId }),
      });
      setDraft(null); setEditing(null); setRequestId(crypto.randomUUID()); await cache.invalidateQueries({ queryKey: [key] });
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save. Your entries remain open."); }
    finally { setSaving(false); }
  }
  const style = "block w-full rounded border p-2 bg-background";
  return <div className="max-w-6xl mx-auto p-6 space-y-5">
    <h1 className="text-2xl font-bold">Planning Evidence</h1>
    <p>Community input, population assumptions and follow-up evidence for your microplan.</p>
    <div className="flex gap-4"><Link href={`/planning-actions?facilityId=${facility}`}>Action register</Link><Link href="/microplans/routine">Routine microplans</Link></div>
    <div className="space-y-1.5">
      <FacilityCascadePicker
        value={facility ? Number(facility) : null}
        disabled={Boolean(draft)}
        onChange={(id) => {
          setFacility(id ? String(id) : "");
          setMicroplan("");
          setHistory(null);
        }}
      />
    </div>
    <label className="flex gap-2 items-center"><input type="checkbox" checked={programManagement} disabled={Boolean(draft)} onChange={e => { setProgramManagement(e.target.checked); if (!e.target.checked && ["finance", "household_assessment", "service_review"].includes(kind)) setKind("consultation"); }} />Show optional programme-management functions</label>
    <nav className="flex flex-wrap gap-2" aria-label="Evidence categories">{extensionKinds.filter(value => value !== "red_microplanning" && (programManagement || !["finance", "household_assessment", "service_review"].includes(value))).map(value => <Button key={value} variant={kind === value ? "default" : "outline"} disabled={Boolean(draft)} onClick={() => { setKind(value); setError(""); setHistory(null); }}>{extensionForms[value].title}</Button>)}</nav>
    <h2 className="text-xl font-semibold">{form.title}</h2><p className="text-muted-foreground">{form.description}</p>
    {kind === "target_group" && <p>Country administrators manage group definitions. All facilities in the country can use active groups.</p>}
    {facility && <PlanningDraftControls scope={`${facility}:${kind}`} value={draft ? { draft, editing, microplan, requestId } : null} onRestore={value => { setDraft(value.draft); setEditing(value.editing || null); setRequestId(value.requestId || crypto.randomUUID()); setMicroplan(value.microplan || ""); }} />}
    {query.isLoading && facility && <p>Loading…</p>}{query.error && <p role="alert" className="text-destructive">{query.error.message}</p>}{error && <p role="alert" className="text-destructive">{error}</p>}
    {Object.entries(totals).map(([currency, total]) => <div key={currency} className="border rounded p-3">{currency} · Commitments: {(total.commitment / 100).toFixed(2)} · Received: {(total.receipt / 100).toFixed(2)} · Spent: {(total.expenditure / 100).toFixed(2)} · In-kind: {(total.in_kind / 100).toFixed(2)} · Cash remaining: {(total.cashRemaining / 100).toFixed(2)}{total.cashRemaining < 0 && <p className="text-destructive">Recorded expenditure exceeds recorded receipts. Review funding records.</p>}</div>)}
    {query.data?.canWrite && !draft && <Button onClick={start}>Add record</Button>}
    {draft && <section className="border rounded-lg p-5 space-y-4">
      <label className="block">Related microplan (optional)<select className={style} value={microplan} onChange={e => setMicroplan(e.target.value)}><option value="">Facility evidence</option>{plans.filter(plan => Number(plan.facilityId) === Number(facility)).map(plan => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label>
      {form.fields.map(field => <label key={field.name} className="block">{field.label}{field.optional ? " (optional)" : ""}
        {field.name === "budgetItemId" || field.name === "sessionId" ? <select className={style} value={draft[field.name] || ""} onChange={e => setDraft({ ...draft, [field.name]: Number(e.target.value) })}><option value="">Select {field.name === "budgetItemId" ? "a budget item" : "a session"}</option>{(field.name === "budgetItemId" ? budgets : sessions).filter(item => Number(item.facilityId) === Number(facility)).map(item => <option key={item.id} value={item.id}>{item.description || item.name} ({item.year} Q{item.quarter})</option>)}</select>
          : field.name === "subcategory" ? <select className={style} value={draft[field.name] || ""} onChange={e => setDraft({ ...draft, [field.name]: e.target.value })}><option value="">Select a subcategory</option>{barrierSubcategories.map((option: string) => <option key={option} value={option}>{option}</option>)}</select>
          : field.name === "communityId" ? <select className={style} value={draft[field.name] || 0} onChange={e => setDraft({ ...draft, [field.name]: Number(e.target.value) })}><option value={0}>Facility-wide / not community scoped</option>{communities.map(community => <option key={community.id} value={community.id}>{community.name}</option>)}</select>
          : field.name === "amountMinor" ? <Input type="number" min="0" step="0.01" value={draft.amountMinor === "" ? "" : Number(draft.amountMinor) / 100} onChange={e => setDraft({ ...draft, amountMinor: e.target.value === "" ? "" : Math.round(Number(e.target.value) * 100) })} />
          : field.name === "targetGroupId" ? <select aria-label={field.label} className={style} value={draft[field.name]} onChange={e => setDraft({ ...draft, [field.name]: e.target.value })}><option value="">Select a group</option>{groups.data?.records.filter(group => group.payload.status === "active").map(group => <option key={group.id} value={group.id}>{group.payload.title}</option>)}</select>
          : field.type === "select" ? <select aria-label={field.label} className={style} value={draft[field.name]} onChange={e => setDraft({ ...draft, [field.name]: e.target.value })}>{field.options?.map(option => <option value={option} key={option}>{option.replaceAll("_", " ")}</option>)}</select>
          : field.type === "checkbox" ? <input className="ml-3" type="checkbox" checked={Boolean(draft[field.name])} onChange={e => setDraft({ ...draft, [field.name]: e.target.checked })} />
          : field.type === "number" || field.type === "date" ? <Input type={field.type} min={field.type === "number" ? 0 : undefined} value={draft[field.name] ?? ""} onChange={e => setDraft({ ...draft, [field.name]: field.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value, ...(field.name === "population" ? { resourceForecast: undefined } : {}) })} />
          : <Textarea aria-label={field.label} value={draft[field.name] ?? ""} onChange={e => setDraft({ ...draft, [field.name]: e.target.value })} />}
      </label>)}
      <div className="flex gap-2"><Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save record"}</Button><Button variant="outline" disabled={saving} onClick={() => setDraft(null)}>Cancel</Button></div>
    </section>}
    {query.data && !query.data.records.length && <p>No records yet.</p>}
    {query.data?.records.map(record => <section className="border rounded-lg p-4 space-y-2" key={record.id}><h3 className="font-semibold">{record.payload.title}</h3><dl className="grid md:grid-cols-2 gap-3">{form.fields.filter(field => field.name !== "title").map(field => <div key={field.name}><dt className="text-sm text-muted-foreground">{field.label}</dt><dd className="whitespace-pre-wrap break-words">{field.name === "amountMinor" ? `${record.payload.currency} ${(record.payload.amountMinor / 100).toFixed(2)}` : typeof record.payload[field.name] === "boolean" ? record.payload[field.name] ? "Yes" : "No" : String(record.payload[field.name] === "" || record.payload[field.name] == null ? "Not recorded" : record.payload[field.name]).replaceAll("_", " ")}</dd></div>)}</dl>{kind === "population_estimate" && <LifeCourseForecast estimate={record} onSave={query.data.canWrite ? async resourceForecast => {
      await planningRequest(`/api/planning-evidence/${record.id}`, "PUT", { facilityId: record.facilityId, kind: record.kind, microplanId: record.microplanId, version: record.version, payload: { ...record.payload, resourceForecast } });
      await cache.invalidateQueries({ queryKey: [key] });
    } : undefined} />}<div className="flex flex-wrap gap-3">{query.data.canWrite && kind !== "finance" && <Button variant="outline" disabled={Boolean(draft)} onClick={() => { setEditing(record); setDraft({ ...record.payload }); setMicroplan(record.microplanId ? String(record.microplanId) : ""); }}>Edit</Button>}<Button variant="ghost" onClick={async () => { try { setHistory(await planningRequest<any[]>(`/api/planning-evidence/${record.id}/history`)); } catch (e) { setError(String(e)); } }}>History</Button><Link href={`/planning-actions?facilityId=${facility}&evidenceId=${record.id}&evidenceKind=${kind}&microplanId=${record.microplanId || ""}&title=${encodeURIComponent(record.payload.title)}`}>Plan follow-up</Link>{kind === "consultation" && record.microplanId && record.payload.planningChangeType === "session" && <Link href={`/microplans/routine/${record.microplanId}?step=4&consultationId=${record.id}`}>Review proposed session change</Link>}{kind === "consultation" && record.microplanId && record.payload.planningChangeType === "budget" && <Link href={`/microplans/routine/${record.microplanId}?step=9&consultationId=${record.id}`}>Review proposed budget change</Link>}{kind === "population_estimate" && record.microplanId && <><Link href={`/microplans/routine/${record.microplanId}?step=4&targetGroupId=${record.payload.targetGroupId}&targetPopulation=${record.payload.population}`}>Open session planning with this target</Link><Link href={`/microplans/routine/${record.microplanId}?step=6&targetGroupId=${record.payload.targetGroupId}&targetPopulation=${record.payload.population}`}>Open forecasting with this target</Link></>}</div></section>)}
    {history && <section className="border rounded p-4"><h2 className="font-semibold">Revision history</h2>{history.map(row => <details key={row.version}><summary>Version {row.version} · {row.changed_at}</summary><p>Changed by {row.changed_by}</p><pre className="whitespace-pre-wrap">{JSON.stringify(row.payload, null, 2)}</pre></details>)}<Button variant="outline" onClick={() => setHistory(null)}>Close history</Button></section>}
  </div>;
}
