export type JourneyChange =
  | "navigation"
  | "pathway"
  | "address"
  | "pool_position"
  | "pool_layout"
  | "custom_dimensions"
  | "details"
  | "route"
  | "depth"
  | "contact";

export type JourneyInvalidation = {
  propertyEvidence: boolean;
  placement: boolean;
  placementConfirmation: boolean;
  routeResult: boolean;
  signedSiteAnswers: boolean;
  signedPlacementSnapshot: boolean;
  reportFacts: boolean;
};

const PRESERVE_ALL: JourneyInvalidation = {
  propertyEvidence: false,
  placement: false,
  placementConfirmation: false,
  routeResult: false,
  signedSiteAnswers: false,
  signedPlacementSnapshot: false,
  reportFacts: false,
};

export function journeyInvalidationFor(
  change: JourneyChange,
): JourneyInvalidation {
  if (change === "navigation") return { ...PRESERVE_ALL };

  if (change === "pathway") {
    return {
      ...PRESERVE_ALL,
      routeResult: true,
      signedSiteAnswers: true,
      reportFacts: true,
    };
  }

  if (change === "details") {
    return {
      ...PRESERVE_ALL,
      signedSiteAnswers: true,
      reportFacts: true,
    };
  }

  if (change === "contact") {
    return { ...PRESERVE_ALL, reportFacts: true };
  }

  if (change === "route" || change === "depth") {
    return {
      ...PRESERVE_ALL,
      routeResult: true,
      signedSiteAnswers: true,
      signedPlacementSnapshot: true,
      reportFacts: true,
    };
  }

  const poolDependent: JourneyInvalidation = {
    ...PRESERVE_ALL,
    placementConfirmation: true,
    routeResult: true,
    signedSiteAnswers: true,
    signedPlacementSnapshot: true,
    reportFacts: true,
  };

  if (change !== "address") return poolDependent;

  return {
    ...poolDependent,
    propertyEvidence: true,
    placement: true,
  };
}
