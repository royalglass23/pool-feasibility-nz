type SavedAssessmentReference = {
  id: string;
  reference: string;
};

type SavedPdfLoadTestSource = {
  httpResults: {
    runId: string;
    baseURL: string;
    databaseFingerprint: string;
    saved: SavedAssessmentReference[];
  };
  persistenceVerification: {
    runId: string;
    databaseFingerprint: string;
    syntheticMarker: string;
    syntheticAssessments: SavedAssessmentReference[];
    allIdsPresent: boolean;
    zeroEmailAttempts: boolean;
  };
};

export function validateSavedPdfLoadTestSources(input: {
  health: {
    localLoadTest: boolean;
    emailDisabled: boolean;
    databaseFingerprint: string;
  };
  sources: SavedPdfLoadTestSource[];
}): SavedAssessmentReference[] {
  if (!input.health.localLoadTest || !input.health.emailDisabled) {
    throw new Error("LOCAL_HOST_REQUIRED");
  }

  const reports: SavedAssessmentReference[] = [];
  for (const source of input.sources) {
    const expectedSyntheticMarker = `SYNTHETIC LOAD TEST ${source.httpResults.runId}; not a real enquiry; email disabled`;
    const verifiedAssessments = new Set(
      source.persistenceVerification.syntheticAssessments.map(
        ({ id, reference }) => `${id}\u0000${reference}`,
      ),
    );
    if (
      source.httpResults.runId !== source.persistenceVerification.runId ||
      source.httpResults.databaseFingerprint !==
        input.health.databaseFingerprint ||
      source.persistenceVerification.databaseFingerprint !==
        input.health.databaseFingerprint ||
      source.persistenceVerification.syntheticMarker !==
        expectedSyntheticMarker ||
      source.httpResults.baseURL !== "http://127.0.0.1:3100" ||
      !source.persistenceVerification.allIdsPresent ||
      !source.persistenceVerification.zeroEmailAttempts ||
      verifiedAssessments.size !== source.httpResults.saved.length ||
      source.httpResults.saved.some(
        ({ id, reference }) =>
          !verifiedAssessments.has(`${id}\u0000${reference}`),
      )
    ) {
      throw new Error("VERIFIED_LOCAL_FIXTURES_REQUIRED");
    }
    for (const report of source.httpResults.saved) {
      if (!reports.some(({ id }) => id === report.id)) reports.push(report);
    }
  }

  return reports;
}
