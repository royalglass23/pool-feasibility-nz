import { mkdir, writeFile } from "node:fs/promises";
import { classifyBoundaryState } from "@/modules/data-access-spike/run-data-access-spike";
import type { BoundaryState } from "@/modules/data-access-spike/run-data-access-spike";
import {
  normalizeAddressResponse,
  normalizeParcelResponse,
  OfficialGisGateway,
} from "@/modules/providers/official-gis-gateway";
import cases from "../tests/fixtures/linz/nationwide-address-cases.json";
import providerResponses from "../tests/fixtures/linz/nationwide-provider-responses.json";

type CoverageRow = {
  id: string;
  category: string;
  input: string;
  found: boolean;
  boundaryState: BoundaryState;
  layerAvailability:
    "regional_layers_available" | "regional_unavailable" | "not_requested";
  durationMs: number;
  error?: string;
};

const live = process.argv.includes("--live");
const gateway = live ? new OfficialGisGateway() : null;
const rows: CoverageRow[] = [];

async function main(): Promise<void> {
  for (const testCase of cases) {
    const startedAt = performance.now();
    try {
      const matches = gateway
        ? await gateway.searchAddresses(testCase.input)
        : [];
      const fixtureResponse =
        providerResponses[testCase.id as keyof typeof providerResponses];
      const fixtureAddresses = live
        ? []
        : normalizeAddressResponse(fixtureResponse.address);
      const fixtureParcels = live
        ? null
        : normalizeParcelResponse(fixtureResponse.parcel);
      const addresses = live ? matches : fixtureAddresses;
      const found = addresses.length > 0;
      const boundaryState = !live
        ? classifyBoundaryState(fixtureParcels!.parcels)
        : !found
          ? "unavailable"
          : classifyBoundaryState(
              (await gateway!.findParcelsAt(addresses[0].coordinates)).parcels,
            );
      const layerAvailability: CoverageRow["layerAvailability"] = !found
        ? "not_requested"
        : addresses[0].territorialAuthority === "Auckland"
          ? "regional_layers_available"
          : "regional_unavailable";
      rows.push({
        id: testCase.id,
        category: testCase.category,
        input: testCase.input,
        found,
        boundaryState,
        layerAvailability,
        durationMs: measuredDurationMs(startedAt),
      });
    } catch (error) {
      rows.push({
        id: testCase.id,
        category: testCase.category,
        input: testCase.input,
        found: false,
        boundaryState: "unavailable",
        layerAvailability: "not_requested",
        durationMs: measuredDurationMs(startedAt),
        error:
          error instanceof Error ? error.message : "PROVIDER_REQUEST_FAILED",
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    source: "LINZ NZ Addresses",
    mode: live ? "live" : "fixture-baseline",
    fallback: "none",
    cases: rows,
    notes: [
      "Address coverage and latency are measured independently from detailed regional layers.",
      "A missing boundary is not evidence that usable property area is absent.",
      "Fixture-baseline timing measures local normalization and classification of captured provider-shaped responses; it is not network latency.",
      "Run with --live only when official-provider network access is approved to record provider response timing.",
    ],
  };

  await mkdir("output", { recursive: true });
  await writeFile(
    "output/nationwide-linz-coverage.json",
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify(report, null, 2));
}

function measuredDurationMs(startedAt: number): number {
  return Number(Math.max(performance.now() - startedAt, 0.001).toFixed(3));
}

void main();
