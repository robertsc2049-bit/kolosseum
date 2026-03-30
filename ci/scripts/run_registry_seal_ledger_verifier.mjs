import fs from "node:fs";
import path from "node:path";

const TOKEN = {
  DUPLICATE: "CI_REGISTRY_SEAL_LEDGER_DUPLICATE",
  MUTATION: "CI_REGISTRY_SEAL_LEDGER_MUTATION",
  ORDER: "CI_REGISTRY_SEAL_LEDGER_ORDER",
  STRUCTURE: "CI_REGISTRY_STRUCTURE_INVALID"
};

function fail(token, details, extras = {}) {
  process.stderr.write(`${JSON.stringify({ ok: false, token, details, ...extras }, null, 2)}\n`);
  process.exit(1);
}

function readJson(filePath, label) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    fail(TOKEN.STRUCTURE, `Unable to read ${label} at '${filePath}': ${error.message}`);
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    fail(TOKEN.STRUCTURE, `Invalid JSON in ${label} at '${filePath}': ${error.message}`);
  }
}

function validateLedgerShape(ledger) {
  if (!ledger || typeof ledger !== "object" || Array.isArray(ledger)) {
    fail(TOKEN.STRUCTURE, "Ledger must be a JSON object.");
  }

  const requiredTop = ["schema_version", "ledger_id", "ledger_version", "seal_scope", "entries"];
  const allowedTop = new Set(requiredTop);

  for (const key of requiredTop) {
    if (!(key in ledger)) {
      fail(TOKEN.STRUCTURE, `Ledger missing required field '${key}'.`, { path: key });
    }
  }

  for (const key of Object.keys(ledger)) {
    if (!allowedTop.has(key)) {
      fail(TOKEN.STRUCTURE, `Ledger contains unknown field '${key}'.`, { path: key });
    }
  }

  if (ledger.schema_version !== "kolosseum.registry_seal_ledger.v1") {
    fail(TOKEN.STRUCTURE, "schema_version must equal 'kolosseum.registry_seal_ledger.v1'.", { path: "schema_version" });
  }

  if (ledger.seal_scope !== "registry_bundle") {
    fail(TOKEN.STRUCTURE, "seal_scope must equal 'registry_bundle'.", { path: "seal_scope" });
  }

  if (typeof ledger.ledger_id !== "string" || ledger.ledger_id.length === 0) {
    fail(TOKEN.STRUCTURE, "ledger_id must be a non-empty string.", { path: "ledger_id" });
  }

  if (typeof ledger.ledger_version !== "string" || ledger.ledger_version.length === 0) {
    fail(TOKEN.STRUCTURE, "ledger_version must be a non-empty string.", { path: "ledger_version" });
  }

  if (!Array.isArray(ledger.entries)) {
    fail(TOKEN.STRUCTURE, "entries must be an array.", { path: "entries" });
  }

  const entryRequired = ["seal_id", "seal_version", "registry_bundle_hash", "recorded_at"];
  const entryAllowed = new Set(entryRequired);
  const sha256Regex = /^[a-f0-9]{64}$/;

  for (let i = 0; i < ledger.entries.length; i += 1) {
    const entry = ledger.entries[i];
    const basePath = `entries[${i}]`;

    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      fail(TOKEN.STRUCTURE, "entry must be a JSON object.", { path: basePath });
    }

    for (const key of entryRequired) {
      if (!(key in entry)) {
        fail(TOKEN.STRUCTURE, `Entry missing required field '${key}'.`, { path: `${basePath}.${key}` });
      }
    }

    for (const key of Object.keys(entry)) {
      if (!entryAllowed.has(key)) {
        fail(TOKEN.STRUCTURE, `Entry contains unknown field '${key}'.`, { path: `${basePath}.${key}` });
      }
    }

    if (typeof entry.seal_id !== "string" || entry.seal_id.length === 0) {
      fail(TOKEN.STRUCTURE, "seal_id must be a non-empty string.", { path: `${basePath}.seal_id` });
    }

    if (typeof entry.seal_version !== "string" || entry.seal_version.length === 0) {
      fail(TOKEN.STRUCTURE, "seal_version must be a non-empty string.", { path: `${basePath}.seal_version` });
    }

    if (typeof entry.registry_bundle_hash !== "string" || !sha256Regex.test(entry.registry_bundle_hash)) {
      fail(TOKEN.STRUCTURE, "registry_bundle_hash must be lowercase sha256 hex.", { path: `${basePath}.registry_bundle_hash` });
    }

    if (typeof entry.recorded_at !== "string" || Number.isNaN(Date.parse(entry.recorded_at))) {
      fail(TOKEN.STRUCTURE, "recorded_at must be a valid ISO date-time string.", { path: `${basePath}.recorded_at` });
    }
  }
}

function main() {
  const ledgerPath = path.resolve("ci/evidence/registry_seal_ledger.v1.json");
  const snapshotPath = path.resolve("ci/evidence/registry_seal_ledger.snapshot.json");

  const ledger = readJson(ledgerPath, "ledger");
  validateLedgerShape(ledger);

  const seen = new Set();

  for (const entry of ledger.entries) {
    const key = `${entry.seal_id}::${entry.seal_version}`;
    if (seen.has(key)) {
      fail(TOKEN.DUPLICATE, `Duplicate seal identity '${key}'.`);
    }
    seen.add(key);
  }

  if (fs.existsSync(snapshotPath)) {
    const prev = readJson(snapshotPath, "ledger snapshot");
    validateLedgerShape(prev);

    const minLen = Math.min(prev.entries.length, ledger.entries.length);

    for (let i = 0; i < minLen; i += 1) {
      const a = JSON.stringify(prev.entries[i]);
      const b = JSON.stringify(ledger.entries[i]);

      if (a !== b) {
        fail(TOKEN.MUTATION, `Historical ledger entry changed at index ${i}.`);
      }
    }

    if (ledger.entries.length < prev.entries.length) {
      fail(TOKEN.ORDER, "Ledger removed historical entries.");
    }
  }

  process.stdout.write(`${JSON.stringify({ ok: true }, null, 2)}\n`);
}

main();