import { describe, it, expect } from "vitest";
import { normalizeStockVaccineName } from "../vaccineSchedule";
import { insertStockTransactionSchema } from "../schema";

describe("Stock Vaccine Name Normalization", () => {
  it("normalizes OPV dose-level names correctly", () => {
    expect(normalizeStockVaccineName("OPV-0")).toBe("OPV");
    expect(normalizeStockVaccineName("OPV-1")).toBe("OPV");
    expect(normalizeStockVaccineName("OPV-2")).toBe("OPV");
    expect(normalizeStockVaccineName("OPV-3")).toBe("OPV");
    expect(normalizeStockVaccineName("OPV")).toBe("OPV");
  });

  it("normalizes IPV dose-level names correctly", () => {
    expect(normalizeStockVaccineName("IPV-1")).toBe("IPV");
    expect(normalizeStockVaccineName("IPV-2")).toBe("IPV");
    expect(normalizeStockVaccineName("IPV")).toBe("IPV");
  });

  it("normalizes PCV dose-level names correctly", () => {
    expect(normalizeStockVaccineName("PCV-1")).toBe("PCV");
    expect(normalizeStockVaccineName("PCV-2")).toBe("PCV");
    expect(normalizeStockVaccineName("PCV-3")).toBe("PCV");
    expect(normalizeStockVaccineName("PCV")).toBe("PCV");
  });

  it("normalizes PENTA dose-level names correctly", () => {
    expect(normalizeStockVaccineName("PENTA-1")).toBe("PENTA");
    expect(normalizeStockVaccineName("PENTA-2")).toBe("PENTA");
    expect(normalizeStockVaccineName("PENTA-3")).toBe("PENTA");
    expect(normalizeStockVaccineName("PENTA")).toBe("PENTA");
  });

  it("normalizes ROTAVIRUS dose-level names correctly", () => {
    expect(normalizeStockVaccineName("ROTA-1")).toBe("ROTAVIRUS");
    expect(normalizeStockVaccineName("ROTA-2")).toBe("ROTAVIRUS");
    expect(normalizeStockVaccineName("ROTA")).toBe("ROTAVIRUS");
    expect(normalizeStockVaccineName("ROTAVIRUS")).toBe("ROTAVIRUS");
  });

  it("normalizes MR dose-level names correctly", () => {
    expect(normalizeStockVaccineName("MR-1")).toBe("MR");
    expect(normalizeStockVaccineName("MR-2")).toBe("MR");
    expect(normalizeStockVaccineName("MR")).toBe("MR");
  });

  it("normalizes TT dose-level names correctly", () => {
    expect(normalizeStockVaccineName("TT-1")).toBe("TT");
    expect(normalizeStockVaccineName("TT-2")).toBe("TT");
    expect(normalizeStockVaccineName("TT")).toBe("TT");
  });

  it("preserves other vaccine product names", () => {
    expect(normalizeStockVaccineName("BCG")).toBe("BCG");
    expect(normalizeStockVaccineName("HPV")).toBe("HPV");
    expect(normalizeStockVaccineName("COVID-19")).toBe("COVID-19");
    expect(normalizeStockVaccineName("Td")).toBe("TD");
  });

  it("handles formatting variations with spaces, dose labels, and custom suffixes", () => {
    expect(normalizeStockVaccineName("Penta 1")).toBe("PENTA");
    expect(normalizeStockVaccineName("Penta Dose 1")).toBe("PENTA");
    expect(normalizeStockVaccineName("PentaDose-1")).toBe("PENTA");
    expect(normalizeStockVaccineName("MR Dose 2")).toBe("MR");
    expect(normalizeStockVaccineName("OPV Dose 0")).toBe("OPV");
  });

  it("automatically normalizes vaccineName on insertStockTransactionSchema parse", () => {
    const rawPayload = {
      tenantId: "test-tenant",
      facilityId: 1,
      vaccineName: "Penta-1",
      transactionType: "receipt",
      quantityDoses: 100,
      batchNumber: "B123",
      expiryDate: "2027-06-18",
      vvmStatus: 1,
      supplierOrRecipient: "National Store",
    };

    const parsed = insertStockTransactionSchema.parse(rawPayload);
    expect(parsed.vaccineName).toBe("PENTA");
  });
});

