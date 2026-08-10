---
status: superseded by ADR-0005
---

# Test lead notification precedes ServiceM8 forwarding

Saved-report testing sends the homeowner PDF to the address entered by the synthetic test user and sends the separate internal Lead Notification to `royalglass666@gmail.com`. ServiceM8 forwarding remains disabled until its retention and privacy gate passes; this preserves end-to-end email testing without placing customer data in an unapproved ServiceM8 path.
