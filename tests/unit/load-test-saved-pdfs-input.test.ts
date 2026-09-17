import { describe, expect, it } from "vitest";
import { validateSavedPdfLoadTestSources } from "../../scripts/load-test-saved-pdfs-input";

describe("saved PDF load-test input", () => {
  const matchingSource = {
    httpResults: {
      runId: "run-1",
      baseURL: "http://127.0.0.1:3100",
      databaseFingerprint: "development-db",
      saved: [{ id: "assessment-1", reference: "GF-1" }],
    },
    persistenceVerification: {
      runId: "run-1",
      databaseFingerprint: "development-db",
      syntheticMarker:
        "SYNTHETIC LOAD TEST run-1; not a real enquiry; email disabled",
      syntheticAssessments: [{ id: "assessment-1", reference: "GF-1" }],
      allIdsPresent: true,
      zeroEmailAttempts: true,
    },
  };

  it("rejects evidence files produced by different load-test runs", () => {
    expect(() =>
      validateSavedPdfLoadTestSources({
        health: {
          localLoadTest: true,
          emailDisabled: true,
          databaseFingerprint: "development-db",
        },
        sources: [
          {
            httpResults: {
              runId: "run-1",
              baseURL: "http://127.0.0.1:3100",
              databaseFingerprint: "development-db",
              saved: [{ id: "assessment-1", reference: "GF-1" }],
            },
            persistenceVerification: {
              runId: "run-2",
              databaseFingerprint: "development-db",
              syntheticMarker:
                "SYNTHETIC LOAD TEST run-2; not a real enquiry; email disabled",
              syntheticAssessments: [{ id: "assessment-1", reference: "GF-1" }],
              allIdsPresent: true,
              zeroEmailAttempts: true,
            },
          },
        ],
      }),
    ).toThrow("VERIFIED_LOCAL_FIXTURES_REQUIRED");
  });

  it("rejects evidence from a database other than the active local load-test database", () => {
    expect(() =>
      validateSavedPdfLoadTestSources({
        health: {
          localLoadTest: true,
          emailDisabled: true,
          databaseFingerprint: "different-development-db",
        },
        sources: [matchingSource],
      }),
    ).toThrow("VERIFIED_LOCAL_FIXTURES_REQUIRED");
  });

  it("rejects evidence without the run's exact synthetic marker", () => {
    expect(() =>
      validateSavedPdfLoadTestSources({
        health: {
          localLoadTest: true,
          emailDisabled: true,
          databaseFingerprint: "development-db",
        },
        sources: [
          {
            ...matchingSource,
            persistenceVerification: {
              ...matchingSource.persistenceVerification,
              syntheticMarker: "not the generated synthetic marker",
            },
          },
        ],
      }),
    ).toThrow("VERIFIED_LOCAL_FIXTURES_REQUIRED");
  });

  it("rejects saved reports that are absent from the verified synthetic set", () => {
    expect(() =>
      validateSavedPdfLoadTestSources({
        health: {
          localLoadTest: true,
          emailDisabled: true,
          databaseFingerprint: "development-db",
        },
        sources: [
          {
            ...matchingSource,
            httpResults: {
              ...matchingSource.httpResults,
              saved: [{ id: "unverified-assessment", reference: "GF-999" }],
            },
          },
        ],
      }),
    ).toThrow("VERIFIED_LOCAL_FIXTURES_REQUIRED");
  });
});
