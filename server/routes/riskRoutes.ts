import { Router } from "express";
import { db } from "../db";
import {
  riskMethodologies,
  riskMethodologyVersions,
  riskMethodologyProfiles,
  riskAssessments,
  riskAssessmentRuns,
  riskAreaResults,
  riskDomainResults,
  riskIndicatorResults,
  riskCaseRaw,
  riskAreaEdges,
  riskVulnerabilityResponses,
  riskActionLinks,
  insertRiskAssessmentSchema,
  insertRiskActionLinkSchema,
} from "@shared/riskSchema";
import { districts } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { isAuthenticated } from "../replitAuth";
import { requireTenant } from "../auth/tenantResolver";
import { requireDbUser } from "../auth/loadDbUser";
import {
  WHO_MEASLES_GLOBAL_RECONCILED_V1,
  classifyRiskScore,
} from "../services/risk/methodologyRegistry";
import {
  calculateAreaRiskScore,
  AreaAssessmentInput,
} from "../services/risk/scoringEngine";
import {
  parseCaseLinelistBuffer,
  parseDistrictAggregatesBuffer,
} from "../services/risk/riskImportService";
import {
  aggregateCasesByDistrictAndYear,
} from "../services/risk/caseProcessor";

export const riskRouter = Router();

// Ensure user authentication and tenant isolation
riskRouter.use(isAuthenticated, requireTenant, requireDbUser);

// ============================================================================
// METHODOLOGIES REGISTRY
// ============================================================================

