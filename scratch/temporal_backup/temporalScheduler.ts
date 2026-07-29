import { db } from "../db";
import { tenants } from "@shared/schema";
import { scheduleAtMidnight } from "./scheduler";
import { temporalService } from "../services/temporalService";

export async function runTemporalScheduler(): Promise<void> {
  const now = new Date();
  console.log(`[temporal-scheduler] Running daily dynamic activations and expirations check at ${now.toISOString()}`);

  try {
    const activeTenants = await db.select({ id: tenants.id }).from(tenants);
    for (const t of activeTenants) {
      console.log(`[temporal-scheduler] Running activations/expirations for tenant ID: ${t.id}`);
      const summary = await temporalService.activateScheduledVersions(t.id, now);
      console.log(
        `[temporal-scheduler] Tenant ${t.id} activation summary: ` +
        `activatedVersions=${summary.activatedVersions}, ` +
        `activatedRoles=${summary.activatedRoles}, ` +
        `expiredRoles=${summary.expiredRoles}, ` +
        `expiredEmployments=${summary.expiredEmployments}`
      );
    }
  } catch (error) {
    console.error("[temporal-scheduler] Error in temporal scheduler run:", error);
  }
}

let schedulerHandle: (() => void) | null = null;

export function startTemporalScheduler(): void {
  if (schedulerHandle) return;
  console.log("[temporal-scheduler] Initializing daily temporal activations background job.");
  schedulerHandle = scheduleAtMidnight(
    "temporal-activation-scheduler",
    async () => {
      await runTemporalScheduler();
    },
    { offsetMinutes: 50 } // Run at 00:50 UTC, staggered from other jobs
  );
}

export function stopTemporalScheduler(): void {
  if (schedulerHandle) {
    schedulerHandle();
    schedulerHandle = null;
  }
}
