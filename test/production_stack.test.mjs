// The production stack (docker-compose.prod.yml, docs/ops/IONOS_VPS_DEPLOYMENT.md):
// behind Caddy every request comes from the proxy, so the app must trust
// exactly one hop or every beta user shares one per-IP rate-limit bucket;
// only Caddy is published to the internet; and every setting a server needs
// is passed through from .env.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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
  assert.match(fs.readFileSync("deploy/Caddyfile", "utf8"), /\{\$KOLOSSEUM_DOMAIN\} \{[\s\S]*reverse_proxy app:3000/u);
});

// Runs deploy/backup.sh once with stand-in pg_dump and tar: "ok" writes a
// dump, "fail" exits with an error, "empty" exits cleanly but writes nothing.
function runBackupOnce(pgDump) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kolosseum-backup-"));
  const bin = path.join(dir, "bin");
  const backups = path.join(dir, "backups");
  const statusDir = path.join(dir, "status");
  fs.mkdirSync(bin);
  fs.mkdirSync(backups);
  fs.mkdirSync(statusDir);
  const stub = (name, body) => fs.writeFileSync(path.join(bin, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  stub("pg_dump", `for a in "$@"; do case "$a" in --file=*) f="\${a#--file=}" ;; esac; done
case "$STUB_PG" in ok) echo dump > "$f" ;; empty) : > "$f" ;; *) echo "connection refused" >&2; exit 1 ;; esac`);
  stub("tar", `echo archive > "$2"`);
  const result = spawnSync("sh", ["deploy/backup.sh", "once"], {
    encoding: "utf8",
    env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, STUB_PG: pgDump, BACKUP_DIR: backups, UPLOADS_DIR: dir, STATUS_DIR: statusDir, DATABASE_URL: "postgres://stub" }
  });
  const files = fs.readdirSync(backups).sort();
  const statusFiles = fs.readdirSync(statusDir).sort();
  fs.rmSync(dir, { recursive: true, force: true });
  return { status: result.status, stderr: result.stderr, files, statusFiles };
}

test("a backup that fails leaves no half-written file behind, and says it failed", { skip: spawnSync("sh", ["-c", "exit 0"]).status !== 0 && "no sh" }, () => {
  const ok = runBackupOnce("ok");
  assert.equal(ok.status, 0);
  assert.deepEqual(ok.files.map((f) => f.replace(/\d{8}T\d{6}Z/u, "<stamp>")), ["db_<stamp>.dump", "uploads_<stamp>.tar.gz"]);
  assert.deepEqual(ok.statusFiles, ["backup_last_ok"], "the app is told it worked");
  for (const outcome of ["fail", "empty"]) {
    const failed = runBackupOnce(outcome);
    assert.notEqual(failed.status, 0, outcome);
    assert.deepEqual(failed.files, [], `${outcome}: nothing for the restore check or the off-server copy to pick up`);
    assert.match(failed.stderr, /FAILED: the database dump didn't complete/u);
    assert.deepEqual(failed.statusFiles, ["backup_last_failed"], `${outcome}: the app is told it failed`);
  }
  assert.match(fs.readFileSync("deploy/backup.sh", "utf8"), /trying again in 10 minutes/u);
});

// Runs deploy/offsite.sh once with a stand-in rclone whose "copy" fails when
// told to.
function runOffsiteOnce(copyFails, extraEnv = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kolosseum-offsite-"));
  const bin = path.join(dir, "bin");
  const statusDir = path.join(dir, "status");
  fs.mkdirSync(bin);
  fs.mkdirSync(statusDir);
  fs.writeFileSync(path.join(bin, "rclone"), [
    "#!/bin/sh",
    "case \"$1\" in",
    "  copy) if [ \"$STUB_COPY\" = fail ]; then echo AccessDenied >&2; exit 1; fi ;;",
    "  lsf) echo db_x.dump ;;",
    "  obscure) echo obscured-$2 ;;",
    "esac",
    "echo \"rclone $* secure=${RCLONE_CONFIG_SECURE_REMOTE:-none} pass=${RCLONE_CONFIG_SECURE_PASSWORD:-none}\" >> \"$STUB_LOG\"",
    "exit 0",
    ""
  ].join("\n"), { mode: 0o755 });
  const result = spawnSync("sh", ["deploy/offsite.sh", "once"], {
    encoding: "utf8",
    env: {
      ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, STUB_COPY: copyFails ? "fail" : "ok", BACKUP_DIR: dir, STATUS_DIR: statusDir,
      STUB_LOG: path.join(dir, "calls.log"), OFFSITE_BACKUP_PASSPHRASE: "",
      OFFSITE_BACKUP_BUCKET: "b", RCLONE_CONFIG_OFFSITE_ACCESS_KEY_ID: "k", RCLONE_CONFIG_OFFSITE_SECRET_ACCESS_KEY: "s", ...extraEnv
    }
  });
  const statusFiles = fs.readdirSync(statusDir).sort();
  const encrypted = fs.existsSync(path.join(statusDir, "offsite_encrypted")) ? fs.readFileSync(path.join(statusDir, "offsite_encrypted"), "utf8").trim() : null;
  const calls = fs.existsSync(path.join(dir, "calls.log")) ? fs.readFileSync(path.join(dir, "calls.log"), "utf8").trim().split("\n") : [];
  fs.rmSync(dir, { recursive: true, force: true });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr, statusFiles, encrypted, calls };
}

