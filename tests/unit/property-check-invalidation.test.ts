import { describe, expect, it } from "vitest";
import {
  journeyInvalidationFor,
  type JourneyInvalidation,
} from "@/modules/assessment/property-check-invalidation";

const nothingInvalidated: JourneyInvalidation = {
  propertyEvidence: false,
  placement: false,
  placementConfirmation: false,
  routeResult: false,
  signedSiteAnswers: false,
  signedPlacementSnapshot: false,
  reportFacts: false,
};

describe("Property Check invalidation matrix", () => {
  it("preserves every evidence domain for navigation without a data change", () => {
    expect(journeyInvalidationFor("navigation")).toEqual(nothingInvalidated);
  });

  it.each(["pool_position", "pool_layout", "custom_dimensions"] as const)(
    "invalidates every pool-dependent domain after %s changes",
    (change) => {
      expect(journeyInvalidationFor(change)).toEqual({
        ...nothingInvalidated,
        placementConfirmation: true,
        routeResult: true,
        signedSiteAnswers: true,
        signedPlacementSnapshot: true,
        reportFacts: true,
      });
    },
  );

  it("clears placement and every property-dependent domain after an address change", () => {
    expect(journeyInvalidationFor("address")).toEqual({
      ...nothingInvalidated,
      propertyEvidence: true,
      placement: true,
      placementConfirmation: true,
      routeResult: true,
      signedSiteAnswers: true,
      signedPlacementSnapshot: true,
      reportFacts: true,
    });
  });

  it("clears pathway-only answers and signed audience context without clearing placement", () => {
    expect(journeyInvalidationFor("pathway")).toEqual({
      ...nothingInvalidated,
      routeResult: true,
      signedSiteAnswers: true,
      reportFacts: true,
    });
  });

  it("clears dependent signatures and report facts after a details-only change", () => {
    expect(journeyInvalidationFor("details")).toEqual({
      ...nothingInvalidated,
      signedSiteAnswers: true,
      reportFacts: true,
    });
  });

  it.each(["route", "depth"] as const)(
    "clears route-bound signed evidence after a %s change",
    (change) => {
      expect(journeyInvalidationFor(change)).toEqual({
        ...nothingInvalidated,
        routeResult: true,
        signedSiteAnswers: true,
        signedPlacementSnapshot: true,
        reportFacts: true,
      });
    },
  );

  it("clears the report signature after a contact change", () => {
    expect(journeyInvalidationFor("contact")).toEqual({
      ...nothingInvalidated,
      reportFacts: true,
    });
  });
});
