import { describe, expect, it } from "vitest";
import {
  getMicroplanAggregations,
  type MicroplanAggregateFilters,
} from "../services/microplanAggregationService";

describe("microplanAggregationService", () => {
  const provincesFixture = [
    { id: 1, name: "Southern Province", code: "SP" },
    { id: 2, name: "Northern Province", code: "NP" },
  ];

  const districtsFixture = [
    { id: 10, name: "Choma", code: "CHO", provinceId: 1 },
    { id: 11, name: "Monze", code: "MON", provinceId: 1 },
    { id: 20, name: "Kasama", code: "KAS", provinceId: 2 },
  ];

  const facilitiesFixture = [
    { id: 101, name: "Choma Rural Health Centre", hmisCode: "CRHC01", facilityType: "rural_health_centre", districtId: 10, isActive: true },
    { id: 102, name: "Batoka Health Post", hmisCode: "BHP02", facilityType: "health_post", districtId: 10, isActive: true },
    { id: 103, name: "Macha Hospital Outpatient", hmisCode: "MHO03", facilityType: "first_level_hospital", districtId: 10, isActive: true },
    { id: 111, name: "Monze Urban Clinic", hmisCode: "MUC01", facilityType: "urban_health_centre", districtId: 11, isActive: true },
  ];

  const microplansFixture = [
    {
      id: 1001,
      facilityId: 101,
      name: "Choma RHC Routine Microplan 2026",
      planType: "routine",
      year: 2026,
      quarter: 1,
      status: "approved",
      targetPopulation: 4500,
      budget: 3200,
      staffing: [
        { role: "Vaccinator", count: 4, days: 5, dailyRate: 20 },
        { role: "Supervisor", count: 1, days: 3, dailyRate: 35 },
      ],
      submittedAt: "2026-01-10T00:00:00.000Z",
      updatedAt: "2026-01-15T00:00:00.000Z",
    },
    {
      id: 1002,
      facilityId: 102,
      name: "Batoka HP Routine Microplan 2026",
      planType: "routine",
      year: 2026,
      quarter: 1,
      status: "pending",
      targetPopulation: 1800,
      budget: 1500,
      staffing: [
        { role: "Vaccinator", count: 2, days: 4, dailyRate: 20 },
      ],
      submittedAt: "2026-01-12T00:00:00.000Z",
      updatedAt: "2026-01-12T00:00:00.000Z",
    },
  ];

  const sessionPlansFixture = [
    { id: 501, microplanId: 1001, sessionType: "static", status: "conducted", targetPopulation: 2000 },
    { id: 502, microplanId: 1001, sessionType: "outreach", status: "scheduled", targetPopulation: 2500 },
    { id: 503, microplanId: 1002, sessionType: "mobile", status: "scheduled", targetPopulation: 1800 },
  ];

  const vaccineRequirementsFixture = [
    { id: 601, facilityId: 101, vaccineName: "BCG", dosesRequired: 450, dosesWithWastage: 500, vialsRequired: 25, targetPopulation: 450, year: 2026, quarter: 1 },
    { id: 602, facilityId: 101, vaccineName: "Pentavalent", dosesRequired: 1350, dosesWithWastage: 1500, vialsRequired: 150, targetPopulation: 450, year: 2026, quarter: 1 },
    { id: 603, facilityId: 102, vaccineName: "BCG", dosesRequired: 180, dosesWithWastage: 200, vialsRequired: 10, targetPopulation: 180, year: 2026, quarter: 1 },
  ];

  const budgetItemsFixture = [
    { id: 701, facilityId: 101, category: "personnel", totalCost: 1200, fundingSource: "gavi", year: 2026, quarter: 1 },
    { id: 702, facilityId: 101, category: "transport", totalCost: 800, fundingSource: "government", year: 2026, quarter: 1 },
    { id: 703, facilityId: 101, category: "mobilization", totalCost: 1200, fundingSource: "who", year: 2026, quarter: 1 },
    { id: 704, facilityId: 102, category: "personnel", totalCost: 900, fundingSource: "government", year: 2026, quarter: 1 },
    { id: 705, facilityId: 102, category: "transport", totalCost: 600, fundingSource: "unicef", year: 2026, quarter: 1 },
  ];

  function createMockDb() {
    let callIndex = 0;
    const fixtureSequence = [
      provincesFixture,
      districtsFixture,
      facilitiesFixture,
      microplansFixture,
      sessionPlansFixture,
      vaccineRequirementsFixture,
      budgetItemsFixture,
    ];

    return {
      select: () => ({
        from: () => ({
          where: () => {
            const data = fixtureSequence[callIndex] ?? [];
            callIndex++;
            return Promise.resolve(data);
          },
        }),
      }),
    } as any;
  }

  it("aggregates microplan quantities correctly for a district manager", async () => {
    const mockDb = createMockDb();
    const filters: MicroplanAggregateFilters = {
      districtId: 10,
      planType: "routine",
      year: 2026,
      quarter: 1,
    };

    const result = await getMicroplanAggregations(mockDb, "test-tenant", filters);

    expect(result.level).toBe("district");
    expect(result.scope.districtName).toBe("Choma");
    expect(result.scope.provinceName).toBe("Southern Province");

    // Total facilities in Choma is 3 (Choma RHC, Batoka HP, Macha Hospital)
    expect(result.summary.totalFacilities).toBe(3);
    // 2 facilities have plans (101 and 102)
    expect(result.summary.facilitiesWithPlan).toBe(2);
    // Coverage = 2/3 = 66.7%
    expect(result.summary.facilityCoveragePct).toBe(67);

    // Target population: 4500 + 1800 = 6300
    expect(result.summary.totalTargetPopulation).toBe(6300);

    // Sessions: 3 total, 1 completed, 1 static, 1 outreach, 1 mobile
    expect(result.summary.sessions.total).toBe(3);
    expect(result.summary.sessions.completed).toBe(1);
    expect(result.summary.sessions.static).toBe(1);
    expect(result.summary.sessions.outreach).toBe(1);
    expect(result.summary.sessions.mobile).toBe(1);

    // Vaccine doses: (500 + 1500 + 200) = 2200 doses with wastage
    expect(result.summary.vaccines.totalDosesWithWastage).toBe(2200);
    // Vials: 25 + 150 + 10 = 185 vials
    expect(result.summary.vaccines.totalVialsRequired).toBe(185);

    // Check BCG antigen aggregation across facilities
    const bcg = result.summary.vaccines.byAntigen.find((v) => v.vaccineName === "BCG");
    expect(bcg).toBeDefined();
    expect(bcg?.dosesRequired).toBe(450 + 180);
    expect(bcg?.dosesWithWastage).toBe(500 + 200);
    expect(bcg?.vialsRequired).toBe(25 + 10);

    // Budget: 3200 + 1500 = 4700
    expect(result.summary.totalBudget).toBe(4700);

    // Staffing headcount: 4 + 1 + 2 = 7
    expect(result.summary.staffingSummary.totalHeadcount).toBe(7);

    // Facilities breakdown list
    expect(result.facilities).toBeDefined();
    expect(result.facilities).toHaveLength(3);
    const crhc = result.facilities?.find((f) => f.facilityId === 101);
    expect(crhc?.hasPlan).toBe(true);
    expect(crhc?.status).toBe("approved");
    expect(crhc?.plannedSessions).toBe(2);
    expect(crhc?.completedSessions).toBe(1);

    const macha = result.facilities?.find((f) => f.facilityId === 103);
    expect(macha?.hasPlan).toBe(false);
    expect(macha?.status).toBeNull();
  });

  it("aggregates at Provincial level with district breakdown rows", async () => {
    const mockDb = createMockDb();
    const filters: MicroplanAggregateFilters = {
      provinceId: 1,
    };

    const result = await getMicroplanAggregations(mockDb, "test-tenant", filters);

    expect(result.level).toBe("province");
    expect(result.scope.provinceName).toBe("Southern Province");
    expect(result.districts).toBeDefined();
    expect(result.districts).toHaveLength(2); // Choma and Monze

    const choma = result.districts?.find((d) => d.districtId === 10);
    expect(choma).toBeDefined();
    expect(choma?.totalFacilities).toBe(3);
    expect(choma?.facilitiesWithPlan).toBe(2);
    expect(choma?.approvedPlans).toBe(1);
    expect(choma?.pendingPlans).toBe(1);

    const monze = result.districts?.find((d) => d.districtId === 11);
    expect(monze).toBeDefined();
    expect(monze?.totalFacilities).toBe(1);
    expect(monze?.facilitiesWithPlan).toBe(0);
  });

  it("aggregates at National level with province breakdown rows", async () => {
    const mockDb = createMockDb();
    const filters: MicroplanAggregateFilters = {
      allScope: true,
    };

    const result = await getMicroplanAggregations(mockDb, "test-tenant", filters);

    expect(result.level).toBe("national");
    expect(result.provinces).toBeDefined();
    expect(result.provinces).toHaveLength(2); // Southern Province and Northern Province

    const southern = result.provinces?.find((p) => p.provinceId === 1);
    expect(southern).toBeDefined();
    expect(southern?.totalDistricts).toBe(2);
    expect(southern?.totalFacilities).toBe(4);
    expect(southern?.facilitiesWithPlan).toBe(2);
  });

  it("keeps routine and campaign forecasts isolated for the same facility and period", async () => {
    const plans = [
      {
        id: 2001,
        facilityId: 101,
        name: "Routine plan",
        planType: "routine",
        year: 2026,
        quarter: 1,
        status: "approved",
        targetPopulation: 100,
        budget: 0,
        staffing: {
          submissionSnapshot: {
            vaccineForecast: [{ name: "BCG", target: "100", doses: 1, wastage: "10" }],
            budget: [{ category: "Transport", quantity: "2", unitCost: "50", fundingSource: "government" }],
            staffing: [{ role: "Vaccinator", count: 2, days: 3, dailyRate: 10 }],
          },
        },
      },
      {
        id: 2002,
        facilityId: 101,
        name: "SIA plan",
        planType: "sia_campaign",
        year: 2026,
        quarter: 1,
        status: "pending",
        targetPopulation: 250,
        budget: 0,
        staffing: {
          submissionSnapshot: {
            vaccineForecast: [{ name: "MR", target: "250", doses: 1, wastage: "20" }],
            budget: [{ category: "Mobilization", quantity: "3", unitCost: "75", fundingSource: "gavi" }],
            staffing: [{ role: "Campaign vaccinator", count: 4, days: 2, dailyRate: 15 }],
          },
        },
      },
    ];
    const makeDb = () => {
      let callIndex = 0;
      const sequence = [provincesFixture, districtsFixture, facilitiesFixture, plans, [], vaccineRequirementsFixture, budgetItemsFixture];
      return {
        select: () => ({ from: () => ({ where: () => Promise.resolve(sequence[callIndex++] ?? []) }) }),
      } as any;
    };

    const routine = await getMicroplanAggregations(makeDb(), "test-tenant", { planType: "routine", year: 2026, quarter: 1 });
    const campaign = await getMicroplanAggregations(makeDb(), "test-tenant", { planType: "campaign", year: 2026, quarter: 1 });

    expect(routine.summary.vaccines.totalDosesWithWastage).toBe(111);
    expect(routine.summary.vaccines.byAntigen.map((row) => row.vaccineName)).toEqual(["BCG"]);
    expect(routine.summary.totalBudget).toBe(100);
    expect(routine.summary.staffingSummary.totalHeadcount).toBe(2);

    expect(campaign.summary.vaccines.totalDosesWithWastage).toBe(300);
    expect(campaign.summary.vaccines.byAntigen.map((row) => row.vaccineName)).toEqual(["MR"]);
    expect(campaign.summary.totalBudget).toBe(225);
    expect(campaign.summary.staffingSummary.totalHeadcount).toBe(4);
  });

  it("handles empty facilities or plans gracefully", async () => {
    const emptyDb = {
      select: () => ({
        from: () => ({
          where: () => Promise.resolve([]),
        }),
      }),
    } as any;

    const result = await getMicroplanAggregations(emptyDb, "test-tenant", {
      districtId: 999,
    });

    expect(result.level).toBe("district");
    expect(result.summary.totalPlans).toBe(0);
    expect(result.summary.totalFacilities).toBe(0);
    expect(result.summary.facilityCoveragePct).toBe(0);
    expect(result.summary.totalTargetPopulation).toBe(0);
    expect(result.summary.totalBudget).toBe(0);
    expect(result.facilities).toEqual([]);
  });
});
