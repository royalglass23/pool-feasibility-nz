# Staff Admin access

The Staff Workspace has one individually provisioned Admin account. It uses a
username and password, not shared Basic authentication, bearer links, email
magic links, or public account registration.

Public discovery pages and `/api/public/*` Property Check/report-request routes
do not use this session. `/staff`, `/staff/[id]`, and saved-assessment GET APIs
remain Admin-only and validate the session before reading a record.

## Provision the Admin

1. Set `DATABASE_URL` locally for the approved target database. Do not put a
   real connection string, username, or password in source control.
2. Inspect and apply `drizzle/0004_nice_magma.sql` only with the separately
   approved database environment and migration authority.
3. Run `npm.cmd run staff:bootstrap`.
4. Enter a 3-64-character lowercase username and a password of at least 14
   characters. The command masks password input and creates the singleton
   Admin record.

The command fails if an Admin already exists. It stores only a salted scrypt
password hash. Keep the password in the Admin's password manager rather than
in deployment settings, shell history, or project files.

## Session and lockout behaviour

- A successful sign-in sets an HttpOnly, SameSite=Strict cookie. It is Secure
  in production and expires after eight hours.
- Five failed attempts lock the account for 15 minutes on the server.
- Sign out deletes the current session. Password reset also signs out every
  Staff session.

## Manual password reset

Use a local shell with the approved `DATABASE_URL`, then run:

```powershell
npm.cmd run staff:reset-password
```

Enter and confirm a new 14+ character password. This is the only reset path
for launch; there is no emailed or self-service reset flow.

## Route boundaries after MT-255

The homeowner journey and `/api/public/*` delivery adapters are anonymous.
They do not accept or depend on Staff credentials. The corresponding legacy
`/api/internal/*` diagnostics retain the existing Basic-auth boundary, while
`/staff` and saved-assessment read APIs continue to use the Admin session.
Each public and internal route selects its access policy explicitly before it
delegates to shared application logic; shared handlers never infer access from
the request URL.

Launch abuse controls for the anonymous endpoints are tracked by MT-257 and
remain a release gate. Strict isolated production-like journey evidence is
tracked by MT-260.

## Isolated integration proof

The repository includes an opt-in authentication-store integration test. It
runs only when both `MT254_DATABASE_URL` points to an otherwise empty,
isolated database and `MT254_DATABASE_SENTINEL=geomap-mt254-isolated` is set.
It refuses a database that already contains an Admin account, then cleans up
only the account and sessions it created. Never point this test at a shared,
development, or production database.
