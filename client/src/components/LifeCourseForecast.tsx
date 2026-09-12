import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { calculateLifeCourseForecast, lifeCourseForecastSchema } from "@shared/lifeCourseForecast";
import type { ExtensionRecord } from "@shared/planningExtensions";

export function LifeCourseForecast({ estimate, onSave }: { estimate: ExtensionRecord; onSave?: (forecast: unknown) => Promise<void> }) {
  const [values, setValues] = useState({ coveragePercent: String(estimate.payload.resourceForecast?.assumptions.coveragePercent ?? "100"), dosesPerPerson: String(estimate.payload.resourceForecast?.assumptions.dosesPerPerson ?? ""), dosesPerVial: String(estimate.payload.resourceForecast?.assumptions.dosesPerVial ?? ""), wastagePercent: String(estimate.payload.resourceForecast?.assumptions.wastagePercent ?? ""), peoplePerSession: String(estimate.payload.resourceForecast?.assumptions.peoplePerSession ?? "") });
  const [antigen, setAntigen] = useState(estimate.payload.resourceForecast?.antigen || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const parsed = lifeCourseForecastSchema.safeParse({ population: estimate.payload.population,
    ...Object.fromEntries(Object.entries(values).map(([key,value]) => [key,value === "" ? NaN : Number(value)])) });
  const result = parsed.success ? calculateLifeCourseForecast(parsed.data) : null;
  const labels = { coveragePercent: "Planned percentage to reach", dosesPerPerson: "Doses per person", dosesPerVial: "Doses per vial", wastagePercent: "Planning wastage percentage", peoplePerSession: "Dose contacts per session" };
  return <details className="border-t pt-3"><summary className="cursor-pointer font-medium">Resource forecast for this group</summary><div className="space-y-3 pt-3"><p className="text-sm">Use national schedule and product assumptions. This forecast leaves the approved microplan and existing vaccine calculator unchanged. Session timing still needs to follow dose intervals.</p><label className="block">Vaccine or antigen<Input value={antigen} onChange={e => setAntigen(e.target.value)} /></label><div className="grid md:grid-cols-2 gap-3">{Object.entries(labels).map(([key,label]) => <label key={key}>{label}<Input type="number" min="0" value={values[key as keyof typeof values]} onChange={e => setValues({ ...values, [key]: e.target.value })} /></label>)}</div>{result ? <><p>People to reach: <strong>{result.peopleToReach}</strong> · Administration doses: <strong>{result.administrationDoses}</strong> · Supply: <strong>{result.vials} vials / {result.supplyDoses} doses</strong> · Minimum session contacts: <strong>{result.minimumSessionContacts}</strong></p>{onSave && <Button disabled={saving || !antigen.trim()} onClick={async () => {
    if (!parsed.success) return;
    setSaving(true); setMessage("");
    try { await onSave({ antigen: antigen.trim(), assumptions: parsed.data }); setMessage("Forecast saved with the estimate revision."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save forecast"); }
    finally { setSaving(false); }
  }}>{saving ? "Saving…" : "Save forecast to estimate"}</Button>}{message && <p role="status">{message}</p>}<Button variant="outline" disabled={!antigen.trim()} onClick={() => {
    const document = { estimateId: estimate.id, estimateVersion: estimate.version, facilityId: estimate.facilityId, microplanId: estimate.microplanId, targetGroupId: estimate.payload.targetGroupId, populationPurpose: estimate.payload.purpose, antigen: antigen.trim(), assumptions: parsed.success ? parsed.data : {}, forecast: result };
    const url=URL.createObjectURL(new Blob([JSON.stringify(document,null,2)],{type:"application/json"})); const a=window.document.createElement("a"); a.href=url; a.download="life-course-resource-forecast.json"; a.click(); URL.revokeObjectURL(url);
  }}>Export forecast with assumptions</Button></> : <p className="text-sm text-muted-foreground">Enter all assumptions to calculate the forecast.</p>}</div></details>;
}