test("a failed off-server copy is reported as failed, never as done", { skip: spawnSync("sh", ["-c", "exit 0"]).status !== 0 && "no sh" }, () => {
  const ok = runOffsiteOnce(false);
  assert.equal(ok.status, 0);
  assert.match(ok.stdout, /offsite copy done .*: 1 files stored off the server/u);
  assert.deepEqual(ok.statusFiles, ["offsite_encrypted", "offsite_last_ok", "offsite_state"]);
  const failed = runOffsiteOnce(true);
  assert.notEqual(failed.status, 0);
  assert.doesNotMatch(failed.stdout, /offsite copy done/u);
  assert.match(failed.stderr, /offsite copy FAILED/u);
  assert.deepEqual(failed.statusFiles, ["offsite_encrypted", "offsite_last_failed", "offsite_state"]);
});

test("with a passphrase, backups are encrypted before they leave the server, and the old plain copies age out", { skip: spawnSync("sh", ["-c", "exit 0"]).status !== 0 && "no sh" }, () => {
  const plain = runOffsiteOnce(false);
  assert.equal(plain.encrypted, "off");
  assert.match(plain.stderr, /NOT encrypted - set OFFSITE_BACKUP_PASSPHRASE/u);
  assert.ok(plain.calls.some((call) => call.startsWith("rclone copy") && call.includes("offsite:b/kolosseum ")), "no passphrase: the plain copy as before");

  const secure = runOffsiteOnce(false, { OFFSITE_BACKUP_PASSPHRASE: "correct horse battery staple" });
  assert.equal(secure.status, 0);
  assert.equal(secure.encrypted, "on");
  const copy = secure.calls.find((call) => call.startsWith("rclone copy"));
  assert.match(copy, / secure: /u, "copied through the crypt remote");
  assert.match(copy, /secure=offsite:b\/kolosseum-encrypted pass=obscured-correct horse battery staple/u, "the passphrase is obscured for rclone, never passed as a flag");
  assert.ok(secure.calls.some((call) => /^rclone delete offsite:b\/kolosseum --min-age 14d/u.test(call)), "unencrypted copies from before still age out");
  assert.doesNotMatch(secure.stderr, /NOT encrypted/u);

  const short = runOffsiteOnce(false, { OFFSITE_BACKUP_PASSPHRASE: "too short" });
  assert.notEqual(short.status, 0, "a weak passphrase stops the copy");
  assert.match(short.stderr, /at least 20 characters/u);
  assert.ok(!short.calls.some((call) => call.startsWith("rclone copy")), "nothing is copied unencrypted instead");
});

test("the app reads the backup status the backup services write, read-only", () => {
  assert.match(service("app"), /kolosseum-status:\/status:ro/u);
  assert.match(service("app"), /KOLOSSEUM_BACKUP_STATUS_DIR: \/status\n/u);
  assert.match(service("backup"), /kolosseum-status:\/status\n/u);
  assert.match(service("offsite"), /kolosseum-status:\/status\n/u);
});

test("backups are copied off the server once a bucket is set, and the newest one can be test-restored", () => {
  const offsite = service("offsite");
  assert.match(offsite, /image: rclone\/rclone:\d+\.\d+\.\d+\n/u, "a pinned rclone version");
  assert.match(offsite, /kolosseum-backups:\/backups:ro/u, "it only reads the backups");
  assert.match(offsite, /RCLONE_CONFIG_OFFSITE_PROVIDER: \$\{OFFSITE_BACKUP_PROVIDER:-IONOS\}/u);
  assert.match(offsite, /OFFSITE_BACKUP_PASSPHRASE: \$\{OFFSITE_BACKUP_PASSPHRASE:-\}/u, "the passphrase reaches the offsite service");
  assert.match(offsite, /RCLONE_CONFIG_OFFSITE_ENDPOINT: \$\{OFFSITE_BACKUP_ENDPOINT:-s3-eu-central-1\.ionoscloud\.com\}/u);
  const script = fs.readFileSync("deploy/offsite.sh", "utf8");
  assert.match(script, /OFFSITE_BACKUP_BUCKET:-\}" \] && \[ -n "\$\{RCLONE_CONFIG_OFFSITE_ACCESS_KEY_ID/u, "off until the bucket and key are set");
  assert.match(script, /--min-age 10m/u, "a dump still being written waits");
  assert.match(script, /rclone delete "\$REMOTE" --min-age "\$\{KEEP_DAYS\}d"/u);
  assert.match(service("backup"), /\.\/deploy\/restore-check\.sh:\/restore-check\.sh:ro/u);
  const check = fs.readFileSync("deploy/restore-check.sh", "utf8");
  assert.match(check, /pg_restore --no-owner --exit-on-error -d "\$check_url"/u);
  assert.match(check, /trap cleanup EXIT/u, "the throwaway copy is always dropped");
  for (const drop of check.matchAll(/DROP DATABASE[^;"]*/gu)) assert.equal(drop[0], "DROP DATABASE IF EXISTS $CHECK_DB", "only the throwaway copy is ever dropped");
  assert.match(check, /CHECK_DB="kolosseum_restore_check"/u);
});
