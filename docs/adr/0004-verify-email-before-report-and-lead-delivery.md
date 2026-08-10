---
status: superseded by ADR-0005
---

# Verify mailbox control before report and lead delivery

A real-customer report request first sends a one-click verification message to the submitted email address. Its single-purpose link expires after 30 minutes, a replacement revokes every older link, and no more than three links may be sent for the same address or client IP in an hour. The first successful verification releases one PDF email and one environment-approved Lead Notification; repeated valid-window clicks may reopen the report but cannot repeat either delivery. This reduces unsolicited messages and false leads while deliberately proving mailbox control rather than identity or property ownership.
