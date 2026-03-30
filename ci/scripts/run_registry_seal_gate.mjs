import fs from "node:fs";
import path from "node:path";

const TOKEN = {
  STRUCTURE: "CI_REGISTRY_SEAL_LIFECYCLE_STRUCTURE_INVALID",
  ILLEGAL_TRANSITION: "CI_REGISTRY_SEAL_LIFECYCLE_ILLEGAL_TRANSITION",
  MISSING_SEALED_ARTEFACT: "CI_REGISTRY_SEAL_LIFECYCLE_SEALED_MISSING_ARTEFACT"
};

const STATES = new Set(["pre_seal", "sealed"]);
const LIFECYCLE_PATH = path.resolve("ci/evidence/registry_seal_lifecycle.v1.json");
const REQUIRED_SEALED_ARTEFACTS = [
  "ci/evidence/registry_seal_manifest.v1.json",
  "ci/evidence/registry_seal_live_surface.v1.json",
  "ci/evidence/registry_seal.v1.json"
];

function fail(token, details, extras = {}) {
  process.stderr.write(`${JSON.stringify({ ok: false, token, details, ...extras }, null, 2)}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const out = { transitionTo: null };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg.startsWith("--transition-to=")) {
      const value = arg.slice("--transition-to=".length);
      if (!value) {
        fail(
          TOKEN.STRUCTURE,
          "Flag '--transition-to' requires a state value."
        );
      }
      out.transitionTo = value;
      continue;
    }

    if (arg === "--transition-to") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) {
        fail(
          TOKEN.STRUCTURE,
          "Flag '--transition-to' requires a state value."
        );
      }
      out.transitionTo = value;
      i += 1;
      continue;
    }

    fail(
      TOKEN.STRUCTURE,
      `Unknown argument '${arg}'.`
    );
  }

  return out;
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

  const seen = new Set();

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
    if (seen.has(pair)) {
      fail(TOKEN.STRUCTURE, `Duplicate lifecycle transition '${pair}'.`, { path: basePath });
    }
    seen.add(pair);
  }

  const requiredPair = "pre_seal->sealed";
  if (!seen.has(requiredPair)) {
    fail(TOKEN.STRUCTURE, "Lifecycle must include the only lawful transition 'pre_seal->sealed'.");
  }

  if (seen.size !== 1) {
    fail(TOKEN.STRUCTURE, "Lifecycle must declare only one lawful transition: 'pre_seal->sealed'.");
  }

  return {
    currentState: doc.current_state,
    allowedPairs: seen
  };
}

function assertSealedArtefactsPresent() {
  for (const relPath of REQUIRED_SEALED_ARTEFACTS) {
    const resolved = path.resolve(relPath);
    if (!fs.existsSync(resolved)) {
      fail(
        TOKEN.MISSING_SEALED_ARTEFACT,
        `Sealed lifecycle requires artefact '${relPath}'.`,
        { artefact_path: relPath }
      );
    }
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const lifecycleDoc = readJson(LIFECYCLE_PATH, "registry seal lifecycle");
  const lifecycle = validateLifecycle(lifecycleDoc);

  if (args.transitionTo !== null) {
    if (!STATES.has(args.transitionTo)) {
      fail(
        TOKEN.ILLEGAL_TRANSITION,
        `Requested transition target '${args.transitionTo}' is not a legal lifecycle state.`,
        {
          current_state: lifecycle.currentState,
          requested_state: args.transitionTo
        }
      );
    }

    const pair = `${lifecycle.currentState}->${args.transitionTo}`;
    if (!lifecycle.allowedPairs.has(pair)) {
      fail(
        TOKEN.ILLEGAL_TRANSITION,
        `Illegal registry seal lifecycle transition '${pair}'. Only 'pre_seal->sealed' is lawful.`,
        {
          current_state: lifecycle.currentState,
          requested_state: args.transitionTo
        }
      );
    }

    process.stdout.write(`${JSON.stringify({
      ok: true,
      mode: lifecycle.currentState,
      transition_requested: args.transitionTo,
      transition_legal: true
    }, null, 2)}\n`);
    return;
  }

  if (lifecycle.currentState === "sealed") {
    assertSealedArtefactsPresent();
    process.stdout.write(`${JSON.stringify({
      ok: true,
      mode: "sealed",
      enforced: true,
      reason: "registry seal lifecycle is sealed"
    }, null, 2)}\n`);
    return;
  }

  process.stdout.write(`${JSON.stringify({
    ok: true,
    mode: "pre_seal",
    enforced: false,
    reason: "registry seal lifecycle is explicitly pre_seal"
  }, null, 2)}\n`);
}

main();