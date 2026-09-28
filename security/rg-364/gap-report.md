# Retrofit gap report — RG-364

| Gap | Resolution |
|---|---|
| Builder save advanced before route evidence could be reviewed | Explicit `Continue to your details` step; route result and adjustment remain visible |
| Adjusted route reused the complete placement workspace | Focused route-adjustment map mode hides unrelated placement controls |
| Contact heading focus occurred before the stage existed | Focus effect now gates on `currentStage === "contact"`; regression asserts focus |
| Builder rectangular surfaces retained larger radii | Builder panels and actions use the shared 3px treatment; regression rejects larger radius classes |
| Older browser specs skipped the required audience stage | Four specs now dismiss analytics and complete the audience step explicitly |
| Delivery polling exhausted a shared public rate-limit bucket | Persistence lane observes terminal states directly in the authorized dev DB; public API remains covered in report E2E |

No open RG-364 implementation, review, security, or exact-commit validation finding remains.
