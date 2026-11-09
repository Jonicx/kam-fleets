# Neon setup

KAM Fleets uses Neon Managed Auth for sign-in, a Neon Function for the
authenticated application API, and Neon PostgreSQL for shared fleet data.
Database migrations in [`migrations/`](./migrations/) define the relational
schema.

## Required configuration

### Browser build

Set these in `.env.local` for local Vite development and as GitHub Actions
variables for the Pages build:

- `VITE_NEON_AUTH_URL` — the Auth URL for the selected Neon branch.
- `VITE_NEON_FUNCTION_HELLO_BASE_URL` — the deployed Function base URL.

These are public endpoint URLs compiled into the browser bundle. They must not
contain credentials.

### Function environment

Configure these on the deployed `hello.ts` Function:

- `DATABASE_URL` — Neon PostgreSQL connection string for the Function.
- `NEON_AUTH_BASE_URL` — branch Auth URL used as the JWT issuer.
- `NEON_AUTH_JWKS_URL` — branch JWKS endpoint used to verify JWT signatures.
- `APP_ALLOWED_ORIGINS` — comma-separated production frontend origins.

The Function allows localhost origins for development. Production origins must
be explicitly listed.

### Local database tools

Set `DATABASE_URL_UNPOOLED` in `.env.local` only for database migrations or
checks. It should use a separate migration-owner credential, not the
application's runtime credential. This is private; never use a `VITE_` prefix.

## Least-privilege database credentials

Use two database roles:

1. A migration-owner role, kept out of the Function environment and used only
   for reviewed schema migrations.
2. A restricted `kam_fleets_api` login role for the deployed Function. It must
   not be a superuser, database/role creator, or schema owner.

Create `kam_fleets_api` in Neon with a unique password, then apply migrations
using the migration-owner URL. Migration `0008_api_rate_limits.sql` grants
that role only the table access the Function requires, including read-only
access to `neon_auth."user"` for matching signed-in identities. Set the
Function's `DATABASE_URL` to the restricted role's pooled connection string;
keep the migration-owner URL only in a trusted local environment.

If migration 0008 was applied before the role existed, connect as the database
owner and rerun its role grants after creating the role. Do not copy a
production connection string into this repository.

## Local development

1. Copy `.env.example` to `.env.local` and set the two browser URLs.
2. Install dependencies with `npm ci`.
3. Start the frontend using `npm run dev`.
4. Sign in while online. The browser then caches previously loaded data for
   offline use.

The frontend talks to the deployed Neon Function; `npm run dev` does not start
the database API locally.

## Database migrations

Before changing a database, confirm the `DATABASE_URL_UNPOOLED` target. Then
run:

```bash
npm run db:migrate
```

The runner applies ordered files once and tracks checksums in
`schema_migrations`. Do not edit an already-applied migration; add a new
numbered migration. See [`DATABASE_ARCHITECTURE.md`](./DATABASE_ARCHITECTURE.md)
for the current model and migration history. Apply migration 0008 before
deploying a Function build that enforces the database-backed API limits.

## API rate limits

The authenticated Function uses PostgreSQL-backed fixed one-minute windows
per verified account: up to 120 read requests and 30 write requests per
minute. Excess requests receive HTTP 429 with `Retry-After` and standard
rate-limit headers. Health checks and requests rejected before identity
verification are not covered by this per-account limit; configure additional
edge/provider protection if those endpoints need volumetric abuse controls.

## GitHub Pages

The workflow in [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml)
builds the static frontend on pushes to `main`. Configure
`VITE_NEON_AUTH_URL` and `VITE_NEON_FUNCTION_HELLO_BASE_URL` in the repository
or Pages environment's Actions variables. The workflow accepts them as secrets
too, but they are public URLs and are exposed in the compiled site.

The Neon Function must be deployed separately and its allowed origins must
include the Pages site origin. The Function should receive its database and
JWT verification settings through server-side Neon environment variables.

## Offline behavior

The service worker caches the app shell and same-origin assets. After an online
sign-in, the app can restore a same-tab cached workspace after reload while
offline for up to seven days since its last successful online membership
check, and keep edits in a local queue. Once the seven-day grace expires, the
app clears that user's cached profile and workspace data and requires a
connection before access resumes. When connectivity returns, the app
revalidates membership; a suspended, revoked, or expired session is signed out
and its local workspace cache is cleared. Pending changes are retried only
while access remains active. Offline use cannot learn about a revocation until
the app reconnects.

## Never expose

Do not put `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_API_KEY`,
`NEON_AUTH_JWKS_URL`, or any signing credential in frontend code, GitHub Pages
build variables, or any `VITE_` variable. Keep `.env.local` private and
untracked.

## Legacy development server

The legacy server with unauthenticated snapshot/change endpoints and
permissive CORS has been removed, along with its package script. The frontend
uses the authenticated Neon Function instead.

## Content Security Policy

Production builds emit a restrictive HTML Content Security Policy. Its
`connect-src` is generated from the configured Neon Auth and Function URL
origins; scripts are restricted to same-origin files, and inline scripts are
not allowed. Inline styles remain enabled because the UI uses React style
attributes, and Google Fonts are explicitly allowed. GitHub Pages does not
support custom response headers, so header-only protections such as
`frame-ancestors` and HSTS still require a hosting provider or proxy that can
set HTTP headers.
