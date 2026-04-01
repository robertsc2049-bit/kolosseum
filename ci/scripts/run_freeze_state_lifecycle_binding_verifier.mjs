import fs from "node:fs";
import path from "node:path";

const TOKEN = "CI_FREEZE_STATE_LIFECYCLE_BINDING_INVALID";
const DEFAULT_FREEZE_STATE_PATH = "docs/releases/V1_FREEZE_STATE.json";
const DEFAULT_LIFECYCLE_PATH = "docs/releases/V1_REGISTRY_SEAL_LIFECYCLE.md";

const ALLOWED_STATES = new Set(["pre_seal", "sealed"]);
const ORDER = {
  pre_seal: 0,
  sealed: 1,
};

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

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { __read_error__: `Failed to read text at ${filePath}: ${message}` };
  }
}

function extractLifecycleState(text) {
  const normalized = String(text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const patterns = [
    /"mode"\s*:\s*"(?<state>pre_seal|sealed)"/i,
    /"state"\s*:\s*"(?<state>pre_seal|sealed)"/i,
    /\bmode\s*:\s*(?<state>pre_seal|sealed)\b/i,
    /\bstate\s*:\s*(?<state>pre_seal|sealed)\b/i,
    /\bseal lifecycle(?: state)?\s*[:=-]\s*(?<state>pre_seal|sealed)\b/i,
    /\bregistry seal lifecycle(?: state)?\s*[:=-]\s*(?<state>pre_seal|sealed)\b/i,
    /\bseal lifecycle is (?<state>pre_seal|sealed)\b/i,
    /\bregistry seal lifecycle is (?<state>pre_seal|sealed)\b/i,
    /\bcurrent lifecycle state\s*[:=-]\s*(?<state>pre_seal|sealed)\b/i,
    /\bactive lifecycle state\s*[:=-]\s*(?<state>pre_seal|sealed)\b/i
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match?.groups?.state) {
      return String(match.groups.state).trim().toLowerCase();
    }
  }

  return null;
}

function verifyFreezeStateLifecycleBinding({
  freezeStatePath,
  lifecyclePath,
}) {
  const freezeState = readJson(freezeStatePath);
  if (freezeState.__read_error__) {
    return fail(freezeState.__read_error__, { path: normalizePath(freezeStatePath) });
  }

  const lifecycleText = readText(lifecyclePath);
  if (lifecycleText.__read_error__) {
    return fail(lifecycleText.__read_error__, { path: normalizePath(lifecyclePath) });
  }

  const declaredFreezeState = String(freezeState.freeze_state ?? "").trim().toLowerCase();
  if (!ALLOWED_STATES.has(declaredFreezeState)) {
    return fail(
      `Freeze state declaration contains unknown freeze_state '${declaredFreezeState}'.`,
      {
        path: normalizePath(freezeStatePath),
        field: "freeze_state",
      }
    );
  }

  const lifecycleState = extractLifecycleState(lifecycleText);
  if (!lifecycleState || !ALLOWED_STATES.has(lifecycleState)) {
    return fail(
      "Could not resolve a valid lifecycle state from the registry seal lifecycle artefact.",
      {
        path: normalizePath(lifecyclePath),
      }
    );
  }

  if (declaredFreezeState !== lifecycleState) {
    return fail(
      `Freeze state '${declaredFreezeState}' contradicts lifecycle state '${lifecycleState}'.`,
      {
        freeze_state_path: normalizePath(freezeStatePath),
        lifecycle_path: normalizePath(lifecyclePath),
        declared_freeze_state: declaredFreezeState,
        lifecycle_state: lifecycleState,
      }
    );
  }

  const previousFreezeState = String(freezeState.previous_freeze_state ?? "").trim().toLowerCase();
  if (previousFreezeState) {
    if (!ALLOWED_STATES.has(previousFreezeState)) {
      return fail(
        `Freeze state declaration previous_freeze_state '${previousFreezeState}' is unknown.`,
        {
          path: normalizePath(freezeStatePath),
          field: "previous_freeze_state",
        }
      );
    }

    if (ORDER[declaredFreezeState] < ORDER[previousFreezeState]) {
      return fail(
        `Freeze state reverse transition is illegal: '${previousFreezeState}' -> '${declaredFreezeState}'.`,
        {
          freeze_state_path: normalizePath(freezeStatePath),
          previous_freeze_state: previousFreezeState,
          declared_freeze_state: declaredFreezeState,
        }
      );
    }
  }

  return ok({
    freeze_state_path: normalizePath(freezeStatePath),
    lifecycle_path: normalizePath(lifecyclePath),
    freeze_state: declaredFreezeState,
    lifecycle_state: lifecycleState,
  });
}

function main() {
  const args = process.argv.slice(2);

  if (args.length > 2) {
    process.stderr.write(
      JSON.stringify(
        fail(
          "Usage: node ci/scripts/run_freeze_state_lifecycle_binding_verifier.mjs [freezeStatePath] [lifecyclePath]"
        ),
        null,
        2
      ) + "\n"
    );
    process.exit(1);
  }

  const freezeStatePath = path.resolve(args[0] ?? DEFAULT_FREEZE_STATE_PATH);
  const lifecyclePath = path.resolve(args[1] ?? DEFAULT_LIFECYCLE_PATH);

  const result = verifyFreezeStateLifecycleBinding({
    freezeStatePath,
    lifecyclePath,
  });

  const target = result.ok ? process.stdout : process.stderr;
  target.write(JSON.stringify(result, null, 2) + "\n");
  process.exit(result.ok ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  verifyFreezeStateLifecycleBinding,
  extractLifecycleState,
};