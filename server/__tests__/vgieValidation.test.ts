import { describe, expect, it } from "vitest";
import { validateVgieCondition } from "../services/vgieService";

describe("validateVgieCondition", () => {
  it("permits valid single predicates on allowed columns", () => {
    expect(validateVgieCondition("assigned_facility_id IS NULL").valid).toBe(true);
    expect(validateVgieCondition("assigned_facility_id IS NOT NULL").valid).toBe(true);
    expect(validateVgieCondition("is_hard_to_reach = true").valid).toBe(true);
    expect(validateVgieCondition("high_risk = false").valid).toBe(true);
    expect(validateVgieCondition("distance_to_facility > 5").valid).toBe(true);
    expect(validateVgieCondition("distance_to_facility >= 10.5").valid).toBe(true);
    expect(validateVgieCondition("under5_population <= 100").valid).toBe(true);
    expect(validateVgieCondition("gridded_population > 250").valid).toBe(true);
  });

  it("permits compound predicates combined with AND or OR", () => {
    expect(validateVgieCondition("distance_to_facility > 5 AND is_hard_to_reach = true").valid).toBe(true);
    expect(validateVgieCondition("under5_population > 50 OR high_risk = true").valid).toBe(true);
    expect(validateVgieCondition("assigned_facility_id IS NULL AND distance_to_facility > 10").valid).toBe(true);
  });

  it("rejects SQL injection attempts with semicolons, comments, or union queries", () => {
    expect(validateVgieCondition("1=1; DROP TABLE users; --").valid).toBe(false);
    expect(validateVgieCondition("distance_to_facility > 5; SELECT * FROM users").valid).toBe(false);
    expect(validateVgieCondition("distance_to_facility > 5 -- bypass").valid).toBe(false);
    expect(validateVgieCondition("distance_to_facility > 5 /* comment */").valid).toBe(false);
    expect(validateVgieCondition("is_hard_to_reach = true UNION SELECT 1, 2, 3").valid).toBe(false);
  });

  it("rejects unauthorized columns and arbitrary table queries", () => {
    expect(validateVgieCondition("password_hash IS NOT NULL").valid).toBe(false);
    expect(validateVgieCondition("email = 'admin@vaxplan.org'").valid).toBe(false);
    expect(validateVgieCondition("tenant_id = 'xyz'").valid).toBe(false);
  });

  it("rejects non-string or oversized inputs", () => {
    expect(validateVgieCondition("").valid).toBe(false);
    expect(validateVgieCondition("   ").valid).toBe(false);
    expect(validateVgieCondition("a".repeat(205)).valid).toBe(false);
  });
});
