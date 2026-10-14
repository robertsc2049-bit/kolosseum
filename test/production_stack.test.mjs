// The production stack (docker-compose.prod.yml, docs/ops/IONOS_VPS_DEPLOYMENT.md):
// behind Caddy every request comes from the proxy, so the app must trust
// exactly one hop or every beta user shares one per-IP rate-limit bucket;
// only Caddy is published to the internet; and every setting a server needs
// is passed through from .env.
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { trustProxySetting } from "../dist/src/trust_proxy.js";

const compose = fs.readFileSync("docker-compose.prod.yml", "utf8");
const envExample = fs.readFileSync("deploy/env.production.example", "utf8");

function service(name) {
  const match = compose.match(new RegExp(`\\n  ${name}:\\n([\\s\\S]*?)(?=\\n  [a-z]+:\\n|\\nvolumes:)`, "u"));
  assert.ok(match, `service ${name}`);
  return match[1];
}

test("the app trusts only the configured number of proxy hops, and none by default", () => {
  assert.equal(trustProxySetting(undefined), false);
  assert.equal(trustProxySetting(""), false);
  assert.equal(trustProxySetting("1"), 1);
  assert.equal(trustProxySetting(" 2 "), 2);
  for (const bad of ["0", "-1", "true", "1.5", "99", "loopback"]) assert.equal(trustProxySetting(bad), false, bad);
});

test("only Caddy is published; the app trusts its one hop and the database password is required", () => {
  assert.match(service("app"), /KOLOSSEUM_TRUST_PROXY: 1\n/u);
  assert.doesNotMatch(service("app"), /\n    ports:/u, "the app is reachable only through Caddy");
  assert.doesNotMatch(service("db"), /\n    ports:/u, "the database is never published");
  assert.match(service("caddy"), /"443:443"/u);
  assert.match(service("db"), /POSTGRES_PASSWORD: \$\{POSTGRES_PASSWORD:\?/u);
  assert.doesNotMatch(compose, /postgres:postgres@/u, "no default database password");
});

test("every setting in the production .env template reaches the container that uses it", () => {
  const names = [...envExample.matchAll(/^([A-Z0-9_]+)=/gmu)].map((m) => m[1]);
  assert.ok(names.length >= 15);
  for (const name of names) {
    if (name === "POSTGRES_PASSWORD") continue; // used inside DATABASE_URL and by db
    assert.match(compose, new RegExp(`\\$\\{${name}(:[-?][^}]*)?\\}`, "u"), `${name} is passed through`);
  }
});

test("nightly backups dump the database and the uploads, and Caddy serves the configured domain", () => {
  const backup = service("backup");
  assert.match(backup, /kolosseum-uploads:\/uploads:ro/u);
  assert.match(backup, /kolosseum-backups:\/backups/u);
  const script = fs.readFileSync("deploy/backup.sh", "utf8");
  assert.match(script, /pg_dump --format=custom/u);
  assert.match(script, /tar -czf "\/backups\/uploads_/u);
  assert.match(fs.readFileSync("deploy/Caddyfile", "utf8"), /\{\$KOLOSSEUM_DOMAIN\} \{[\s\S]*reverse_proxy app:3000/u);
});
