<p align="center">
  <img src="./public/brand-logo-light.png" alt="KAM Fleets logo" width="220">
</p>

<p align="center">
  A shared workspace for keeping a transport fleet, its trips, and trip costs organized.
</p>

## What is KAM Fleets?

Imagine a company has lots of trucks going to different places. KAM Fleets is
like a shared digital notebook that helps the team remember which truck is
going where, who is driving it, and what happens along the way.

The team can plan trips, record delays and repairs, track costs, manage
customers, and—when authorized—handle invoices and payments. Everyone who is
allowed to use the workspace can see the same saved fleet records.

## What it can do

- Keep track of trucks, drivers, and customer contacts.
- Plan trips, assign vehicles and drivers, and follow trip progress.
- Record delays, expenses, roadside parts, and scheduled truck services.
- Review fleet activity and operating costs on dashboards.
- Let administrators manage billing, audit history, and team access.
- Work with previously saved data while offline, then queue changes to sync
  when the connection returns.
- Install as a Progressive Web App (PWA) on supported devices.

### Team roles

- **Admin** — manages the workspace, billing, team access, and operational
  records.
- **Dispatcher** — manages operations and can add or edit client records.
  Client deletion and other restricted actions remain administrator-only.



## Useful commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Vite development server. |
| `npm run lint` | Type-check the TypeScript project. |
| `npm test` | Run the automated tests. |
| `npm run build` | Create the production app in `dist/`. |
| `npm run db:migrate` | Apply pending SQL migrations using `DATABASE_URL_UNPOOLED`. Review the target database before running. |
| `npm run db:check` | Check database connectivity using the configured database URL. |

## Project map

- [`src/App.tsx`](./src/App.tsx) — application views and top-level flows.
- [`src/components/`](./src/components/) — dashboards, forms, and modals.
- [`src/db/domain.ts`](./src/db/domain.ts) — business rules and validation.
- [`src/db/store.ts`](./src/db/store.ts) — local persistence and cloud sync.
- [`src/neon.ts`](./src/neon.ts) — browser auth and Function client.
- [`hello.ts`](./hello.ts) — authenticated Neon Function API.
- [`server/teamData.ts`](./server/teamData.ts) — relational PostgreSQL reads and writes.
- [`migrations/`](./migrations/) — authoritative, ordered database migrations.
- [`public/sw.js`](./public/sw.js) — offline app-shell caching.
- [`DATABASE_ARCHITECTURE.md`](./DATABASE_ARCHITECTURE.md) — current database and sync model.
- [`SITEMAP.md`](./SITEMAP.md) — app navigation and screen map.

## Offline behavior and limits

After signing in while online, the app keeps a local copy of previously loaded
workspace data. If the network drops, it can open that data and keep changes
in a local queue. A same-tab reload can restore the cached workspace session.
When the network returns, queued changes are sent to the server.

Offline access is a convenience, not a way to prove that an account is still
active: the app cannot learn about a revoked or suspended account until it
reconnects. The cache belongs to that browser/device, may be cleared, and
should not be trusted as the official record.

## Deploying

The GitHub Actions workflow in
[`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) builds and
publishes the static app to GitHub Pages when changes are pushed to `main`.
Configure `VITE_NEON_AUTH_URL` and `VITE_NEON_FUNCTION_HELLO_BASE_URL` as
repository or environment variables in GitHub Actions. These `VITE_` values
are included in the public frontend build; they are URLs, not secret keys.

The Neon Function and database are configured separately. Follow
[`NEON_SETUP.md`](./NEON_SETUP.md), and never place database connection strings,
Neon API keys, or signing secrets in a `VITE_` variable.

## Security notes

The authenticated Function—not the navigation menu—must enforce identity,
membership, and role permissions. The production Function verifies Neon Auth
JWTs and uses the SQL migrations' constraints and triggers for important data
rules. Authenticated API requests are limited per account, and the production
build includes a Content Security Policy tied to the configured Neon
endpoints. Use a separate, restricted database role for the Function and keep
migration credentials out of its environment.

The app allows offline workspace access for up to seven days since the last
successful online membership check. On reconnection it checks membership
again and clears local workspace data if access has been revoked. GitHub Pages
cannot set HTTP security headers, so protections such as `frame-ancestors`
need a header-capable host or proxy. See [`NEON_SETUP.md`](./NEON_SETUP.md) and
the architecture guide for deployment details.

## License

No license file is currently included. Ask the repository owner before
redistributing or reusing this project.
