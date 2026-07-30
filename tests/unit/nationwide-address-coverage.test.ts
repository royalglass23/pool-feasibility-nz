import cases from "../fixtures/linz/nationwide-address-cases.json";
import providerResponses from "../fixtures/linz/nationwide-provider-responses.json";
import { describe, expect, it } from "vitest";
import {
  buildAddressLikePattern,
  normalizeAddressQuery,
} from "@/modules/providers/official-gis-gateway";
import { classifyBoundaryState } from "@/modules/data-access-spike/run-data-access-spike";
import type { ParcelMatch } from "@/modules/data-access-spike/data-access-gateway";

describe("nationwide LINZ address contract", () => {
  it.each(cases)(
    "normalizes the $category coverage case",
    ({ input, expected }) => {
      expect(normalizeAddressQuery(input)).toBe(
        expected
          .toLocaleLowerCase("en-NZ")
          .replace(/\b\d{4}\b/gu, " ")
          .replace(/[^\p{L}\p{N}]+/gu, " ")
          .replace(/\s+/g, " ")
          .trim(),
      );
    },
  );

  it("contains every required coverage category and provider response", () => {
    expect(cases.map(({ category }) => category)).toEqual(
      expect.arrayContaining([
        "standard",
        "unit",
        "multi-title",
        "cross-lease",
        "rural",
        "long-driveway",
        "new-subdivision",
        "multiple-addresses",
      ]),
    );
    expect(Object.keys(providerResponses).sort()).toEqual(
      cases.map(({ id }) => id).sort(),
    );
    expect(cases).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fixture: expect.objectContaining({
            durationMs: expect.any(Number),
          }),
        }),
      ]),
    );
  });

  it("keeps comma-separated and comma-free tokens searchable", () => {
    expect(
      buildAddressLikePattern(
        normalizeAddressQuery("42A Bahari Drive, Ranui, Auckland"),
      ),
    ).toBe("42a%bahari%drive%ranui%auckland");
  });

  it("types confirmed, provisional, multiple, and unavailable boundaries", () => {
    const confirmed = {
      parcelIntent: "Fee Simple Title",
      titles: ["TITLE-1"],
    } as ParcelMatch;
    const provisional = {
      parcelIntent: "Cross Lease",
      titles: ["TITLE-1", "TITLE-2"],
    } as ParcelMatch;

    expect(classifyBoundaryState([confirmed])).toBe("confirmed");
    expect(classifyBoundaryState([provisional])).toBe("provisional");
    expect(classifyBoundaryState([])).toBe("unavailable");
    expect(classifyBoundaryState([{} as never, {} as never])).toBe("multiple");
  });
});
