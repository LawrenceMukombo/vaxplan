import Dexie, { type Table } from "dexie";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { offlineDb } from "@/lib/offlineDb";
import { Button } from "@/components/ui/button";

type Draft = { key: string; value: unknown; savedAt: string };
const drafts = new Dexie("vaxplan-planning-drafts") as Dexie & { drafts: Table<Draft, string> };
drafts.version(1).stores({ drafts: "key" });

/** Isolated, explicitly saved drafts. Never writes to the existing synchronization outbox. */
export function PlanningDraftControls({ scope, value, onRestore }: { scope: string; value: unknown; onRestore: (value: any) => void }) {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function operate(operation: "save" | "restore" | "remove") {
    if (!user) return;
    setBusy(true); setMessage("");
    try {
      const tenant = await offlineDb.syncMeta.get("tenantId");
      const tenantId = tenant?.value || user.tenantId;
      if (!tenantId) throw new Error("Select a country before saving a draft");
      const key = `${user.id}:${tenantId}:${scope}`;
      if (operation === "save") {
        await drafts.drafts.put({ key, value, savedAt: new Date().toISOString() });
        setMessage("Draft saved on this device. Submit it when connected.");
      } else if (operation === "restore") {
        const draft = await drafts.drafts.get(key);
        if (draft) { onRestore(draft.value); setMessage(`Restored device draft saved ${new Date(draft.savedAt).toLocaleString()}.`); }
        else setMessage("No device draft for this facility and section.");
      } else { await drafts.drafts.delete(key); setMessage("Device draft removed."); }
    } catch (e) { setMessage(e instanceof Error ? e.message : "Device draft operation failed"); }
    finally { setBusy(false); }
  }
  return <div className="space-y-2"><div className="flex flex-wrap gap-2">{value != null && <Button variant="outline" disabled={busy || !user} onClick={() => operate("save")}>Save device draft</Button>}<Button variant="outline" disabled={busy || !user} onClick={() => operate("restore")}>Restore device draft</Button><Button variant="ghost" disabled={busy || !user} onClick={() => operate("remove")}>Remove device draft</Button></div>{message && <p role="status" className="text-sm">{message}</p>}</div>;
}
