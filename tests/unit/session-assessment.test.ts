import { createDataAccessGateway } from "../fixtures/normalized-data-access";
import { describe, expect, it } from "vitest";
import { buildSessionAssessment } from "@/modules/assessment/build-session-assessment";
import { runDataAccessSpike } from "@/modules/data-access-spike/run-data-access-spike";

describe("buildSessionAssessment", () => {
  it("builds a sourced preliminary assessment with complete risks and ordered actions", async () => {
    const result = await runDataAccessSpike({
      requestedAddress: "42A Bahari Drive, Ranui, Auckland",
      gateway: createDataAccessGateway(),
      now: () => new Date("2026-07-20T01:02:03.000Z"),
    });

    const assessment = buildSessionAssessment(result);

    expect(assessment.recommendation).toBe(
      result.feasibilityAssessment.finalRecommendation,
    );
    expect(assessment.preliminaryFeasibilityWording).toBe(
      "Based on available mapped information, the property appears to have potential for a residential swimming pool, subject to onsite investigation, detailed design, utility locating, title review, and applicable approvals.",
    );
    expect(assessment.risks.length).toBeGreaterThan(0);
    for (const risk of assessment.risks) {
      expect(risk).toEqual({
        id: expect.any(String),
        category: expect.any(String),
        title: expect.any(String),
        severity: expect.stringMatching(/^(low|medium|high)$/),
        evidence: expect.any(String),
        source: expect.any(String),
        confidence: expect.stringMatching(/^(high|limited|unavailable)$/),
        impact: expect.any(String),
        action: expect.any(String),
        specialistReviewRequired: expect.any(Boolean),
      });
    }
    expect(assessment.actions.map(({ phase }) => phase)).toEqual([
      "before_concept_design",
      "before_quotations",
      "before_consent_or_construction",
    ]);
    expect(assessment.missingInformation.map(({ id }) => id)).toEqual([
      "title",
      "easements",
      "private_services",
      "public_and_private_pipe_position_and_depth",
      "consent_notices",
      "geotechnical_conditions",
      "groundwater",
      "retaining_walls",
      "construction_access",
      "pool_barrier",
      "consent_requirements",
      "onsite_service_locating",
    ]);
    expect(
      assessment.missingInformation.every(
        ({ status }) => status === "unverified",
      ),
    ).toBe(true);
    expect(assessment.limitations).toContain(
      "This assessment does not provide approval, consent advice, engineering design, construction safety assurance, a survey, title advice, utility location, or an approved pool position.",
    );
  });

  it("includes safe provenance, unavailable evidence, and the session-only lifecycle", async () => {
    const result = await runDataAccessSpike({
      requestedAddress: "42A Bahari Drive, Ranui, Auckland",
      gateway: createDataAccessGateway(),
      now: () => new Date("2026-07-20T01:02:03.000Z"),
    });

    const assessment = buildSessionAssessment(result);
    const aerial = assessment.provenance.datasets.find(
      ({ id }) => id === "aerial_imagery",
    );

    expect(assessment.property).toEqual({
      addressId: "2359811",
      address: "42A Bahari Drive, Ranui, Auckland",
      parcelId: "8545868",
      appellation: "Lot 1 DP 576345",
      generatedAt: "2026-07-20T01:02:03.000Z",
    });
    expect(assessment.session).toEqual({
      persistence: "none",
      notice:
        "This result exists only in the current browser session and disappears after refresh or restart. No database or durable report history exists.",
    });
    expect(aerial).toEqual({
      id: "aerial_imagery",
      provider: "LINZ",
      dataset: "LINZ Basemaps Aerial",
      datasetIdentifier:
        "https://basemaps.linz.govt.nz/v1/tiles/aerial/EPSG:3857/style/aerial.json",
      status: "unavailable",
      evidenceUse: "unavailable",
      retrievedAt: "2026-07-20T01:02:03.000Z",
      datasetDate: null,
      licence: "Creative Commons Attribution 4.0 International",
      attribution: null,
      confidence: "unavailable",
      availabilityNote: "LINZ_BASEMAPS_API_KEY is not configured",
    });
    expect(JSON.stringify(assessment)).not.toMatch(
      /"(?:coordinates|geometry|attributesUsed|durationMs|apiKey)"\s*:/i,
    );
  });

  it("includes every displayed deterministic result and explanation in the safe artifact", async () => {
    const result = await runDataAccessSpike({
      requestedAddress: "42A Bahari Drive, Ranui, Auckland",
      gateway: createDataAccessGateway(),
      now: () => new Date("2026-07-20T01:02:03.000Z"),
    });
    const explanation = {
      source: "deterministic_fallback" as const,
      heading: "Deterministic assessment explanation",
      paragraphs: [result.feasibilityAssessment.finalRecommendation],
    };

    const assessment = buildSessionAssessment(result, explanation);

    expect(assessment.feasibilityAssessment).toEqual(
      result.feasibilityAssessment,
    );
    expect(assessment.scenarioComparison).toMatchObject({
      version: result.scenarioComparison.version,
      preferences: result.scenarioComparison.preferences,
      rankedScenarioIds: result.scenarioComparison.rankedScenarioIds,
      successfulShells: result.scenarioComparison.successfulShells,
      shellRange: result.scenarioComparison.shellRange,
    });
    expect(assessment.scenarioComparison.scenarios).toHaveLength(
      result.scenarioComparison.scenarios.length,
    );
    expect(assessment.assessmentExplanation).toEqual(explanation);
    expect(JSON.stringify(assessment)).not.toMatch(
      /"(?:coordinates|geometry|attributesUsed|durationMs|apiKey)"\s*:/i,
    );
  });

  it("turns a deterministic critical flag into a sourced specialist risk", async () => {
    const result = await runDataAccessSpike({
      requestedAddress: "42A Bahari Drive, Ranui, Auckland",
      gateway: createDataAccessGateway(),
      now: () => new Date("2026-07-20T01:02:03.000Z"),
    });
    result.feasibilityAssessment = {
      ...result.feasibilityAssessment,
      criticalFlags: [
        {
          id: "all_candidates_flood_affected",
          effect: "qualify",
          rationale:
            "All apparent candidate areas are substantially affected by mapped flood hazards.",
        },
      ],
    };

    const assessment = buildSessionAssessment(result);

    expect(assessment.risks).toContainEqual({
      id: "critical:all_candidates_flood_affected",
      category: "Flooding and drainage",
      title: "Mapped flood hazards affect all apparent candidates",
      severity: "high",
      evidence:
        "All apparent candidate areas are substantially affected by mapped flood hazards.",
      source:
        "Auckland Council / Flood Plains; Auckland Council / Flood Prone Areas",
      confidence: "limited",
      impact:
        "Flood exposure may materially change the pool position, drainage design, cost, or feasibility.",
      action:
        "Obtain specialist flood and drainage review before progressing a concept design.",
      specialistReviewRequired: true,
    });
  });
});
