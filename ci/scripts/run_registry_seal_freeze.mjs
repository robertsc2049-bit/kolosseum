import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const TOKEN = {
  STRUCTURE: "CI_REGISTRY_SEAL_FREEZE_STRUCTURE_INVALID",
  POSTWRITE_VERIFY_FAILED: "CI_REGISTRY_SEAL_FREEZE_POSTWRITE_VERIFY_FAILED"
};

const STATES = new Set(["pre_seal", "sealed"]);
const LIFECYCLE_PATH = path.resolve("ci/evidence/registry_seal_lifecycle.v1.json");
const DEFAULT_GATE_PATH = path.resolve("ci/scripts/run_registry_seal_gate.mjs");
const GATE_PATH = process.env.KOLOSSEUM_REGISTRY_SEAL_GATE_PATH
  ? path.resolve(process.env.KOLOSSEUM_REGISTRY_SEAL_GATE_PATH)
  : DEFAULT_GATE_PATH;

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

function validateLifecycle(doc) {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    fail(TOKEN.STRUCTURE, "Lifecycle artefact must be a JSON object.");
  }

  const required = [
    "schema_version",
    "lifecycle_id",
    "lifecycle_version",
    "current_state",
    "allowed_transitions"
  ];
  const allowed = new Set(required);

  for (const key of required) {
    if (!(key in doc)) {
      fail(TOKEN.STRUCTURE, `Lifecycle artefact missing required field '${key}'.`, { path: key });
    }
  }

  for (const key of Object.keys(doc)) {
    if (!allowed.has(key)) {
      fail(TOKEN.STRUCTURE, `Lifecycle artefact contains unknown field '${key}'.`, { path: key });
    }
  }

  if (doc.schema_version !== "kolosseum.registry_seal_lifecycle.v1") {
    fail(TOKEN.STRUCTURE, "Lifecycle schema_version mismatch.", { path: "schema_version" });
  }

  if (typeof doc.lifecycle_id !== "string" || doc.lifecycle_id.length === 0) {
    fail(TOKEN.STRUCTURE, "Lifecycle lifecycle_id must be a non-empty string.", { path: "lifecycle_id" });
  }

  if (typeof doc.lifecycle_version !== "string" || doc.lifecycle_version.length === 0) {
    fail(TOKEN.STRUCTURE, "Lifecycle lifecycle_version must be a non-empty string.", { path: "lifecycle_version" });
  }

  if (!STATES.has(doc.current_state)) {
    fail(TOKEN.STRUCTURE, `Lifecycle current_state '${doc.current_state}' is invalid.`, { path: "current_state" });
  }

  if (!Array.isArray(doc.allowed_transitions) || doc.allowed_transitions.length === 0) {
    fail(TOKEN.STRUCTURE, "Lifecycle allowed_transitions must be a non-empty array.", { path: "allowed_transitions" });
  }

  const pairs = new Set();

  for (let i = 0; i < doc.allowed_transitions.length; i += 1) {
    const entry = doc.allowed_transitions[i];
    const basePath = `allowed_transitions[${i}]`;

    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      fail(TOKEN.STRUCTURE, "Lifecycle transition entry must be a JSON object.", { path: basePath });
    }

    const keys = Object.keys(entry);
    if (keys.length !== 2 || !keys.includes("from") || !keys.includes("to")) {
      fail(TOKEN.STRUCTURE, "Lifecycle transition entry must contain only 'from' and 'to'.", { path: basePath });
    }

    if (!STATES.has(entry.from)) {
      fail(TOKEN.STRUCTURE, `Lifecycle transition 'from' state '${entry.from}' is invalid.`, { path: `${basePath}.from` });
    }

    if (!STATES.has(entry.to)) {
      fail(TOKEN.STRUCTURE, `Lifecycle transition 'to' state '${entry.to}' is invalid.`, { path: `${basePath}.to` });
    }

    const pair = `${entry.from}->${entry.to}`;
    if (pairs.has(pair)) {
      fail(TOKEN.STRUCTURE, `Duplicate lifecycle transition '${pair}'.`, { path: basePath });
    }
    pairs.add(pair);
  }

  if (pairs.size !== 1 || !pairs.has("pre_seal->sealed")) {
    fail(TOKEN.STRUCTURE, "Lifecycle must declare only one lawful transition: 'pre_seal->sealed'.");
  }

  return doc;
}

function stableStringify(value) {
  if (value === null) {
    return "null";
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const keys = Object.keys(value);
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function writeLifecycle(doc) {
  const ordered = {
    schema_version: doc.schema_version,
    lifecycle_id: doc.lifecycle_id,
    lifecycle_version: doc.lifecycle_version,
    current_state: doc.current_state,
    allowed_transitions: doc.allowed_transitions.map((entry) => ({
      from: entry.from,
      to: entry.to
    }))
  };

  const canonical = `${stableStringify(ordered)}\n`;
  fs.writeFileSync(LIFECYCLE_PATH, canonical, "utf8");
  return canonical;
}

function verifySealedPostWrite() {
  if (!fs.existsSync(GATE_PATH)) {
    fail(
      TOKEN.POSTWRITE_VERIFY_FAILED,
      `Registry seal gate script does not exist at '${GATE_PATH}'.`,
      {
        gate_path: GATE_PATH
      }
    );
  }

  const result = spawnSync(process.execPath, [GATE_PATH], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env
  });

  if (result.status !== 0) {
    fail(
      TOKEN.POSTWRITE_VERIFY_FAILED,
      "Registry seal gate failed immediately after freeze write.",
      {
        gate_path: GATE_PATH,
        gate_stderr: result.stderr.trim()
      }
    );
  }

  let payload;
  try {
    payload = JSON.parse(result.stdout);
  } catch (error) {
    fail(
      TOKEN.POSTWRITE_VERIFY_FAILED,
      `Registry seal gate returned invalid JSON after freeze write: ${error.message}`,
      {
        gate_path: GATE_PATH
      }
    );
  }

  if (payload.mode !== "sealed" || payload.enforced !== true) {
    fail(
      TOKEN.POSTWRITE_VERIFY_FAILED,
      "Registry seal gate did not report sealed enforced state after freeze write.",
      {
        gate_path: GATE_PATH,
        gate_payload: payload
      }
    );
  }

  return payload;
}

function main() {
  const lifecycle = validateLifecycle(readJson(LIFECYCLE_PATH, "registry seal lifecycle"));

  if (lifecycle.current_state === "sealed") {
    const gatePayload = verifySealedPostWrite();
    process.stdout.write(`${JSON.stringify({
      ok: true,
      action: "no_op",
      lifecycle_path: "ci/evidence/registry_seal_lifecycle.v1.json",
      current_state: "sealed",
      verified_mode: gatePayload.mode,
      verified_enforced: gatePayload.enforced
    }, null, 2)}\n`);
    return;
  }

  lifecycle.current_state = "sealed";
  const written = writeLifecycle(lifecycle);
  const gatePayload = verifySealedPostWrite();

  process.stdout.write(`${JSON.stringify({
    ok: true,
    action: "activated",
    lifecycle_path: "ci/evidence/registry_seal_lifecycle.v1.json",
    current_state: "sealed",
    bytes_written: Buffer.byteLength(written, "utf8"),
    verified_mode: gatePayload.mode,
    verified_enforced: gatePayload.enforced
  }, null, 2)}\n`);
}

main();