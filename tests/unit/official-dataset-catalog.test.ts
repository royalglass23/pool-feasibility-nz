import { describe, expect, it } from "vitest";
import { officialDatasetEvidence } from "@/modules/providers/official-dataset-catalog";

describe("officialDatasetEvidence", () => {
  it("describes queryable layers as mapped official geometry", () => {
    expect(
      officialDatasetEvidence(
        "building_footprints" as never,
        "2026-07-17T00:00:00.000Z",
      ),
    ).toMatchObject({
      geometryUsed: "mapped_provider_geometry",
      attributesUsed: ["provider_properties"],
      evidenceType: "official_mapped_geometry",
    });
  });

  it("identifies Watercare wastewater manholes as official internal reference data", () => {
    expect(
      officialDatasetEvidence(
        "wastewater_manholes" as never,
        "2026-07-17T00:00:00.000Z",
      ),
    ).toMatchObject({
      provider: "Watercare",
      dataset: "Wastewater Manholes",
      datasetIdentifier:
        "https://services5.arcgis.com/PnnKqtqi3qfxnaPc/arcgis/rest/services/Wastewater_Network/FeatureServer/3/query",
      licenceStatus: "conditional",
      evidenceUse: "internal_reference",
      licence: "Creative Commons BY-NC-ND 3.0 New Zealand",
      attribution: {
        text: "Watercare Services Limited, CC BY-NC-ND 3.0 NZ",
        url: "https://www.watercare.co.nz/builders-and-developers/tools-fees-and-resources/gis-maps",
      },
      geometryUsed: "mapped_provider_geometry",
      evidenceType: "official_reference_geometry",
    });
  });

  it.each([
    ["public_water_assets", "Water Pipes", "Water_Network", 5],
    ["water_fittings", "Water Fittings", "Water_Network", 4],
    ["wastewater_assets", "Wastewater Pipes", "Wastewater_Network", 5],
    ["wastewater_fittings", "Wastewater Fittings", "Wastewater_Network", 1],
  ])(
    "catalogues %s as Watercare internal reference geometry",
    (key, dataset, service, layer) => {
      expect(
        officialDatasetEvidence(key as never, "2026-07-17T00:00:00.000Z"),
      ).toMatchObject({
        provider: "Watercare",
        dataset,
        datasetIdentifier: `https://services5.arcgis.com/PnnKqtqi3qfxnaPc/arcgis/rest/services/${service}/FeatureServer/${layer}/query`,
        licenceStatus: "conditional",
        evidenceUse: "internal_reference",
        geometryUsed: "mapped_provider_geometry",
      });
    },
  );
});
