import { describe, it, expect, vi } from "vitest";
import { broadcastSessionAlerts, scheduleDefaulterRecall } from "../services/messaging";

describe("Caregiver Automated SMS Alerts & Defaulter Recall (Task Layer 6)", () => {
  const tenantId = "test-tenant-sms";

  describe("broadcastSessionAlerts", () => {
    it("should generate multilingual outreach alerts in dry-run mode (English)", async () => {
      const result = await broadcastSessionAlerts(tenantId, {
        sessionId: 9999,
        language: "en",
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(result.language).toBe("en");
      expect(result.totalCaregiversFound).toBeGreaterThan(0);
      expect(result.sentCount).toBe(result.totalCaregiversFound);
      expect(result.sampleMessage).toContain("VaxPlan reminder");
      expect(result.sampleMessage).toContain("vaccination card");
    });

    it("should generate French and Swahili session alerts", async () => {
      const resultFr = await broadcastSessionAlerts(tenantId, {
        sessionId: 9999,
        language: "fr",
        dryRun: true,
      });

      expect(resultFr.success).toBe(true);
      expect(resultFr.sampleMessage).toContain("Chère tutrice, rappel VaxPlan");

      const resultSw = await broadcastSessionAlerts(tenantId, {
        sessionId: 9999,
        language: "sw",
        dryRun: true,
      });

      expect(resultSw.success).toBe(true);
      expect(resultSw.sampleMessage).toContain("Mlezi mpendwa, ukumbusho wa VaxPlan");
    });

    it("should honor custom message overrides", async () => {
      const custom = "Urgent: Measles campaign at Central Clinic tomorrow morning!";
      const result = await broadcastSessionAlerts(tenantId, {
        sessionId: 9999,
        language: "en",
        customMessage: custom,
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.sampleMessage).toBe(custom);
    });
  });

  describe("scheduleDefaulterRecall", () => {
    it("should identify defaulters and simulate targeted recall messages in dry-run mode", async () => {
      const result = await scheduleDefaulterRecall(tenantId, {
        antigen: "MR-1",
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(result.defaultersIdentified).toBeGreaterThan(0);
      expect(result.messagesDispatched).toBe(result.defaultersIdentified);
      expect(result.sampleMessage).toContain("MR-1");
      expect(result.sampleMessage).toContain("VaxPlan recall");
    });

    it("should dispatch live recall messages via mock SMS provider and log communications", async () => {
      const result = await scheduleDefaulterRecall(tenantId, {
        antigen: "PENTA-3",
        dryRun: false,
      });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(false);
      expect(result.messagesDispatched).toBeGreaterThan(0);
      expect(result.sampleMessage).toContain("PENTA-3");
    });
  });
});
