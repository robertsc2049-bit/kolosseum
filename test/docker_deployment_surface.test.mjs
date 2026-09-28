// DEV NOTE: structural surface proof for the Docker deployment path
// (Dockerfile, docker-compose.yml, .dockerignore, src/main.ts's HOST
// support, .env.example, docs/ops/DOCKER_DEPLOYMENT.md). The Dockerfile
// itself was verified by an actual `docker build` + `docker compose up` run
// against a real Postgres container - see the PR that introduced this file
// for the transcript - which isn't repeated here as an automated test
// because it needs a Docker daemon this repo's CI runners don't provide.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";
import yaml from "js-yaml";

const dockerfile = readFileSync("Dockerfile", "utf8");
const compose = yaml.load(readFileSync("docker-compose.yml", "utf8"));
const dockerignore = readFileSync(".dockerignore", "utf8");
const mainSource = readFileSync("src/main.ts", "utf8");
const envExample = readFileSync(".env.example", "utf8");

test("the Dockerfile builds the app and the React bundle, then runs the compiled entrypoint", () => {
  assert.match(dockerfile, /FROM node:25\.9\.0-slim AS build/u);
  assert.match(dockerfile, /RUN npm run build/u);
  assert.match(dockerfile, /FROM node:25\.9\.0-slim AS runtime/u);
  assert.match(dockerfile, /RUN npm ci --omit=dev/u);
  assert.match(dockerfile, /EXPOSE 3000/u);
  assert.match(dockerfile, /CMD \["node", "dist\/src\/main\.js"\]/u);
});

test("the compose file wires the app to a real Postgres service with HOST=0.0.0.0", () => {
  assert.ok(compose.services.db, "expected a db service");
  assert.match(compose.services.db.image, /^postgres:/u);
  assert.ok(compose.services.app, "expected an app service");
  assert.equal(compose.services.app.build, ".");
  assert.equal(compose.services.app.environment.HOST, "0.0.0.0");
  assert.match(compose.services.app.environment.DATABASE_URL, /@db:5432\//u);
  assert.deepEqual(compose.services.app.depends_on.db.condition, "service_healthy");
});

test("main.ts's server binds to a configurable HOST, defaulting to loopback-only", () => {
  assert.match(mainSource, /function getHost\(\): string \{/u);
  assert.match(mainSource, /const raw = process\.env\.HOST;/u);
  assert.match(mainSource, /return "127\.0\.0\.1";/u);
  assert.match(mainSource, /app\.listen\(port, host,/u);
});

test(".dockerignore excludes node_modules and the generated build outputs", () => {
  assert.match(dockerignore, /^node_modules$/mu);
  assert.match(dockerignore, /^dist$/mu);
});

test(".env.example documents the optional HOST override", () => {
  assert.match(envExample, /^HOST=$/mu);
});

test("a Docker deployment doc exists and documents the schema-apply and admin-bootstrap steps", () => {
  assert.ok(existsSync("docs/ops/DOCKER_DEPLOYMENT.md"));
  const doc = readFileSync("docs/ops/DOCKER_DEPLOYMENT.md", "utf8");
  assert.match(doc, /docker compose exec app node scripts\/apply-schema\.mjs/u);
  assert.match(doc, /docker compose exec -e ADMIN_BOOTSTRAP_TOKEN=.* app \\\s*\n\s*node scripts\/bootstrap_admin_account\.mjs/u);
});

test("the runtime image carries every file the server reads from disk, so a container can compile a session", () => {
  // Found live: without these, sign-up worked but every session compile,
  // exercise choice, max and coach starter programme returned 500.
  assert.match(dockerfile, /^COPY registries \.\/registries$/mu, "engine registry bundle and exercise/equipment registries");
  assert.match(dockerfile, /^COPY ci\/schemas \.\/ci\/schemas$/mu, "phase1 input schema the engine validates against");
  assert.match(dockerfile, /vanilla_minimal\.json/u, "default plan-session input");
});

test("uploads live on a named volume, so photos, videos and attachments survive a redeploy", () => {
  assert.ok(compose.services.app.volumes.includes("kolosseum-uploads:/app/var"));
  assert.ok(Object.prototype.hasOwnProperty.call(compose.volumes, "kolosseum-uploads"));
});
