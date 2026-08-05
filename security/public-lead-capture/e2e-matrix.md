# E2E matrix - public-lead-capture

| Requirement or threat | Actor and boundary | Journey or abuse case | Test | Expected result | Required |
| --- | --- | --- | --- | --- | --- |
| SR-PLC-01 / T-PLC-01 | Anonymous visitor, deployed public boundary | Use Property Check and report form without staff Basic credentials | Missing: `tests/e2e/public-lead-capture.security.spec.ts` | Public lead path works; staff routes remain denied | yes |
| SR-PLC-02 / T-PLC-02 | Anonymous caller, real API + isolated DB | Forge address/evidence/report fields while using a real signed snapshot | Missing security spec | Server stores snapshot-derived address/evidence only | yes |
| SR-PLC-03 / T-PLC-03 | Anonymous caller, real API + isolated DB | Omit Other detail; use malformed/oversized/replayed snapshot | Missing security spec | 400/413/409; no unintended row or delivery | yes |
| SR-PLC-04 / T-PLC-04 | Browser, server logs, trace artifacts | Complete a fixture submission and inspect incidental surfaces | Missing security spec + isolated log capture | No PII/secrets in URL, storage, console, traces, or logs | yes |
| SR-PLC-05 / T-PLC-05 | Visitor, rendered public form | Read privacy notice then submit | Missing security spec | Required notice and consent record are observable | yes |
| SR-PLC-06 / T-PLC-06 | Automated anonymous caller | Exceed public request quota | Missing security spec + rate-limit adapter | Deterministic throttle; no duplicate records/deliveries | yes |
| SR-PLC-07 / T-PLC-07 | Staff/non-staff, direct staff and PDF routes | Try unauthenticated and cross-record reads | Missing security spec + identities | Denied unless individually authorised | yes |
| Diagnostic UI | Browser with mocked APIs | Existing address-to-report visual flow | `tests/e2e/homeowner-report.spec.ts` | Report remains visible after mocked delivery failure | no - mocked APIs |
| Diagnostic staff UI | Browser with mocked APIs | Existing staff dashboard/detail visual flow | `tests/e2e/staff-assessments.spec.ts` | Read-only detail renders | no - mocked APIs |

## Gate status before execution

- Required rows: 7
- Strict executable rows: 0
- Isolated database, fake email capture, production-build security harness, individual staff identities, and log capture: unavailable.
