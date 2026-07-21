import "dotenv/config";
import { summarizeLiveLayerSmoke } from "../src/modules/data-access-spike/live-layer-smoke";
import { runDataAccessSpike } from "../src/modules/data-access-spike/run-data-access-spike";
import { OfficialGisGateway } from "../src/modules/providers/official-gis-gateway";
import { providerTimeoutMs } from "../src/shared/http/provider-runtime";

const defaultAddress = "42A Bahari Drive, Ranui, Auckland";

async function main(): Promise<void> {
  const requestedAddress =
    process.argv.slice(2).join(" ").trim() || defaultAddress;
  const result = await runDataAccessSpike({
    requestedAddress,
    gateway: new OfficialGisGateway({ timeoutMs: providerTimeoutMs() }),
    basemapApiKey: process.env.LINZ_BASEMAPS_API_KEY || undefined,
  });
  const summary = summarizeLiveLayerSmoke(result);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (summary.overall !== "pass") process.exitCode = 1;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "";
  const safeCode = /^[A-Z][A-Z0-9_]+$/.test(message)
    ? message
    : "LIVE_LAYER_SMOKE_FAILED";
  process.stderr.write(`${JSON.stringify({ error: safeCode })}\n`);
  process.exitCode = 1;
});