riskRouter.get("/methodologies", async (req: any, res) => {
  try {
    // Return registered immutable packages
    const methodologies = [
      {
        code: WHO_MEASLES_GLOBAL_RECONCILED_V1.code,
        disease: WHO_MEASLES_GLOBAL_RECONCILED_V1.disease,
        name: WHO_MEASLES_GLOBAL_RECONCILED_V1.name,
        version: WHO_MEASLES_GLOBAL_RECONCILED_V1.version,
        sourceOrganization: WHO_MEASLES_GLOBAL_RECONCILED_V1.sourceOrganization,
        publicationReferences: WHO_MEASLES_GLOBAL_RECONCILED_V1.publicationReferences,
        maxTotalPoints: WHO_MEASLES_GLOBAL_RECONCILED_V1.maxTotalPoints,
        domains: Object.values(WHO_MEASLES_GLOBAL_RECONCILED_V1.domains),
        indicatorsCount: Object.keys(WHO_MEASLES_GLOBAL_RECONCILED_V1.indicators).length,
      },
    ];
    res.json(methodologies);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

riskRouter.get("/methodologies/:code", async (req: any, res) => {
  try {
    if (req.params.code === WHO_MEASLES_GLOBAL_RECONCILED_V1.code) {
      res.json(WHO_MEASLES_GLOBAL_RECONCILED_V1);
    } else {
      res.status(404).json({ message: "Methodology package not found" });
    }
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ============================================================================
// ASSESSMENTS LIFECYCLE
// ============================================================================

riskRouter.get("/assessments", async (req: any, res) => {
  try {
    const list = await db
      .select()
      .from(riskAssessments)
      .where(eq(riskAssessments.tenantId, req.tenantId))
      .orderBy(desc(riskAssessments.createdAt));
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

riskRouter.post("/assessments", async (req: any, res) => {
  try {
    const body = req.body;
    const [created] = await db
      .insert(riskAssessments)
      .values({
        tenantId: req.tenantId,
        title: body.title || `${body.assessmentYear || 2023} Measles Programmatic Risk Assessment`,
        methodologyVersionId: body.methodologyVersionId || "WHO_MEASLES_GLOBAL_RECONCILED_V1",
        assessmentYear: body.assessmentYear || 2023,
        baselineYears: body.baselineYears || [(body.assessmentYear || 2023) - 3, (body.assessmentYear || 2023) - 2, (body.assessmentYear || 2023) - 1],
        status: "draft",
        notes: body.notes || null,
        createdByUserId: req.user?.id,
      })
      .returning();

    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

riskRouter.get("/assessments/:id", async (req: any, res) => {
  try {
    const [assessment] = await db
      .select()
      .from(riskAssessments)
      .where(and(eq(riskAssessments.id, req.params.id), eq(riskAssessments.tenantId, req.tenantId)));

    if (!assessment) {
      return res.status(404).json({ message: "Assessment not found" });
    }

    const runs = await db
      .select()
      .from(riskAssessmentRuns)
      .where(and(eq(riskAssessmentRuns.assessmentId, assessment.id), eq(riskAssessmentRuns.tenantId, req.tenantId)))
      .orderBy(desc(riskAssessmentRuns.runNumber));

    res.json({ ...assessment, runs });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ============================================================================
// DATA INGESTION (CASE LINELIST & AGGREGATES)
// ============================================================================

riskRouter.post("/assessments/:id/import-cases", async (req: any, res) => {
  try {
    const _multer = (await import("multer")).default;
    const upload = _multer({ storage: _multer.memoryStorage() }).single("file");

    upload(req, res, async (uploadErr: any) => {
      if (uploadErr) return res.status(400).json({ message: uploadErr.message });
      if (!req.file) return res.status(400).json({ message: "File required" });

      const parsed = parseCaseLinelistBuffer(req.file.buffer);

      // Store in memory / DB cache for calculation
      // Store raw cases up to batch limit
      const recordsToInsert = parsed.processedCases.slice(0, 1000).map((c) => ({
        tenantId: req.tenantId,
        assessmentId: req.params.id,
        caseId: c.caseId,
        districtName: c.assignedDistrict,
        year: c.calendarYear,
        finalClassification: c.canonicalClassification,
        isQualifyingMeaslesThreat: c.isThreatCase,
        ageMonths: c.ageMonths,
        ageYears: c.ageMonths !== null ? String((c.ageMonths / 12).toFixed(1)) : null,
        vaccinationStatus: c.normalizedVaccinationStatus,
        isAdequateInvestigation: c.isAdequateInvestigation,
        isAdequateSpecimen: c.isAdequateSpecimen,
        isTimelyLabResult: c.isTimelyLabResult,
        isEpiLinked: c.isEpiLinked,
        isDiscarded: c.isDiscarded,
      }));

      if (recordsToInsert.length > 0) {
        await db.insert(riskCaseRaw).values(recordsToInsert);
      }

      await db
        .update(riskAssessments)
        .set({ status: "READY_TO_CALCULATE", updatedAt: new Date() })
        .where(and(eq(riskAssessments.id, req.params.id), eq(riskAssessments.tenantId, req.tenantId)));

      res.json({
        fileChecksum: parsed.fileChecksum,
        totalRows: parsed.totalRows,
        acceptedRows: parsed.acceptedRows,
        rejectedRows: parsed.rejectedRows,
        sampleIssues: parsed.validationIssues.slice(0, 5),
      });
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

riskRouter.post("/assessments/:id/import-aggregates", async (req: any, res) => {
  try {
    const _multer = (await import("multer")).default;
    const upload = _multer({ storage: _multer.memoryStorage() }).single("file");

    upload(req, res, async (uploadErr: any) => {
      if (uploadErr) return res.status(400).json({ message: uploadErr.message });
      if (!req.file) return res.status(400).json({ message: "File required" });

      const parsed = parseDistrictAggregatesBuffer(req.file.buffer);

      await db
        .update(riskAssessments)
        .set({ status: "READY_TO_CALCULATE", updatedAt: new Date() })
        .where(and(eq(riskAssessments.id, req.params.id), eq(riskAssessments.tenantId, req.tenantId)));

      res.json({
        fileChecksum: parsed.fileChecksum,
        totalDistricts: parsed.totalDistricts,
        acceptedCount: parsed.acceptedDistricts.length,
        sampleDistricts: parsed.acceptedDistricts.slice(0, 5),
      });
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ============================================================================
// CALCULATION ENGINE EXECUTION
// ============================================================================

riskRouter.post("/assessments/:id/calculate", async (req: any, res) => {
  try {
    const [assessment] = await db
      .select()
      .from(riskAssessments)
      .where(and(eq(riskAssessments.id, req.params.id), eq(riskAssessments.tenantId, req.tenantId)));

    if (!assessment) {
      return res.status(404).json({ message: "Assessment not found" });
    }

    // Determine run number
    const [lastRun] = await db
      .select({ runNumber: riskAssessmentRuns.runNumber })
      .from(riskAssessmentRuns)
      .where(and(eq(riskAssessmentRuns.assessmentId, assessment.id), eq(riskAssessmentRuns.tenantId, req.tenantId)))
      .orderBy(desc(riskAssessmentRuns.runNumber))
      .limit(1);

    const nextRunNumber = (lastRun?.runNumber || 0) + 1;

    // Create immutable run
    const [createdRun] = await db
      .insert(riskAssessmentRuns)
      .values({
        tenantId: req.tenantId,
        assessmentId: assessment.id,
        runNumber: nextRunNumber,
        calculatedByUserId: req.user?.id,
        summaryStats: { status: "RUNNING" },
      })
      .returning();

    // Fetch existing raw cases to aggregate
    const rawCases = await db
      .select()
      .from(riskCaseRaw)
      .where(and(eq(riskCaseRaw.assessmentId, assessment.id), eq(riskCaseRaw.tenantId, req.tenantId)));

    // Group into district aggregates
    const districtAggregates = aggregateCasesByDistrictAndYear(
      rawCases.map((c) => ({
        caseId: c.caseId || `case_${c.id}`,
        assignedDistrict: c.districtName || "UNKNOWN",
        calendarYear: c.year || assessment.assessmentYear - 1,
        canonicalClassification: (c.finalClassification as any) || "UNCLASSIFIED",
        isThreatCase: c.isQualifyingMeaslesThreat || false,
        isDiscarded: c.isDiscarded || c.finalClassification === "DISCARDED_NON_MEASLES",
        isEpiLinked: c.isEpiLinked || c.finalClassification === "EPI_LINKED_MEASLES",
        ageMonths: c.ageMonths !== null ? Number(c.ageMonths) : (c.ageYears ? Math.round(Number(c.ageYears) * 12) : null),
        ageBand: c.ageMonths !== null && Number(c.ageMonths) < 60 ? "<5" : (c.ageMonths !== null && Number(c.ageMonths) < 180 ? "5-14" : "15+"),
        isMcv1Eligible: (c.ageMonths !== null ? Number(c.ageMonths) >= 9 : true),
        normalizedVaccinationStatus: (c.vaccinationStatus as any) || "UNKNOWN",
        isEligibleUnvaccinatedOrUnknown: c.vaccinationStatus !== "VACCINATED",
        isAdequateInvestigation: c.isAdequateInvestigation || false,
        isAdequateSpecimen: c.isAdequateSpecimen || false,
        isTimelyLabResult: c.isTimelyLabResult || false,
        hasSpecimen: Boolean(c.isAdequateSpecimen || c.isTimelyLabResult),
        coreFieldsCompleteCount: 10,
        validationWarnings: [],
      }))
    );

    // If no imported cases, provide sample default district for assessment setup
    const districtNames = districtAggregates.size > 0 ? Array.from(districtAggregates.keys()) : ["Yambio", "Nzara", "Ezo", "Maridi", "Ibba"];

    let lowCount = 0;
    let medCount = 0;
    let highCount = 0;
    let veryHighCount = 0;
    let incCount = 0;

    for (const dName of districtNames) {
      const agg = districtAggregates.get(dName) || {
        district: dName,
        year: assessment.assessmentYear - 1,
        suspectedCases: 15,
        discardedCases: 3,
        adequatelyInvestigatedCases: 13,
        epiLinkedCases: 1,
        adequateSpecimensNonEpiLinked: 12,
        casesWithSpecimensCollected: 14,
        timelyLaboratoryResults: 12,
        threatCasesUnder5: 1,
        threatCasesAge5To14: 0,
        threatCasesAge15Plus: 0,
        threatCasesUnknownAge: 0,
        totalThreatCases: 1,
        eligibleSuspectedCases: 30,
        eligibleUnvaccinatedOrUnknown: 4,
      };

      const scoreInput: AreaAssessmentInput = {
        areaId: agg.district,
        areaName: agg.district,
        assessmentYear: assessment.assessmentYear,
        population: 135000,
        areaKm2: 3200,
        coverage: {
          mcv1: [
            { year: assessment.assessmentYear - 3, coveragePct: 82.0 },
            { year: assessment.assessmentYear - 2, coveragePct: 85.0 },
            { year: assessment.assessmentYear - 1, coveragePct: 88.0 },
          ],
          mcv2: [
            { year: assessment.assessmentYear - 3, coveragePct: 70.0 },
            { year: assessment.assessmentYear - 2, coveragePct: 74.0 },
            { year: assessment.assessmentYear - 1, coveragePct: 78.0 },
          ],
          penta1: [
            { year: assessment.assessmentYear - 3, coveragePct: 90.0 },
            { year: assessment.assessmentYear - 2, coveragePct: 92.0 },
            { year: assessment.assessmentYear - 1, coveragePct: 94.0 },
          ],
        },
        sia: {
          hasQualifyingCampaignInWindow: true,
          campaignYear: assessment.assessmentYear - 2,
          coveragePct: 94.0,
          targetAgeGroup: "WIDE",
        },
        surveillanceYearMinus1: {
          suspectedCases: agg.suspectedCases,
          discardedCases: agg.discardedCases,
          adequatelyInvestigatedCases: agg.adequatelyInvestigatedCases,
          epiLinkedCases: agg.epiLinkedCases,
          adequateSpecimensNonEpiLinked: agg.adequateSpecimensNonEpiLinked,
          casesWithSpecimensCollected: agg.casesWithSpecimensCollected,
          timelyLaboratoryResults: agg.timelyLaboratoryResults,
          threatCasesUnder5: agg.threatCasesUnder5,
          threatCasesAge5To14: agg.threatCasesAge5To14,
          threatCasesAge15Plus: agg.threatCasesAge15Plus,
          threatCasesUnknownAge: agg.threatCasesUnknownAge,
          totalThreatCases: agg.totalThreatCases,
        },
        surveillance3YearPooled: {
          eligibleSuspectedCases: agg.eligibleSuspectedCases,
          eligibleUnvaccinatedOrUnknown: agg.eligibleUnvaccinatedOrUnknown,
          hasVerifiedZeroSuspectedCases: agg.suspectedCases === 0,
        },
        neighbours: [],
        vulnerabilityFactors: {
          migrantOrUnderserved: true,
          vaccineHesitancyOrRefusal: false,
          securityOrConflictConcerns: false,
          recurrentNaturalDisasters: false,
          poorAccessOrTerrain: true,
          inadequatePoliticalSupport: false,
          highTransitHubOrBorder: false,
          massGatheringsOrEvents: false,
        },
      };

      const result = calculateAreaRiskScore(scoreInput);

      if (result.riskCategory === "LOW") lowCount++;
      else if (result.riskCategory === "MEDIUM") medCount++;
      else if (result.riskCategory === "HIGH") highCount++;
      else if (result.riskCategory === "VERY_HIGH") veryHighCount++;
      else incCount++;

      // Persist district result
      const [matchedDistrict] = await db
        .select()
        .from(districts)
        .where(and(eq(districts.name, agg.district), eq(districts.tenantId, req.tenantId)))
        .limit(1);

      const districtId = matchedDistrict?.id || 1;

      const [areaRes] = await db
        .insert(riskAreaResults)
        .values({
          tenantId: req.tenantId,
          runId: createdRun.id,
          districtId,
          provinceId: matchedDistrict?.provinceId || null,
          totalScore: result.totalScore !== null ? String(result.totalScore) : null,
          riskCategory: result.riskCategory,
          completenessRate: String(result.isIncomplete ? 50.0 : 100.0),
          population: String(scoreInput.population),
          areaKm2: String(scoreInput.areaKm2),
          populationDensity: String(Math.round(scoreInput.population / scoreInput.areaKm2)),
          domainScoresJson: {
            PI: result.domains.POPULATION_IMMUNITY.points,
            SQ: result.domains.SURVEILLANCE_QUALITY.points,
            PD: result.domains.PROGRAMME_DELIVERY.points,
            TA: result.domains.THREAT_ASSESSMENT.points,
          },
          summaryExplanation: result.summaryExplanation,
        })
        .returning();

      // Persist indicator level details for explainability
      const indRows = Object.values(result.allIndicators).map((ind) => ({
        tenantId: req.tenantId,
        runId: createdRun.id,
        districtId,
        domainCode: ind.domainId,
        indicatorCode: ind.indicatorId,
        valueRaw: ind.displayedValue,
        valueAnalytical: ind.rawNumericValue !== null ? String(ind.rawNumericValue) : null,
        numerator: ind.numerator !== null ? String(ind.numerator) : null,
        denominator: ind.denominator !== null ? String(ind.denominator) : null,
        pointsAwarded: String(ind.points ?? 0),
        maxPoints: String(ind.maxPoints),
        thresholdApplied: ind.thresholdApplied,
        formulaUsed: null,
        valueState: ind.valueState,
        explanation: ind.explanation,
        neighboursBreakdownJson: null,
      }));

      await db.insert(riskIndicatorResults).values(indRows);
    }

    // Complete run
    await db
      .update(riskAssessmentRuns)
      .set({
        summaryStats: {
          status: "COMPLETED",
          totalAreasAssessed: districtNames.length,
          lowRiskCount: lowCount,
          mediumRiskCount: medCount,
          highRiskCount: highCount,
          veryHighRiskCount: veryHighCount,
          incompleteCount: incCount,
          completedAt: new Date().toISOString(),
        },
      })
      .where(eq(riskAssessmentRuns.id, createdRun.id));

    await db
      .update(riskAssessments)
      .set({ status: "CALCULATED", updatedAt: new Date() })
      .where(and(eq(riskAssessments.id, assessment.id), eq(riskAssessments.tenantId, req.tenantId)));

    res.json({
      runId: createdRun.id,
      runNumber: nextRunNumber,
      status: "COMPLETED",
      totalAreas: districtNames.length,
      distribution: {
        low: lowCount,
        medium: medCount,
        high: highCount,
        veryHigh: veryHighCount,
        incomplete: incCount,
      },
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ============================================================================
// RESULTS & EXPLANATIONS
// ============================================================================

riskRouter.get("/assessments/:id/results", async (req: any, res) => {
  try {
    const { category, search, page = 1, pageSize = 25 } = req.query;

    // Get latest run
    const [latestRun] = await db
      .select()
      .from(riskAssessmentRuns)
      .where(and(eq(riskAssessmentRuns.assessmentId, req.params.id), eq(riskAssessmentRuns.tenantId, req.tenantId)))
      .orderBy(desc(riskAssessmentRuns.runNumber))
      .limit(1);

    if (!latestRun) {
      return res.json({ rows: [], totalCount: 0, latestRun: null });
    }

    const allRows = await db
      .select({
        id: riskAreaResults.id,
        runId: riskAreaResults.runId,
        tenantId: riskAreaResults.tenantId,
        districtId: riskAreaResults.districtId,
        districtName: districts.name,
        provinceId: riskAreaResults.provinceId,
        totalScore: riskAreaResults.totalScore,
        riskCategory: riskAreaResults.riskCategory,
        completenessRate: riskAreaResults.completenessRate,
        population: riskAreaResults.population,
        areaKm2: riskAreaResults.areaKm2,
        populationDensity: riskAreaResults.populationDensity,
        domainScoresJson: riskAreaResults.domainScoresJson,
        summaryExplanation: riskAreaResults.summaryExplanation,
        createdAt: riskAreaResults.createdAt,
      })
      .from(riskAreaResults)
      .leftJoin(districts, eq(riskAreaResults.districtId, districts.id))
      .where(and(eq(riskAreaResults.runId, latestRun.id), eq(riskAreaResults.tenantId, req.tenantId)));

    let filtered = allRows;

    if (category && category !== "ALL") {
      filtered = filtered.filter((r) => r.riskCategory === category);
    }
    if (search) {
      const s = String(search).toLowerCase();
      filtered = filtered.filter((r) => (r.districtName || "").toLowerCase().includes(s) || String(r.districtId).includes(s));
    }

    const startIdx = (Number(page) - 1) * Number(pageSize);
    const paginated = filtered.slice(startIdx, startIdx + Number(pageSize));

    res.json({
      rows: paginated,
      totalCount: filtered.length,
      latestRun,
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

riskRouter.get("/assessments/:id/results/:areaResultId/explanation", async (req: any, res) => {
  try {
    const [areaRes] = await db
      .select()
      .from(riskAreaResults)
      .where(and(eq(riskAreaResults.id, req.params.areaResultId), eq(riskAreaResults.tenantId, req.tenantId)));

    if (!areaRes) {
      return res.status(404).json({ message: "Area result not found" });
    }

    const indicators = await db
      .select()
      .from(riskIndicatorResults)
      .where(and(
        eq(riskIndicatorResults.runId, areaRes.runId),
        eq(riskIndicatorResults.districtId, areaRes.districtId),
        eq(riskIndicatorResults.tenantId, req.tenantId)
      ));

    res.json({
      area: areaRes,
      indicators,
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ============================================================================
// FORMAL REVIEW & APPROVAL
// ============================================================================

riskRouter.post("/assessments/:id/reviews", async (req: any, res) => {
  try {
    const { decision, reviewNotes } = req.body; // APPROVED | REJECTED | CHANGES_REQUESTED

    let newStatus: "APPROVED" | "VALIDATION_REQUIRED" | "DRAFT" = "VALIDATION_REQUIRED";
    if (decision === "APPROVED") newStatus = "APPROVED";
    else if (decision === "REJECTED") newStatus = "DRAFT";

    const [updated] = await db
      .update(riskAssessments)
      .set({
        status: newStatus,
        approvedAt: decision === "APPROVED" ? new Date() : null,
        approvedByUserId: decision === "APPROVED" ? req.user?.id : null,
        updatedAt: new Date(),
      })
      .where(and(eq(riskAssessments.id, req.params.id), eq(riskAssessments.tenantId, req.tenantId)))
      .returning();

    res.json({
      assessment: updated,
      decision,
      reviewNotes,
      reviewedAt: new Date(),
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ============================================================================
// LINKED PROGRAMME ACTIONS (MICROPLANS & SUPERVISION)
// ============================================================================

riskRouter.post("/actions", async (req: any, res) => {
  try {
    const parsed = insertRiskActionLinkSchema.parse({
      ...req.body,
      tenantId: req.tenantId,
      createdBy: req.user?.id,
    });

    const [created] = await db.insert(riskActionLinks).values(parsed).returning();
    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

riskRouter.get("/assessments/:id/actions", async (req: any, res) => {
  try {
    const actions = await db
      .select()
      .from(riskActionLinks)
      .where(and(eq(riskActionLinks.assessmentId, req.params.id), eq(riskActionLinks.tenantId, req.tenantId)))
      .orderBy(desc(riskActionLinks.createdAt));
    res.json(actions);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});
