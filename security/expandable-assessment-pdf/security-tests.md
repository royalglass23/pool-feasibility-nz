# Security tests - expandable-assessment-pdf

| Case                                           | Boundary                     | Result   | Evidence                                                                   |
| ---------------------------------------------- | ---------------------------- | -------- | -------------------------------------------------------------------------- |
| Anonymous direct PDF request                   | Production API               | PASS     | 401, `UNAUTHORIZED`, no-store, no address disclosure                       |
| Wrong Basic credentials                        | Production API               | PASS     | 401, same safe response contract                                           |
| Valid staff PDF                                | Production API + Chromium    | PASS     | 200 PDF, nosniff/no-store, safe filename, exactly 3 pages                  |
| Malformed JSON                                 | Production API               | PASS     | 400 without reflecting input                                               |
| Raw request over 6.5 MB                        | Production API               | PASS     | 413 before renderer                                                        |
| Remote map URL                                 | Production API               | PASS     | 400                                                                        |
| Fake PNG with HTML attribute injection         | API -> renderer              | **FAIL** | 200; prefix-only map validation allowed active attribute syntax into HTML  |
| Caller-tampered address/recommendation         | API -> report integrity      | **FAIL** | 200 forged PDF                                                             |
| 50 KB nested limitation                        | API -> renderer resource use | **FAIL** | 200; shallow validator did not bound field size                            |
| Escaped assessment text injection              | API -> renderer              | PASS     | Valid PDF; ordinary report text is HTML-escaped                            |
| Invalid timestamp and unsafe correlation value | API error boundary           | PASS     | Generic 502, no probe/stack/path reflection, safe generated correlation ID |
| Two concurrent valid renders                   | API -> Chromium availability | **FAIL** | Both returned 200; no concurrency/busy control                             |

## Static security checks

- Secret-pattern scan: no committed credential found; one intentional test-only error string matched `OPENAI_API_KEY=secret`.
- Tracked environment files: only `.env.example`.
- `test.only`/unexpected skip scan: none found.
- Dependency audit: 0 critical, 0 high, 7 moderate vulnerabilities, all in development/tooling dependency paths (`drizzle-kit`, old nested `esbuild`, `shadcn`/MCP/Hono). These are not part of the production PDF runtime but require dependency backlog review.
- Database security: N/A for this feature because the approved POC and PDF path perform no database operation; this is supported by code and architecture evidence, not convenience.
