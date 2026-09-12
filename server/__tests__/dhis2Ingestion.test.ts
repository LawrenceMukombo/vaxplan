import { describe, it, expect, vi } from "vitest";
import {
  pullDhis2Coverage,
  pullDhis2Population,
  pushMicroplanningAchievements,
  syncDhis2BiDirectional,
} from "../services/coverageImportService";

describe("Direct DHIS2 Data Ingestion & Bi-Directional Interoperability", () => {
  const mockIntegration = {
    id: "dhis2-national-test",
    baseUrl: "https://dhis2.test.gov/api",
    secretRef: "HIS_DHIS2_TEST_TOKEN",
    dhis2DataSetUid: "IMM_DATASET_001",
    dhis2RootOrgUnit: "OU_NATIONAL_ROOT",
  };

  it("pulls routine immunization coverage statistics with simulation fallback", async () => {
    const result = await pullDhis2Coverage("test-tenant", mockIntegration, {
      period: "202504",
      rootOrgUnit: "OU_NATIONAL_ROOT",
    });

    expect(result).toBeDefined();
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.simulated).toBe(true);
    expect(Array.isArray(result.rows)).toBe(true);
  });

  it("pulls target population denominators (under-1, under-5, pregnant women)", async () => {
    const result = await pullDhis2Population("test-tenant", mockIntegration, {
      year: 2025,
      rootOrgUnit: "OU_NATIONAL_ROOT",
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result.rows)).toBe(true);
    if (result.rows.length > 0) {
      const first = result.rows[0];
      expect(first.year).toBe(2025);
      expect(first.totalPopulation).toBeGreaterThan(0);
      expect(first.under1Population).toBeGreaterThan(0);
      expect(first.under5Population).toBeGreaterThan(first.under1Population);
      expect(first.pregnantWomen).toBeGreaterThan(0);
    }
  });

  it("packages and transmits microplanning achievements outbound", async () => {
    const result = await pushMicroplanningAchievements("test-tenant", mockIntegration, {
      period: "202504",
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.sessionsReported).toBeGreaterThanOrEqual(0);
    expect(result.dataValuesCount).toBeGreaterThanOrEqual(0);
  });

  it("executes orchestrated bi-directional synchronization", async () => {
    const sync = await syncDhis2BiDirectional("test-tenant", "test-user-id", mockIntegration, {
      period: "202504",
      year: 2025,
    });

    expect(sync).toBeDefined();
    expect(sync.integrationId).toBe("dhis2-national-test");
    expect(sync.period).toBe("202504");
    expect(sync.year).toBe(2025);
    expect(sync.inbound).toBeDefined();
    expect(sync.outbound).toBeDefined();
    expect(sync.errors.length).toBe(0);
  });
});
