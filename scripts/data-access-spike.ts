import "dotenv/config";
import { providerTimeoutMs } from "@/shared/http/provider-runtime";
import { OfficialGisGateway } from "../src/modules/providers/official-gis-gateway";
import { runDataAccessSpike } from "../src/modules/data-access-spike/run-data-access-spike";

async function main(): Promise<void> {
  const requestedAddress = process.argv.slice(2).join(" ").trim();
  if (!requestedAddress) {
    process.stderr.write(
      `${JSON.stringify({
        error: "ADDRESS_REQUIRED",
        usage: 'npm run spike:data-access -- "<Auckland property address>"',
      })}\n`,
    );
    process.exitCode = 1;
    return;
  }

  const result = await runDataAccessSpike({
    requestedAddress,
    gateway: new OfficialGisGateway({
      timeoutMs: providerTimeoutMs(),
    }),
    basemapApiKey: process.env.LINZ_BASEMAPS_API_KEY || undefined,
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error: unknown) => {
  const code = safeErrorCode(error);
  process.stderr.write(`${JSON.stringify({ error: code })}\n`);
  process.exitCode = 1;
});

function safeErrorCode(error: unknown): string {
  if (!(error instanceof Error)) {
    return "DATA_ACCESS_SPIKE_FAILED";
  }

  return /^[A-Z][A-Z0-9_]+$/.test(error.message)
    ? error.message
    : "DATA_ACCESS_SPIKE_FAILED";
}
