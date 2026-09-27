# E2E results — RG-364

- Exact-commit full Playwright lane: **22 passed**, 0 failed, 0 skipped, 0 flaky, zero retries.
- Focused RG-364 lane: all 12 tests passed after rate-limit-safe isolation.
- Input-security lane: all 22 cases passed across their intended modes: the database-disabled mode proves safe persistence failure, and `INPUT_SECURITY_DATABASE=dev` proves independent-context persistence against the guarded development target.
- Visual evidence: nine synthetic local screenshots cover Place pool, homeowner/builder details, both Your details views, and the three report tabs at desktop/mobile including 200% page scale.

The exact-commit gate ran from a clean Git archive of `3a2db915ae9245732c7207da4799dfd2f70e8cc4`. All repository-wide and RG-364 paths passed, including persisted homeowner report, synthetic PDF/email delivery, anonymous staff denial, and authenticated saved-report reproduction. The formal verdict is **PASS**.
