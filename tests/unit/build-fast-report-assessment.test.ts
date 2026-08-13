import { describe, expect, it } from "vitest";
import { createDataAccessGateway } from "../fixtures/normalized-data-access";
import { runFastPropertyView } from "@/modules/data-access-spike/fast-property-view";
import { buildFastReportAssessment } from "@/modules/reporting/build-fast-report-assessment";

describe("buildFastReportAssessment", () => {
  it("keeps a LINZ-resolved address available before detailed checks load", async () => {
    const fastResult = await runFastPropertyView({
      requestedAddress: "42A Bahari Drive, Ranui, Auckland",
      gateway: createDataAccessGateway(),
      basemapApiKey: "test-key",
      now: () => new Date("2026-08-13T00:00:00.000Z"),
    });

    const assessment = buildFastReportAssessment(
      fastResult,
      "2026-08-13T00:00:00.000Z",
    );

    expect(fastResult.progress.address).toBe("found");
    expect(
      assessment?.feasibilityAssessment.criticalFlags.find(
        (flag) => flag.id === "required_core_data_unavailable",
      ),
    ).toEqual(
      expect.objectContaining({
        rationale:
          "Required property information could not be confirmed: building outlines.",
      }),
    );
  });
});
