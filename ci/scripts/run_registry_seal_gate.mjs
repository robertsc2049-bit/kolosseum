import fs from "node:fs";
import { spawnSync } from "node:child_process";

const sealPath = "ci/evidence/registry_seal.v1.json";

function fail(message) {
  console.error(message);
  process.exit(1);
}

function main() {
  if (!fs.existsSync(sealPath)) {
    fail("Missing registry seal artefact");
  }

  const seal = JSON.parse(fs.readFileSync(sealPath, "utf8"));

  if (seal.bundle_hash === "UNSEALED") {
    process.stdout.write(JSON.stringify({
      ok: true,
      mode: "pre_seal",
      enforced: false,
      reason: "registry seal is unsealed"
    }, null, 2) + "\n");
    return;
  }

  const snapshotRun = spawnSync("node", ["ci/scripts/run_registry_snapshot_hash.mjs"], {
    encoding: "utf8"
  });

  if (snapshotRun.status !== 0) {
    process.stderr.write(snapshotRun.stderr || "Registry snapshot failed\n");
    process.exit(snapshotRun.status ?? 1);
  }

  const verifyRun = spawnSync(
    "node",
    ["ci/scripts/run_registry_seal_verifier.mjs"],
    {
      input: snapshotRun.stdout,
      encoding: "utf8"
    }
  );

  if (verifyRun.status !== 0) {
    process.stderr.write(verifyRun.stderr || "Registry seal verification failed\n");
    process.exit(verifyRun.status ?? 1);
  }

  process.stdout.write(JSON.stringify({
    ok: true,
    mode: "sealed",
    enforced: true
  }, null, 2) + "\n");
}

main();