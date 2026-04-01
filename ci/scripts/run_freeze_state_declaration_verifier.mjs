import fs from "node:fs";
import path from "node:path";

const TOKEN = "CI_FREEZE_STATE_DECLARATION_INVALID";
const DEFAULT_STATE_PATH = "docs/releases/V1_FREEZE_STATE.json";
const ALLOWED_STATES = new Set(["pre_seal", "sealed"]);

function fail(details, extra = {}) {
  return {
    ok: false,
    failures: [
      {
        token: TOKEN,
        details,
        ...extra,
      },
    ],
  };
}

function ok(meta = {}) {
  return { ok: true, ...meta };
}

function normalizePath(value) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .trim();
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { __read_error__: `Failed to read JSON at ${filePath}: ${message}` };
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function verifyFreezeStateDeclaration({ statePath }) {
  const doc = readJson(statePath);
  if (doc.__read_error__) {
    return fail(doc.__read_error__, { path: normalizePath(statePath) });
  }

  if (!isPlainObject(doc)) {
    return fail(
      "Freeze state declaration must be a JSON object.",
      { path: normalizePath(statePath) }
    );
  }

  const requiredKeys = [
    "schema_version",
    "freeze_state",
    "freeze_declared",
    "freeze_state_declared_by",
  ];

  for (const key of requiredKeys) {
    if (!(key in doc)) {
      return fail(
        `Freeze state declaration is missing required field '${key}'.`,
        {
          path: normalizePath(statePath),
          field: key,
        }
      );
    }
  }

  const allowedKeys = new Set([
    "schema_version",
    "freeze_state",
    "freeze_declared",
    "freeze_state_declared_by",
    "notes",
  ]);

  for (const key of Object.keys(doc)) {
    if (!allowedKeys.has(key)) {
      return fail(
        `Freeze state declaration contains unknown field '${key}'.`,
        {
          path: normalizePath(statePath),
          field: key,
        }
      );
    }
  }

  if (doc.schema_version !== "kolosseum.freeze_state_declaration.v1") {
    return fail(
      `Freeze state declaration schema_version must equal 'kolosseum.freeze_state_declaration.v1'.`,
      {
        path: normalizePath(statePath),
        field: "schema_version",
      }
    );
  }

  if (doc.freeze_declared !== true) {
    return fail(
      "Freeze state declaration freeze_declared must be true.",
      {
        path: normalizePath(statePath),
        field: "freeze_declared",
      }
    );
  }

  const freezeState = String(doc.freeze_state ?? "").trim();
  if (!ALLOWED_STATES.has(freezeState)) {
    return fail(
      `Freeze state declaration freeze_state '${freezeState}' is unknown. Allowed: ${[...ALLOWED_STATES].join(", ")}.`,
      {
        path: normalizePath(statePath),
        field: "freeze_state",
      }
    );
  }

  const declaredBy = String(doc.freeze_state_declared_by ?? "").trim();
  if (!declaredBy) {
    return fail(
      "Freeze state declaration freeze_state_declared_by must be a non-empty string.",
      {
        path: normalizePath(statePath),
        field: "freeze_state_declared_by",
      }
    );
  }

  if ("notes" in doc && doc.notes !== null && typeof doc.notes !== "string") {
    return fail(
      "Freeze state declaration notes must be a string or null.",
      {
        path: normalizePath(statePath),
        field: "notes",
      }
    );
  }

  return ok({
    state_path: normalizePath(statePath),
    freeze_state: freezeState,
    freeze_declared: true,
    declared_by: declaredBy,
  });
}

function main() {
  const args = process.argv.slice(2);

  if (args.length > 1) {
    process.stderr.write(
      JSON.stringify(
        fail("Usage: node ci/scripts/run_freeze_state_declaration_verifier.mjs [freezeStatePath]"),
        null,
        2
      ) + "\n"
    );
    process.exit(1);
  }

  const statePath = path.resolve(args[0] ?? DEFAULT_STATE_PATH);
  const result = verifyFreezeStateDeclaration({ statePath });
  const target = result.ok ? process.stdout : process.stderr;
  target.write(JSON.stringify(result, null, 2) + "\n");
  process.exit(result.ok ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  ALLOWED_STATES,
  DEFAULT_STATE_PATH,
  verifyFreezeStateDeclaration,
};