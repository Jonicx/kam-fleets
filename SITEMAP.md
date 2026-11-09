# KAM Fleets application sitemap

KAM Fleets is a single-page application. These screens are selected inside the
app; they are not separate URL routes. The deployed app currently uses the
`/kam-fleets/` base path.

## Sign-in

- Sign in
- Create an account
- Request a password-reset code and choose a new password
- Pending account approval
- Offline workspace restoration, when the same tab has a saved session

## Main workspace

| Screen | Where it appears | Access |
|---|---|---|
| Operations dashboard | Operations in the main navigation (Dispatcher); Admin home button (Admin) | Admin, Dispatcher |
| Trips | Main navigation | Admin, Dispatcher |
| Expenses & Services | Main navigation | Admin, Dispatcher |
| Truck Fleet | More menu | Admin, Dispatcher |
| Drivers | More menu | Admin, Dispatcher |
| Clients | More menu | Admin, Dispatcher; Dispatcher can add/edit, Admin can also delete |
| Admin dashboard | Admin in the main navigation | Admin |
| Schema Studio | Internal view exists, but its dashboard entry point is currently commented out; not reachable from the normal UI | No current navigation entry |

### Admin dashboard sections

- **Overview** — financial summary, report period, trip performance, and trends.
- **Billing** — invoices, payments, voids, and reversals.
- **Trip costs** — trip cost and budget review.
- **Review** — audit history and review/data-quality tools.
- **Team access** — administrator-only membership and role management.

### Operations dashboard

- Current trips, fleet and driver availability, budgets, and costs.
- Trip details and trip updates.
- Create and dispatch a trip.
- The Schema Studio entry-point button is presently commented out.

## Shared dialogs and workflows

- Create/edit trip; update an active trip; inspect trip details; start or
  complete a trip.
- Add/edit trip expense or spare-part/repair records.
- Register/edit trucks, drivers, and clients.
- Add/edit truck service records and inspect service history.
- Create invoices and payments; confirm invoice voids and payment reversals.
- Inspect audit details and edit the signed-in user's profile.
- Confirm destructive actions where available.

## Global controls

- Profile menu: profile settings and sign out.
- More: Truck Fleet, Drivers, and Clients.
- Offline/sync status: indicates saved local data and pending synchronization.

## Not public routes

The Neon Function API is separate from the page sitemap. Its current endpoint
map is documented in [`DATABASE_ARCHITECTURE.md`](./DATABASE_ARCHITECTURE.md).
