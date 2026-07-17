import type { DataAccessSpikeResult } from "./run-data-access-spike";
import { queryableDatasetKeys } from "./dataset-catalog";

const providerNames = ["LINZ", "Auckland Council", "Watercare"] as const;
const requiredMappedDatasetKeys = new Set<string>(queryableDatasetKeys);

export function summarizeLiveLayerSmoke(result: DataAccessSpikeResult) {
  const datasets = Object.entries(result.datasets).map(([key, evidence]) => ({
    key,
    provider: evidence.provider,
    dataset: evidence.dataset,
    status: evidence.status,
    featureCount: evidence.featureCount ?? null,
    evidenceUse: evidence.evidenceUse,
    errorCode: evidence.errorCode ?? null,
    datasetIdentifier: evidence.datasetIdentifier,
  }));
  const providers = Object.fromEntries(
    providerNames.map((provider) => {
      const providerDatasets = datasets.filter(
        (dataset) => dataset.provider === provider,
      );
      const requiredProviderDatasets = providerDatasets.filter((dataset) =>
        requiredMappedDatasetKeys.has(dataset.key),
      );
      const accessible =
        requiredProviderDatasets.length > 0 &&
        requiredProviderDatasets.every(
          (dataset) => dataset.status === "success",
        );
      return [
        provider,
        {
          accessible,
          evidenceUse:
            provider === "Watercare"
              ? "internal_reference"
              : (providerDatasets.find(
                  (dataset) => dataset.status === "success",
                )?.evidenceUse ?? "unavailable"),
          datasets: providerDatasets,
        },
      ];
    }),
  ) as Record<
    (typeof providerNames)[number],
    {
      accessible: boolean;
      evidenceUse: string;
      datasets: typeof datasets;
    }
  >;

  return {
    checkedAt: result.generatedAt,
    addressId: result.resolvedAddress.addressId,
    parcelId: result.parcel.parcelId,
    overall: providerNames.every((provider) => providers[provider].accessible)
      ? ("pass" as const)
      : ("fail" as const),
    providers,
  };
}
