<!-- DEV NOTE: Operations documentation surface. This document stitches together already-existing, already-working scripts and env config into one linear first-run walkthrough. It creates no new capability, no new guard, and no new engine/registry/commercial authority - every command referenced here already exists and is already covered by its own tests. -->

# V1 Production Setup

Surface: docs/ops
Owner: Operations boundary

## Purpose

This is the linear walkthrough for taking a fresh Postgres database and an empty deploy target to a usable, sign-in-able Kolosseum v1 instance. It does not introduce any new script or capability - it only records the order to run what already exists.

This document does not cover *where* to host the app (see the "Deployment target" note below - that is a genuine infrastructure decision, not something this doc can make for you). It covers everything after you have a Postgres database and a place that can run `node`.

## 1. Environment configuration

Copy `.env.example` to `.env` and fill in every value. As of this writing that is:

- `DATABASE_URL` - your Postgres connection string.
- `PORT` - the port the server listens on (defaults to `3000` if unset).
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` - required for the commercial/billing path (`src/api/product_commercial_service.ts`, `src/api/product_commercial_webhook.routes.ts`). Use Stripe test-mode keys for a non-production trial run.
- `KOLOSSEUM_CONTROLLED_LAUNCH_PLAN_ID` / `_PRICE_ID` / `_SEAT_LIMIT` / `KOLOSSEUM_PUBLIC_APP_URL` - controlled-launch checkout config the same commercial path reads.

Everything the server reads from `process.env` is either listed above or optional with a safe default (`KOLOSSEUM_ENABLE_DIAGNOSTIC_UI`, the non-Stripe commercial provider overrides, the canonical-hash-override internal token) - there is nothing else required to add.

## 2. Database schema

Apply the schema to your target database:

```
node scripts/apply-schema.mjs
```

This runs every `CREATE TABLE IF NOT EXISTS` / migration block in `schema.sql` against `DATABASE_URL`. It is idempotent - safe to re-run against an already-provisioned database when `schema.sql` changes.

## 3. First founder/admin account

There is deliberately no HTTP route that can create a founder/admin account - it must be created by an operator running a script directly against the database, gated behind an explicit token:

```
ADMIN_BOOTSTRAP_TOKEN=<any-non-empty-value-you-choose> \
node scripts/bootstrap_admin_account.mjs --email founder@example.com --name "Founder Name" --password "at-least-16-characters"
```

See `scripts/bootstrap_admin_account.mjs`'s own header comment for the exact contract. Re-running it for the same email fails closed (`An admin account already exists for ...`) rather than silently creating a duplicate.

## 4. Build and start

```
npm run build
npm run start
```

`npm run build` compiles TypeScript, checks the engine shim, and builds the React bundle. `npm run start` runs the compiled server (`dist/src/main.js`), loading `.env` if present. The server listens on `127.0.0.1:<PORT>` (`src/main.ts`).

## 5. Confirm it's alive

- `GET /health` - unauthenticated, does not touch the database. Used by CI and deploy health probes.
- `GET /status` - unauthenticated, public factual status surface (S-V1-O-01, `docs/v1/V1_STATUS_PAGE.md`). Reports `service_state`/component facts only - no external monitoring call, no reliability guarantee.

At this point you can register a coach/athlete account through `/app`, sign in to `/org` as an organisation owner, or sign in to `/admin` with the founder/admin account created in step 3.

## Deployment target

This document deliberately stops at "a place that can run `node` with a reachable Postgres database." There is no Dockerfile, platform config (Render/Fly/Heroku/etc.), or CI/CD deploy job in this repository as of this writing - choosing and provisioning a host is a real infrastructure decision for an operator to make, not something a checklist can decide. Once a target is chosen, this document's steps 1-4 are what needs to run there.

## Related surfaces

- `docs/ops/V1_RUNBOOK.md` - the daily controlled-launch operating checklist, once the instance above is live.
- `docs/ops/V1_BACKUP_RESTORE_TEST.md` / `scripts/backup-restore-dry-run.mjs` - the backup/restore dry-run contract and script.
- `docs/v1/V1_STATUS_PAGE.md` - the status surface referenced in step 5.
- `docs/v1/V1_ERROR_REPORTING_INITIALISATION.md` - the local, provider-less error-reporting contract wired into the server at startup.
