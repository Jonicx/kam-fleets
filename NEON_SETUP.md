# Neon setup

The app uses the `production` branch of project `damp-scene-49503629` for PostgreSQL, Neon Auth, and Neon Functions. The AI Gateway is not enabled because the project is on Neon Free.

## Data and authentication

- Neon Auth protects the app with email/password sign-in and signup.
- The `hello` Neon Function verifies each request's Neon Auth JWT against the branch JWKS before reading or writing that user's snapshot.
- Fleet records are stored in `app_user_state` as one JSONB snapshot per authenticated user. Neon Postgres is the source of truth; browser localStorage is a per-user cache.
- The app shell and all built JavaScript/CSS chunks are precached for offline startup. Previously loaded team data is available offline and edits are queued locally until Neon is reachable again; authentication and syncing still require a network connection.
- Existing local demo data is imported into the first account that connects. Subsequent accounts receive their own sample dataset.
- The function exposes `/health` for a PostgreSQL connectivity check and `/snapshot` for authenticated snapshot reads/writes.

## Local development

`neon deploy` pulls branch values into `.env.local`. Keep that file private and out of version control. It must contain the Neon-provided database and auth values plus:

- `VITE_NEON_AUTH_URL` — copied from `NEON_AUTH_BASE_URL`; public browser configuration.
- `VITE_NEON_FUNCTION_HELLO_BASE_URL` — copied from `NEON_FUNCTION_HELLO_BASE_URL`; public Function URL.
- `APP_ALLOWED_ORIGINS` — production origin and local app origins used by the Function's CORS policy.

Run `npm run db:migrate` to create the snapshot table using `DATABASE_URL_UNPOOLED`, then start the frontend with `npm run dev`. The Function uses its injected `DATABASE_URL`, `NEON_AUTH_BASE_URL`, and `NEON_AUTH_JWKS_URL`.

For the GitHub Pages workflow, add Actions variables named `VITE_NEON_AUTH_URL` and `VITE_NEON_FUNCTION_HELLO_BASE_URL` with the corresponding public URLs. The workflow also accepts those names as Actions secrets, but these `VITE_` values are compiled into the public frontend and are not confidential. The build fails with a clear error if either is missing. Never expose `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_API_KEY`, or auth signing credentials to frontend code.
