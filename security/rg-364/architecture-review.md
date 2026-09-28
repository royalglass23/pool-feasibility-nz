# Architecture review — RG-364

The implementation keeps the established deep boundaries intact: `PropertyCheckJourney` owns stage state and invalidation, `SiteQuestions` owns builder evidence capture, and `FastPropertyView` owns map presentation. Route-adjustment mode is an explicit presentation input and does not bypass snapshot signing or save validation.

The new explicit builder continuation separates evidence review from contact collection. Contact focus occurs only after the contact stage renders. Delivery waiting in persistence tests observes the authorized development database once at the end; the dedicated report E2E still verifies the public delivery-status API, saved PDF, email projection, and idempotent save boundary.

No schema, migration, service integration, authorization rule, or production runtime setting changed.
