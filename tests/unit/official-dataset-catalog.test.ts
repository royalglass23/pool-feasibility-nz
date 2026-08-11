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

  it.each([
    [
      "public_stormwater_assets",
      "Stormwater Pipe",
      "cdea334c7ba9498c89b70977569007d7",
    ],
    [
      "manholes",
      "Stormwater Manhole and Chamber",
      "dab6f385653f4f899715465dcbd6c849",
    ],
    ["catchpits", "Stormwater Catchpit", "91bc332f958b4b5b97f9e93ee6f9abc1"],
    [
      "watercourses",
      "Stormwater Watercourse",
      "0ecd434661f74bf980e940cf6f699c99",
    ],
  ])(
    "catalogues %s as Auckland Council CC BY 4.0 report evidence",
    (key, dataset, itemId) => {
      expect(
        officialDatasetEvidence(key as never, "2026-08-11T00:00:00.000Z"),
      ).toMatchObject({
        provider: "Auckland Council",
        dataset,
        licenceStatus: "permitted",
        evidenceUse: "report_allowed",
        licence: "Creative Commons Attribution 4.0 International",
        attribution: {
          text: "Healthy Waters, Auckland Council, CC BY 4.0",
          url: `https://www.arcgis.com/home/item.html?id=${itemId}`,
        },
        geometryUsed: "mapped_provider_geometry",
        evidenceType: "official_open_reference_geometry",
      });
    },
  );

  it("keeps the legacy Council contours source out of reports", () => {
    expect(
      officialDatasetEvidence("contours" as never, "2026-08-11T00:00:00.000Z"),
    ).toMatchObject({
      provider: "Auckland Council",
      dataset: "Contours 2016 - 0.25 metre contours",
      licenceStatus: "conditional",
      evidenceUse: "spike_only",
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

  it.each([
    [
      "electricity_feeder_lines",
      "Electricity Distribution Feeder Network",
      "distribution_feeder_network_and_zone_substations/FeatureServer/2/query",
    ],
    [
      "gas_distribution_lines",
      "Gas Distribution Network",
      "gas_distribution_network1/FeatureServer/1/query",
    ],
  ])(
    "catalogues %s as Vector CC BY 4.0 report evidence",
    (key, dataset, path) => {
      expect(
        officialDatasetEvidence(key as never, "2026-07-22T00:00:00.000Z"),
      ).toMatchObject({
        provider: "Vector",
        dataset,
        datasetIdentifier: expect.stringContaining(path),
        licenceStatus: "permitted",
        evidenceUse: "report_allowed",
        licence: "Creative Commons Attribution 4.0 International",
        attribution: {
          text: "Vector Limited, CC BY 4.0",
        },
        geometryUsed: "mapped_provider_geometry",
        evidenceType: "official_open_reference_geometry",
      });
    },
  );
});
