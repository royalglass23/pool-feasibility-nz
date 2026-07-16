# Security report — geomap-intial Job 01

- Stack: Node.js / Next.js
- Mode: retrofit
- Date: 2026-07-16
- Reviewed HEAD: `ddbf30b9dcaa2e6105fd185eb189c7441f0bdf5e`
- Scope: current uncommitted remediated Job 01 CLI, GIS adapter, and local aerial verifier
- Standards: OWASP Top 10:2021; OWASP ASVS 4.0 Level 2 condensed checklist
- Verdict: PASS

## Summary

The three previous security blockers are closed: screenshot output is validated
and contained, response limits are enforced while streaming, and production
dependencies audit clean with a successful Next build. Generic property images
are ignored, geometry size is explicit, and the full 14-test suite passes.

There are no High/Critical findings and no applicable failed check. Four moderate
full-audit entries remain solely in stable Drizzle Kit's non-shipped legacy
esbuild loader. The cited behavior requires an exposed esbuild development
server; this project does not start one through Drizzle Kit. This is accepted as
a low residual watch item, not a shipped vulnerability.

## Node checklist

| Check                          | Result | Evidence                                                                          |
| ------------------------------ | ------ | --------------------------------------------------------------------------------- |
| Parameterized database access  | N/A    | No schema/query/migration behavior exists in Job 01                               |
| No eval/child process on input | PASS   | Scan found only `RegExp.exec`; no eval, Function constructor, or process spawn    |
| Dependency security            | PASS   | Production audit 0; patched PostCSS 8.5.19; current stable Next/Drizzle confirmed |
| Secrets handling               | PASS   | Env-only, ignored, zero value/hardcoded-secret hits                               |
| Framework hardening            | N/A    | Internal CLI only; public headers/CORS/cookies belong to later routes             |

## OWASP Top 10:2021

| Category                                       | Result | Evidence                                                                            |
| ---------------------------------------------- | ------ | ----------------------------------------------------------------------------------- |
| A01 Broken Access Control                      | N/A    | No authenticated or public resource                                                 |
| A02 Cryptographic Failures                     | PASS   | HTTPS providers; env-only credentials; zero leakage                                 |
| A03 Injection                                  | PASS   | Positive input bounds, numeric parsing, quote escaping, URL encoding, HTML encoding |
| A04 Insecure Design                            | PASS   | Threat model and abuse controls current                                             |
| A05 Security Misconfiguration                  | PASS   | Safe errors, fixed configuration, no debug output                                   |
| A06 Vulnerable and Outdated Components         | PASS   | Zero shipped/production vulnerabilities; dev-tool watch item documented             |
| A07 Identification and Authentication Failures | N/A    | No authentication surface                                                           |
| A08 Software and Data Integrity Failures       | PASS   | Lockfile, validated provider responses, controlled fixtures                         |
| A09 Security Logging and Monitoring Failures   | N/A    | Local spike; production observability deferred to later public endpoint             |
| A10 SSRF                                       | PASS   | Fixed provider catalogue and origin allow-list                                      |

## OWASP ASVS 4.0 Level 2

| Chapter                                  | Result | Evidence                                                             |
| ---------------------------------------- | ------ | -------------------------------------------------------------------- |
| V1 Architecture                          | PASS   | Trust boundaries and provider adapter documented                     |
| V2 Authentication                        | N/A    | No user authentication; provider keys are env-only                   |
| V3 Session Management                    | N/A    | No sessions                                                          |
| V4 Access Control                        | N/A    | No protected resources                                               |
| V5 Validation, Sanitization and Encoding | PASS   | Address/provider/geometry/path/HTML boundaries validated             |
| V6 Stored Cryptography                   | N/A    | No sensitive durable store                                           |
| V7 Error Handling and Logging            | PASS   | Stable safe codes and no secret/debug leakage                        |
| V8 Data Protection                       | PASS   | Generic screenshots ignored; approved fixture retention documented   |
| V9 Communications                        | PASS   | Official external traffic uses HTTPS                                 |
| V10 Malicious Code                       | PASS   | Zero production audit findings; lockfile and dev residual documented |
| V11 Business Logic                       | PASS   | Exact/ambiguous parcel and evidence-use decisions fail closed        |
| V12 Files and Resources                  | PASS   | Numeric artifact ID and resolved-path containment                    |
| V13 API and Web Service                  | N/A    | No public application endpoint in Job 01                             |
| V14 Configuration                        | PASS   | Env-only secrets, ignored files, safe production build               |

## Explicit checks 9–12

| Check                   | Result         | Notes                                                                            |
| ----------------------- | -------------- | -------------------------------------------------------------------------------- |
| Authentication          | N/A            | Internal developer-run CLI                                                       |
| Authorization           | N/A            | No users, roles, tenants, or resources                                           |
| Input/output validation | PASS           | Address, provider, stream, geometry, HTML, and filesystem boundaries pass        |
| Logging/auditing        | PASS for scope | Intended structured stdout; no raw provider error, key, or debug instrumentation |
| Secrets handling        | PASS           | Two configured keys, zero hits outside ignored `.env`                            |

## Database and compliance

Database security is N/A because Drizzle is configured but unused in Job 01. No
compliance framework is declared. Personal-address minimization is handled by the
screenshot ignore/retention rule.

## Architecture handoff

The external boundary remains behind `DataAccessSpikeGateway` with production and
controlled adapters. Enforcer must independently rerun architecture, standards,
specification, and the final validation gate.
