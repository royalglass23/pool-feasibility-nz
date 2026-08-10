# Pool Planning Guide

This product helps New Zealand homeowners form an early, informed view of a pool project and connect with suitable professionals. It provides preliminary information, not construction approval or advice.

## Journey

**Discovery Site**:
The public first-stage website that gives New Zealand Homeowners useful early planning information and attracts relevant traffic. It does not perform Pool Builder Matches.
_Avoid_: Pool builder marketplace, referral service

**Auckland-First Launch**:
The initial public scope, in which guidance, examples, and traffic acquisition focus on Auckland before the Discovery Site expands across New Zealand.
_Avoid_: Nationwide launch, Auckland-only product

**Vercel Test Deployment**:
The temporary Vercel-hosted environment used to test the site before a final public hostname, origin policy, and Search Console property are selected. It is noindex and not part of the traffic launch.
_Avoid_: Final production hostname, indexed public launch

**Property-Check-First Launch**:
The current launch approach, built around an Auckland Property Check and useful local planning information. Cost guidance may explain site-dependent cost drivers but does not publish price ranges until they are reliable and authorised.
_Avoid_: Fixed pool quote, generic cost calculator, unsupported price guide

**Homeowner**:
A New Zealand homeowner or prospective homeowner researching whether and how to build a pool.
_Avoid_: Pool Owner, user, consumer, client

**Visitor Type**:
The report-request classification selected by the visitor: Homeowner, Pool Builder, or Other.
_Avoid_: Assumed audience, generic user type

**Project Timing**:
The visitor's selected intended timeframe: ASAP, within 3 months, within 6 months, within 12 months, or Other.
_Avoid_: Lead urgency, inferred deadline

**Checked Property Address**:
The address resolved by the Property Check and carried into the report request as a locked value. It is not retyped or changed in the request form.
_Avoid_: Free-text report address, manually edited property

**Other Detail**:
A short required explanation when a visitor selects Other for Visitor Type or Project Timing.
_Avoid_: Empty other value, catch-all category

**Report Delivery Consent**:
The required permission to store a report request and send its PDF to the submitted email address. In the controlled test flow, the same PDF is also sent to the Internal Test Report Email; it does not include marketing permission or authorise ServiceM8 forwarding.
_Avoid_: Marketing consent, newsletter opt-in

**Test Report Delivery**:
The controlled non-production delivery that immediately sends the same report PDF to the synthetic test user's submitted email address and the Internal Test Report Email. It has no verification step and must not contain customer or production data.
_Avoid_: Production report delivery, ServiceM8 test lead, customer-data test

**Internal Test Report Email**:
The controlled `royalglass666@gmail.com` recipient for the second PDF copy in Test Report Delivery.
_Avoid_: ServiceM8 forwarding address, customer recipient, production internal mailbox

**Report Request Retention Period**:
The 12-month period for keeping a submitted report request and its associated personal/property data before deletion.
_Avoid_: Indefinite lead storage, permanent property history

**Privacy Request**:
A manual request sent to `support@royalglass.co.nz` for access to, correction of, or early deletion of a report request. It does not require a visitor account.
_Avoid_: Self-service portal requirement, ignored data request

**Declared Processor**:
A service named in the privacy notice because it stores or receives a report request: Neon for storage, Resend for email delivery, and ServiceM8 only when forwarding is enabled.
_Avoid_: Undisclosed third party, always-on ServiceM8 forwarding

**Lead Notification**:
The limited internal follow-up message created after a report request is saved when an approved production integration is enabled. It is separate from Test Report Delivery.
_Avoid_: Internal test PDF copy, duplicate report email, always-on ServiceM8 forwarding

**ServiceM8 Lead Notification**:
An enabled-production Lead Notification sent to ServiceM8 only after a report request is saved and the ServiceM8 privacy gate has passed. It contains the reference, contact details, checked address, and visitor type/timing, but not a saved-report link, full PDF, or map attachment.
_Avoid_: ServiceM8 test lead, unsaved lead email, public delivery channel

