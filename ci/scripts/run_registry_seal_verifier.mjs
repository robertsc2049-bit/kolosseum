import fs from "node:fs";

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function main() {
  const sealPath = "ci/evidence/registry_seal.v1.json";

  if (!fs.existsSync(sealPath)) {
    fail("Missing registry seal artefact");
  }

  const seal = JSON.parse(fs.readFileSync(sealPath, "utf8"));

  if (seal.bundle_hash === "UNSEALED") {
    fail("Registry not sealed");
  }

  const snapshot = JSON.parse(fs.readFileSync(0, "utf8"));

  if (!snapshot.ok) {
    fail("Snapshot generation failed");
  }

  if (snapshot.bundle_hash !== seal.bundle_hash) {
    fail("REGISTRY DRIFT DETECTED");
  }

  console.log("OK: registry seal verified");
}

main();