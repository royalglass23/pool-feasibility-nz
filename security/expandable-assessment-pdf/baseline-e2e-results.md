# Historical baseline strict E2E results - expandable-assessment-pdf

> Historical evidence only. These results describe commit `e47f4e6` before remediation and are not current candidate evidence.

- Reviewed commit: `e47f4e6fd28a6ca4249f5d1a189c32ba6ad06933`
- Environment: isolated local Next.js production build, `http://127.0.0.1:3100`, no database or live providers
- Server command: dedicated `INTERNAL_ACCESS_USERNAME`/`INTERNAL_ACCESS_PASSWORD` plus `npm.cmd run start -- -p 3100`
- Test command: `npx.cmd playwright test --config security/expandable-assessment-pdf/playwright.security.config.ts`
- Project/workers/retries: Chromium / 1 / 0
- Fixture: `normalized-data-access-v1` (`e23cc3d...eaf6996`)
- Config/spec aggregate: `0a985dee...c49ab6d` (spec alone `79cd6739...dcd5251`)
- Result: **5 passed, 4 failed, 0 skipped, 0 flaky**
- Verdict: **FAIL**

## Failed required behavior

1. Attribute-injection-shaped fake PNG was accepted and produced `200` instead of being rejected before Chromium.
2. A caller-modified address and recommendation produced `200`, proving the server cannot verify report integrity.
3. A 50 KB nested limitation string produced `200`, proving report fields are not deeply bounded.
4. Two concurrent render requests both produced `200`; no renderer-busy/concurrency control exists.

The valid PDF, authentication denial, malformed/oversized raw-body handling, escaped ordinary report text, and safe generic renderer error checks passed.

Evidence: [matrix](e2e-matrix.md), [historical machine result](baseline-e2e-results.json), runtime HTML report at `test-results/security-expandable-assessment-pdf/report/index.html`, and four retained failure traces under `test-results/security-expandable-assessment-pdf/artifacts/`.