**Anonymous Funnel Analytics**:
Launch measurement of page and Property Check progression using anonymous event data only, after explicit analytics-cookie consent. It excludes names, phone numbers, email addresses, exact addresses, coordinates, report contents, ad retargeting, and marketing profiles; Search Console operates separately.
_Avoid_: Lead-data analytics, session recording, retargeting audience

**Launch Rate Limit**:
An invisible limit of 10 public Property Checks per IP every 30 minutes and 3 report requests per IP every hour. A visitor who reaches it receives a calm retry message rather than a CAPTCHA.
_Avoid_: CAPTCHA-first launch, unbounded public requests, permanent visitor ban

**Pool Builder**:
A business that designs or builds pools and may later participate in Pool Builder Matches.
_Avoid_: Provider, vendor, partner

**Builder Guidance**:
Practical public information for Pool Builders about early site checks, Auckland planning context, and explaining property constraints to homeowners. It is part of the Discovery Site, not a partner programme.
_Avoid_: Builder portal, partner-only content

**Audience Path**:
The explicit homepage choice that routes either a Homeowner or a Pool Builder to guidance tailored to their present purpose.
_Avoid_: Universal landing page, one-size-fits-all journey

**Property Check**:
The shared address-based first action for both audience paths. It gives an early, preliminary view of a property's pool-planning considerations.
_Avoid_: Feasibility approval, site certification

**Anonymous Visitor Path**:
The public Auckland journey where a visitor can complete a Property Check and request their preliminary report without an account or staff credentials.
_Avoid_: Staff login, customer account, gated property check

**Staff Workspace**:
The separate protected area used by the Royal Glass Admin to review saved report requests. Access uses Staff Account Login and is not part of the Anonymous Visitor Path.
_Avoid_: Public report register, shared staff password, multi-staff portal

**Staff Account Login**:
The username-and-password sign-in used by the Royal Glass Admin before opening the Staff Workspace.
_Avoid_: Shared Basic password, visitor account, bearer report link

**Staff Account Provisioning**:
The one-time manual creation of the Admin Staff Account Login. Visitors cannot register themselves.
_Avoid_: Public registration, domain-wide automatic access

**Staff Admin**:
The single protected Royal Glass account that can view all saved report requests at launch. Multi-staff roles and account administration are deferred.
_Avoid_: Public account manager, shared superuser password, launch team portal

**Admin Bootstrap**:
The one-time local setup command that creates the first Staff Admin by prompting for credentials instead of reading them from source control or long-lived deployment settings.
_Avoid_: Committed admin password, permanent bootstrap secret

**Staff Password Reset**:
A manual reset of the Admin Staff Account Login. It is not a public or self-service email-reset flow.
_Avoid_: Open password reset, visitor reset request

**Staff Password Policy**:
A Staff Account Login password has at least 14 characters and may be a password-manager-generated password or passphrase without arbitrary composition rules.
_Avoid_: Short password, forced symbol checklist

**Staff Login Lockout**:
A 15-minute temporary lock after five failed Staff Account Login password attempts, communicated with a calm retry message.
_Avoid_: Unlimited password guessing, permanent account lock

**Staff Session**:
The authenticated Staff Workspace access period, which lasts for 8 hours before a new sign-in is required.
_Avoid_: Permanent browser login, shared session

**Property Check Preview**:
The small free result shown before contact details: an interactive pool concept that the visitor can move and rotate on the property map, plus a few clearly preliminary local signals. It establishes useful context without disclosing the full personalised report.
_Avoid_: Full report, final feasibility result

**Future Builder Network**:
A clearly labelled later-stage opportunity for Pool Builders to express interest after experiencing the Property Check. It does not yet provide matching, lead sharing, or partner access.
_Avoid_: Live builder network, active partner programme

**Pool Builder Match**:
An introduction to a suitable pool builder for a prospective pool project. This is a later-stage capability, not part of the Discovery Site.
_Avoid_: Builder referral, builder lead

**Royal Glass Consultation**:
An optional specialist conversation with Royal Glass about the glass, fencing, or other relevant parts of the pool project.
_Avoid_: Primary next step, default referral

**Location-First Match**:
A Pool Builder Match ranked first by the homeowner's service location and then by the project budget range. Pool type, partner availability, and other preferences are not first-version match criteria.
_Avoid_: Best builder match, automatic recommendation
