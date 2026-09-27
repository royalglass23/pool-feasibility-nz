# E2E results — RG-364

- Exact-commit full Playwright lane: **21 passed**, 1 failed, 0 skipped, 0 flaky, zero retries.
- Focused RG-364 lane: all 12 tests passed after rate-limit-safe isolation.
- Input-security lane: all 22 cases passed across their intended modes: the database-disabled mode proves safe persistence failure, and `INPUT_SECURITY_DATABASE=dev` proves independent-context persistence against the guarded development target.
- Visual evidence: nine synthetic local screenshots cover Place pool, homeowner/builder details, both Your details views, and the three report tabs at desktop/mobile including 200% page scale.

The exact-commit gate ran from a clean Git archive of `5ca4529ff95c46a69e70c47c1159beb0e69eeac4`. All RG-364 paths, including persisted homeowner report and synthetic PDF/email delivery, passed. The unrelated committed staff fixture failed before page navigation because `RG-345 Synthetic Pool Builder` violates the existing letters-only homeowner-name schema. A one-line correction already exists in unrelated uncommitted work, but it was outside the approved commit scope. The formal verdict therefore remains **BLOCKED** until that fixture correction is explicitly approved, committed, and the exact-commit gate passes.
