import { describe, expect, it } from "vitest";
import {
  isMisroutedVaccinationOutboxItem,
  isObsoleteOfflineTelemetryItem,
} from "../offlineOutboxRepair";

const base = {
  tenantId: "tenant-1",
  entityType: "vaccination",
  method: "POST" as const,
  retries: 5,
  createdAt: 1,
};

describe("isMisroutedVaccinationOutboxItem", () => {
  it("selects exhausted single and batch vaccination records for repair", () => {
    expect(isMisroutedVaccinationOutboxItem({ ...base, url: "/api/clients/c-1/vaccinate" })).toBe(true);
    expect(isMisroutedVaccinationOutboxItem({ ...base, url: "/api/clients/c-1/vaccinate-batch" })).toBe(true);
  });

  it("does not reset unrelated or still-retrying mutations", () => {
    expect(isMisroutedVaccinationOutboxItem({ ...base, url: "/api/clients/c-1", method: "PATCH" })).toBe(false);
    expect(isMisroutedVaccinationOutboxItem({ ...base, url: "/api/clients/c-1/vaccinate", retries: 4 })).toBe(false);
  });
});

describe("isObsoleteOfflineTelemetryItem", () => {
  it("selects only microplan version-event telemetry", () => {
    expect(isObsoleteOfflineTelemetryItem({ ...base, url: "/api/microplans/1789287754908/version-event" })).toBe(true);
    expect(isObsoleteOfflineTelemetryItem({ ...base, url: "/api/microplans/42", method: "PATCH" })).toBe(false);
    expect(isObsoleteOfflineTelemetryItem({ ...base, url: "/api/sessions/42/version-event" })).toBe(false);
  });
});
