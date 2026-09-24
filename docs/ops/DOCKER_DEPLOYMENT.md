# Docker deployment

Platform-agnostic local/self-hosted deployment via `Dockerfile` +
`docker-compose.yml`. This works on any host that runs containers (a laptop,
a VM, a self-managed server) - it does not commit to one hosting vendor.

## First run

```bash
docker compose up -d --build
```

This builds the app image (compiling the server and the React app) and
starts Postgres alongside it. The app container will not start listening
until the database's healthcheck passes.

Apply the schema once the stack is up:

```bash
docker compose exec app node scripts/apply-schema.mjs
```

Create the first founder/admin account (there is deliberately no HTTP route
that can do this - see `scripts/bootstrap_admin_account.mjs`'s own header):

```bash
docker compose exec -e ADMIN_BOOTSTRAP_TOKEN=<any-non-empty-value-you-choose> app \
  node scripts/bootstrap_admin_account.mjs --email founder@example.com --name "Founder Name" --password "at-least-16-characters"
```

Confirm the app is alive:

```bash
curl http://localhost:3000/health
```

## Configuration

`docker-compose.yml` passes these through from the host environment (all
optional, matching `.env.example`): `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `KOLOSSEUM_CONTROLLED_LAUNCH_PLAN_ID`,
`KOLOSSEUM_CONTROLLED_LAUNCH_PRICE_ID`,
`KOLOSSEUM_CONTROLLED_LAUNCH_SEAT_LIMIT`, `KOLOSSEUM_PUBLIC_APP_URL`. Set
them in a `.env` file next to `docker-compose.yml` (Docker Compose reads it
automatically) or export them in the shell before `docker compose up`.

`HOST` and `PORT` are set by `docker-compose.yml` itself
(`HOST=0.0.0.0`, `PORT=3000`) and should not normally be overridden - the
app's default (`src/main.ts`) is loopback-only, which only matters for
bare-metal/local-dev, not for this containerised path.

`DATABASE_URL` is wired by `docker-compose.yml` to the `db` service and does
not need to be set manually.

## Stopping / data

```bash
docker compose down       # stop, keep the database volume
docker compose down -v    # stop and delete the database volume
```

## Not decided here

This lets the app run under Docker on any container host. It does not
choose a specific cloud provider, managed database, TLS/reverse-proxy
setup, or backup schedule for a production deployment - those remain
operator decisions outside this repository.
