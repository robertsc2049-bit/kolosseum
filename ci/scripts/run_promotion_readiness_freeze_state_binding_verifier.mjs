import fs from "node:fs";
import path from "node:path";

const TOKEN = "CI_PROMOTION_READINESS_FREEZE_STATE_INVALID";
const DEFAULT_READINESS_PATH = "docs/releases/V1_PROMOTION_READINESS.json";
const DEFAULT_FREEZE_STATE_PATH = "docs/releases/V1_FREEZE_STATE.json";

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

function verifyPromotionReadinessFreezeStateBinding({
  readinessPath,
  freezeStatePath,
}) {
  const readiness = readJson(readinessPath);
  if (readiness.__read_error__) {
    return fail(readiness.__read_error__, { path: normalizePath(readinessPath) });
  }

  if (!isPlainObject(readiness)) {
    return fail(
      "Promotion readiness artefact must be a JSON object.",
      {
        path: normalizePath(readinessPath),
      }
    );
  }

  const freezeState = readJson(freezeStatePath);
  if (freezeState.__read_error__) {
    return fail(freezeState.__read_error__, { path: normalizePath(freezeStatePath) });
  }

  if (!isPlainObject(freezeState)) {
    return fail(
      "Freeze state artefact must be a JSON object.",
      {
        path: normalizePath(freezeStatePath),
      }
    );
  }

  const freezeDeclared = freezeState.freeze_declared;
  if (freezeDeclared !== true) {
    return fail(
      "Promotion readiness requires freeze_declared=true in V1_FREEZE_STATE.json.",
      {
        path: normalizePath(freezeStatePath),
        field: "freeze_declared",
      }
    );
  }

  const freezeStateValue = String(freezeState.freeze_state ?? "").trim().toLowerCase();
  if (freezeStateValue !== "sealed") {
    return fail(
      `Promotion readiness requires freeze_state 'sealed', received '${freezeStateValue}'.`,
      {
        path: normalizePath(freezeStatePath),
        field: "freeze_state",
      }
    );
  }

  const declaredBy = String(freezeState.freeze_state_declared_by ?? "").trim();
  if (!declaredBy) {
    return fail(
      "Promotion readiness requires non-empty freeze_state_declared_by in V1_FREEZE_STATE.json.",
      {
        path: normalizePath(freezeStatePath),
        field: "freeze_state_declared_by",
      }
    );
  }

  return ok({
    readiness_path: normalizePath(readinessPath),
    freeze_state_path: normalizePath(freezeStatePath),
    freeze_state: freezeStateValue,
    freeze_declared: true,
    freeze_state_declared_by: declaredBy,
  });
}

function main() {
  const args = process.argv.slice(2);

  if (args.length > 2) {
    process.stderr.write(
      JSON.stringify(
        fail(
          "Usage: node ci/scripts/run_promotion_readiness_freeze_state_binding_verifier.mjs [readinessPath] [freezeStatePath]"
        ),
        null,
        2
      ) + "\n"
    );
    process.exit(1);
  }

  const readinessPath = path.resolve(args[0] ?? DEFAULT_READINESS_PATH);
  const freezeStatePath = path.resolve(args[1] ?? DEFAULT_FREEZE_STATE_PATH);

  const result = verifyPromotionReadinessFreezeStateBinding({
    readinessPath,
    freezeStatePath,
  });

  const target = result.ok ? process.stdout : process.stderr;
  target.write(JSON.stringify(result, null, 2) + "\n");
  process.exit(result.ok ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  DEFAULT_FREEZE_STATE_PATH,
  DEFAULT_READINESS_PATH,
  verifyPromotionReadinessFreezeStateBinding,
};