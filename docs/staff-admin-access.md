# Staff Admin access

The Staff Workspace has one individually provisioned Admin account. It uses a
username and password, not shared Basic authentication, bearer links, email
magic links, or public account registration.

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

## Temporary launch sequencing

Until MT-255 deliberately opens the homeowner journey, the existing
application-wide development access gate continues to protect the non-Staff
application routes. The proxy deliberately lets the Staff sign-in and
session-protected saved-assessment routes reach this Admin session boundary.

## Isolated integration proof

The repository includes an opt-in authentication-store integration test. It
runs only when both `MT254_DATABASE_URL` points to an otherwise empty,
isolated database and `MT254_DATABASE_SENTINEL=geomap-mt254-isolated` is set.
It refuses a database that already contains an Admin account, then cleans up
only the account and sessions it created. Never point this test at a shared,
development, or production database.
