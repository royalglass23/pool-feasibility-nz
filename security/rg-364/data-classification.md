# Data classification — RG-364

| Data | Classification | Handling |
|---|---|---|
| Name, email, phone, company | Personal/confidential | Existing validated save and retention paths only; suppressed from analytics |
| Property address, coordinates, pool placement | Customer property/confidential | Signed snapshot and report access-token boundaries; excluded from committed evidence |
| Constructability answers and route adjustment | Customer assessment/confidential | Bound to signed snapshot and placement identity; invalidated on material edits |
| Report access token and staff session | Secret/authentication | Never logged or committed; server verification required |
| Screenshots in `tmp/rg-364-visual-evidence` | Synthetic local evidence | Ignored local output only; no real customer content |

No new data category, retention rule, recipient, or analytics destination is introduced.
