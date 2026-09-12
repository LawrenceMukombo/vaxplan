import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { FacilityCascadePicker } from "@/components/FacilityCascadePicker";
import { planningRequest } from "@/lib/planningEvidenceClient";
import { PlanningDraftControls } from "@/components/PlanningDraftControls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { actionStatuses, canTransitionAction, isActionOverdue, planningActionSchema, type PlanningAction, type PlanningActionInput } from "@shared/planningActions";

export default function PlanningActions() {
  const cache = useQueryClient();
  const [facility, setFacility] = useState(new URLSearchParams(location.search).get("facilityId") || "");
  const [editing, setEditing] = useState<PlanningAction | null>(null);
  const [draft, setDraft] = useState<PlanningActionInput | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [history, setHistory] = useState<any[] | null>(null);
  const { data: facilities = [] } = useQuery<any[]>({ queryKey: ["/api/facilities"] });
  const { data: plans = [] } = useQuery<any[]>({ queryKey: ["/api/microplans"] });
  const { data: communities = [] } = useQuery<any[]>({ queryKey: [`/api/villages?facilityId=${facility}`], enabled: Boolean(facility) });
  const key = `/api/planning-actions?facilityId=${facility}`;
  const query = useQuery<{ actions: PlanningAction[]; canWrite: boolean; canVerify: boolean }>({ queryKey: [key], queryFn: () => planningRequest(key), enabled: Boolean(facility), retry: false });
  const { data: reviews = [] } = useQuery<any[]>({ queryKey: [`/api/quarterly-reviews?facilityId=${facility}`], enabled: Boolean(facility) });
  const { data: visits = [] } = useQuery<any[]>({ queryKey: [`/api/supervision-visits?facilityId=${facility}`], enabled: Boolean(facility) });
  const set = (name: keyof PlanningActionInput, value: unknown) => setDraft(current => current ? { ...current, [name]: value } : current);
  async function save() {
    const parsed = planningActionSchema.safeParse(draft);
    if (!parsed.success) { setError(parsed.error.issues.map(issue => issue.message).join("; ")); return; }
    if (!navigator.onLine) { setError("Reconnect to save. Your entries remain open here."); return; }
    setSaving(true); setError("");
    try {
      const saved = await planningRequest<PlanningAction>(editing ? `/api/planning-actions/${editing.id}` : "/api/planning-actions", editing ? "PUT" : "POST", {
        facilityId: Number(facility), action: parsed.data, ...(editing ? { version: editing.version } : { requestId }),
      });
      if (!saved?.id || !saved?.version) throw new Error("The action was not confirmed by the server. Keep this form open and retry when connected.");
      setDraft(null); setEditing(null); setRequestId(crypto.randomUUID()); await cache.invalidateQueries({ queryKey: [key] });
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save"); }
    finally { setSaving(false); }
  }
  const selectClass = "block border rounded p-2 w-full bg-background";
  const today = new Date();
  const date = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  const actionSummary = {
    open: query.data?.actions.filter(action => !["verified", "cancelled"].includes(action.status)).length || 0,
    overdue: query.data?.actions.filter(action => isActionOverdue(action, date)).length || 0,
    blocked: query.data?.actions.filter(action => action.status === "blocked").length || 0,
    verified: query.data?.actions.filter(action => action.status === "verified").length || 0,
  };
  return <div className="p-6 space-y-5 max-w-5xl mx-auto">
    <h1 className="text-2xl font-bold">Planning Action Register</h1>
    <p className="text-muted-foreground">Assign and follow up actions from reviews, supervision, consultations, barriers and microplans.</p>
    <Link href="/plan-health">Return to Plan Health</Link>
    <div className="space-y-1.5">
      <FacilityCascadePicker
        value={facility ? Number(facility) : null}
        disabled={Boolean(draft)}
        onChange={(id) => {
          setFacility(id ? String(id) : "");
          setHistory(null);
          setError("");
        }}
      />
    </div>
    {facility && <PlanningDraftControls scope={`${facility}:actions`} value={draft ? { draft, editing, requestId } : null} onRestore={value => { setDraft(value.draft); setEditing(value.editing || null); setRequestId(value.requestId || crypto.randomUUID()); }} />}
    {query.isLoading && facility && <p>Loading actions…</p>}
    {query.error && <p role="alert" className="text-destructive">{query.error.message}</p>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {query.data && <div className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Action status summary">{Object.entries(actionSummary).map(([label, value]) => <div key={label} className="rounded border p-3"><p className="text-xs uppercase text-muted-foreground">{label}</p><p className="text-2xl font-semibold">{value}</p></div>)}</div>}
    {query.data?.canWrite && !draft && <Button onClick={() => { const params = new URLSearchParams(location.search); const evidenceId = params.get("evidenceId") || null; const evidenceKind = params.get("evidenceKind"); setEditing(null); setDraft(planningActionSchema.parse({ title: params.get("title") || "New planning action", problem: "Describe the problem", evidenceId, sourceType: evidenceId && (evidenceKind === "consultation" || evidenceKind === "barrier") ? evidenceKind : "manual", microplanId: Number(params.get("microplanId")) || null })); }}>Add action</Button>}
    {draft && <section className="border rounded-lg p-5 space-y-4">
      <h2 className="font-semibold">{editing ? "Update action" : "New action"}</h2>
      <label className="block">Action<Input value={draft.title} onChange={e => set("title", e.target.value)} /></label>
      <label className="block">Problem<Textarea aria-label="Problem" value={draft.problem} onChange={e => set("problem", e.target.value)} /></label>
      <label className="block">Accountable owner<Input value={draft.owner} onChange={e => set("owner", e.target.value)} /></label>
      <label className="block">Supporting people (optional)<Input value={draft.supportingPeople} onChange={e => set("supportingPeople", e.target.value)} placeholder="Names, roles or teams" /></label>
      <label className="block">Deadline<Input type="date" value={draft.dueDate || ""} onChange={e => set("dueDate", e.target.value || null)} /></label>
      <label className="block">Status<select aria-label="Status" className={selectClass} value={draft.status} onChange={e => set("status", e.target.value)}>{actionStatuses.filter(s => (editing ? canTransitionAction(editing.status, s) : ["proposed", "agreed"].includes(s)) && (s !== "verified" || query.data?.canVerify)).map(s => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}</select></label>
      <label className="block">Priority<select className={selectClass} value={draft.priority} onChange={e => set("priority", e.target.value)}>{["low", "medium", "high", "critical"].map(s => <option key={s}>{s}</option>)}</select></label>
      {!editing && <><label className="block">Source<select className={selectClass} value={draft.sourceType} onChange={e => { set("sourceType", e.target.value); set("sourceId", null); }}><option value="manual">Manual</option><option value="quarterly_review">Quarterly review</option><option value="supervision">Supervision visit</option><option value="microplan">Microplan</option><option value="consultation">Community consultation</option><option value="barrier">Barrier assessment</option></select></label>{["quarterly_review", "supervision", "microplan"].includes(draft.sourceType) && <label className="block">Source record<select className={selectClass} value={draft.sourceId || ""} onChange={e => set("sourceId", Number(e.target.value) || null)}><option value="">Select a source</option>{(draft.sourceType === "supervision" ? visits : draft.sourceType === "microplan" ? plans.filter(plan => Number(plan.facilityId) === Number(facility)) : reviews).map(record => <option key={record.id} value={record.id}>{draft.sourceType === "supervision" ? `${record.supervisorName || "Supervision"} · ${String(record.scheduledDate).slice(0,10)}` : draft.sourceType === "microplan" ? record.name : `${record.year} Q${record.quarter}`}</option>)}</select></label>}</>}
      <label className="block">Related microplan (optional)<select className={selectClass} value={draft.microplanId || ""} onChange={e => set("microplanId", Number(e.target.value) || null)}><option value="">No plan selected</option>{plans.filter(plan => Number(plan.facilityId) === Number(facility)).map(plan => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label>
      <label className="block">Related community (optional)<select className={selectClass} value={draft.communityId || ""} onChange={e => set("communityId", Number(e.target.value) || null)}><option value="">No community selected</option>{communities.map(community => <option key={community.id} value={community.id}>{community.name}</option>)}</select></label>
      <label className="block">Resources needed<Textarea value={draft.resources} onChange={e => set("resources", e.target.value)} /></label>
      <label className="block">Planning decision link<select className={selectClass} value={draft.planningLinkType} onChange={e => set("planningLinkType", e.target.value)}>{["none", "session", "budget", "population", "mobilization", "microplan"].map(value => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
      {draft.planningLinkType !== "none" && <label className="block">Linked record or decision<Input value={draft.planningLinkReference} onChange={e => set("planningLinkReference", e.target.value)} placeholder="Record ID or concise description" /></label>}
      <label className="block">Completion evidence<Textarea value={draft.evidence} onChange={e => set("evidence", e.target.value)} /></label>
      <label className="block">Reason for blocking or cancellation<Textarea value={draft.resolutionReason} onChange={e => set("resolutionReason", e.target.value)} /></label>
      <div className="flex gap-2"><Button disabled={saving} onClick={save}>{saving ? "Saving…" : "Save action"}</Button><Button variant="outline" disabled={saving} onClick={() => { setDraft(null); setError(""); }}>Cancel</Button></div>
    </section>}
    {query.data && !query.data.actions.length && <p>No actions recorded for this facility.</p>}
    {query.data?.actions.map(action => <section key={action.id} className="border rounded-lg p-4 space-y-2"><h2 className="font-semibold">{action.title}</h2><p>{action.status.replaceAll("_", " ")} · {action.priority}{isActionOverdue(action, date) ? " · OVERDUE" : ""}</p><p>{action.problem}</p><p>Owner: {action.owner || "Not assigned"} · Due: {action.dueDate || "Not set"}</p>{action.supportingPeople && <p>Supporting: {action.supportingPeople}</p>}<p>Source: {action.sourceType}{action.sourceId ? ` #${action.sourceId}` : ""}</p>{action.planningLinkType !== "none" && <p>Planning link: {action.planningLinkType} · {action.planningLinkReference}</p>}{action.evidence && <p>Evidence: {action.evidence}</p>}<div className="flex gap-2">{query.data.canWrite && <Button variant="outline" disabled={Boolean(draft)} onClick={() => { setEditing(action); setDraft(planningActionSchema.parse(Object.fromEntries(Object.entries(action).filter(([key]) => !["id", "tenantId", "facilityId", "version", "createdAt", "updatedAt", "updatedBy"].includes(key))))); setError(""); }}>Update</Button>}<Button variant="ghost" onClick={async () => { try { const response = await planningRequest<any[]>(`/api/planning-actions/${action.id}/history`); setHistory(response); } catch (e) { setError(String(e)); } }}>History</Button></div></section>)}
    {reviews.some(review => review.correctiveActions) && <section className="border rounded p-4 space-y-3"><h2 className="font-semibold">Existing quarterly-review actions</h2><p className="text-sm text-muted-foreground">Quarterly review records remain unchanged and can be tracked through the shared register.</p>{reviews.filter(review => review.correctiveActions).map(review => { const tracked = query.data?.actions.some(action => action.sourceType === "quarterly_review" && action.sourceId === review.id); return <div key={review.id} className="border-t pt-2"><p>{review.year} Q{review.quarter}</p><p className="whitespace-pre-wrap">{review.correctiveActions}</p>{tracked ? <p>Linked action in register</p> : query.data?.canWrite && <Button variant="outline" disabled={Boolean(draft)} onClick={() => { setEditing(null); setDraft(planningActionSchema.parse({ title: `Quarterly review follow-up: ${review.year} Q${review.quarter}`, problem: review.correctiveActions, sourceType: "quarterly_review", sourceId: review.id })); }}>Track review action</Button>}</div>; })}</section>}
    {visits.some(visit => visit.followUpActions) && <section className="border rounded p-4 space-y-3"><h2 className="font-semibold">Existing supervision follow-up</h2><p className="text-sm text-muted-foreground">Original supervision records remain unchanged. Open a follow-up in the register when ongoing tracking is needed.</p>{visits.filter(visit => visit.followUpActions).map(visit => {
      const text = String(visit.followUpActions).split("[[vaxplan-corrective-action]]")[0].trim();
      const tracked = query.data?.actions.some(action => action.sourceType === "supervision" && action.sourceId === visit.id);
      return <div key={visit.id} className="border-t pt-2"><p>{visit.supervisorName || "Supervision visit"} · {String(visit.scheduledDate).slice(0,10)}</p><p className="whitespace-pre-wrap">{text}</p>{tracked ? <p>Linked action in register</p> : query.data?.canWrite && <Button variant="outline" disabled={Boolean(draft)} onClick={() => { setEditing(null); setDraft(planningActionSchema.parse({ title: `Supervision follow-up: ${String(visit.scheduledDate).slice(0,10)}`, problem: text || "Review supervision findings", sourceType: "supervision", sourceId: visit.id })); }}>Track follow-up</Button>}</div>;
    })}</section>}
    {history && <section className="border rounded p-4"><h2 className="font-semibold">Action history</h2>{history.map(row => <p key={row.version}>Version {row.version}: {row.payload.title} — {row.payload.status} · {row.changed_at} · {row.changed_by}</p>)}<Button variant="outline" onClick={() => setHistory(null)}>Close history</Button></section>}
  </div>;
}
