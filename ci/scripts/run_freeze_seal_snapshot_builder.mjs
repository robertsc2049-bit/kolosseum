import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const ENGINE_COMPATIBILITY = "EB2-1.0.0";

export const DEFAULT_REQUIRED_COMPONENTS = Object.freeze({
  proof_index: "docs/releases/V1_FREEZE_PROOF_INDEX.json",
  readiness: "docs/releases/V1_FREEZE_READINESS.json",
  drift: "docs/releases/V1_FREEZE_DRIFT_STATUS.json",
  mainline_guard: "docs/releases/V1_FREEZE_MAINLINE_GUARD_STATE.json"
});

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function stableStringify(value) {
  if (value === null) {
    return "null";
  }

  if (value === true) {
    return "true";
  }

  if (value === false) {
    return "false";
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Non-finite numbers are not permitted in canonical JSON.");
    }
    return JSON.stringify(value);
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return "[" + value.map((entry) => stableStringify(entry)).join(",") + "]";
  }

  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort();
    return "{" + keys.map((key) => JSON.stringify(key) + ":" + stableStringify(value[key])).join(",") + "}";
  }

  throw new Error(`Unsupported canonical JSON value type: ${typeof value}`);
}

function fail(token, component, details, pathValue = null) {
  const failure = {
    token,
    component,
    details
  };

  if (pathValue !== null) {
    failure.path = pathValue;
  }

  return {
    ok: false,
    failures: [failure]
  };
}

function normalizeComponentMap(componentPaths) {
  const normalized = {};
  const seenPaths = new Map();

  for (const [component, rawPath] of Object.entries(componentPaths)) {
    if (typeof rawPath !== "string" || rawPath.trim().length === 0) {
      return fail("CI_MANIFEST_MISMATCH", component, "Required component path must be a non-empty string.");
    }

    const normalizedPath = path.normalize(rawPath);
    if (seenPaths.has(normalizedPath)) {
      return fail(
        "CI_MANIFEST_MISMATCH",
        component,
        `Duplicate required-component mapping detected for '${normalizedPath}'.`,
        normalizedPath
      );
    }

    seenPaths.set(normalizedPath, component);
    normalized[component] = normalizedPath;
  }

  return {
    ok: true,
    componentPaths: normalized
  };
}

function readRequiredJson(component, filePath) {
  if (!fs.existsSync(filePath)) {
    return fail("CI_MANIFEST_MISMATCH", component, "Required freeze component is missing.", filePath);
  }

  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    return fail("CI_MANIFEST_MISMATCH", component, `Unable to read required freeze component: ${error.message}`, filePath);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return fail("CI_MANIFEST_MISMATCH", component, `Required freeze component contains invalid JSON: ${error.message}`, filePath);
  }

  if (!isPlainObject(parsed)) {
    return fail("CI_MANIFEST_MISMATCH", component, "Required freeze component must be a JSON object.", filePath);
  }

  if (parsed.engine_compatibility !== ENGINE_COMPATIBILITY) {
    return fail(
      "version_mismatch",
      component,
      `Component engine_compatibility must be '${ENGINE_COMPATIBILITY}'.`,
      filePath
    );
  }

  if (component === "proof_index" && !Array.isArray(parsed.entries)) {
    return fail("CI_MANIFEST_MISMATCH", component, "Proof index must contain an 'entries' array.", filePath);
  }

  if (component !== "proof_index" && typeof parsed.ok !== "boolean") {
    return fail("CI_MANIFEST_MISMATCH", component, "Required freeze component must expose boolean 'ok'.", filePath);
  }

  return {
    ok: true,
    parsed,
    canonicalBytes: Buffer.from(stableStringify(parsed), "utf8")
  };
}

export function buildFreezeSealSnapshot({
  componentPaths = DEFAULT_REQUIRED_COMPONENTS,
  generatedAtUtc,
  outputPath = null
} = {}) {
  if (typeof generatedAtUtc !== "string" || generatedAtUtc.trim().length === 0) {
    return fail("CI_MANIFEST_MISMATCH", "snapshot", "generatedAtUtc is required.");
  }

  const iso8601UtcPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
  if (!iso8601UtcPattern.test(generatedAtUtc)) {
    return fail("invalid_format", "snapshot", "generatedAtUtc must be UTC ISO-8601 in the form YYYY-MM-DDTHH:MM:SSZ.");
  }

  const normalizedMapResult = normalizeComponentMap(componentPaths);
  if (!normalizedMapResult.ok) {
    return normalizedMapResult;
  }

  const normalizedMap = normalizedMapResult.componentPaths;
  const requiredComponentNames = ["proof_index", "readiness", "drift", "mainline_guard"];

  for (const component of requiredComponentNames) {
    if (!(component in normalizedMap)) {
      return fail("CI_MANIFEST_MISMATCH", component, "Missing required component mapping.");
    }
  }

  const components = {};
  for (const component of requiredComponentNames) {
    const componentResult = readRequiredJson(component, normalizedMap[component]);
    if (!componentResult.ok) {
      return componentResult;
    }
    components[component] = componentResult;
  }

  const snapshot = {
    completeness: {
      all_present: true,
      required_components: requiredComponentNames
    },
    engine_compatibility: ENGINE_COMPATIBILITY,
    freeze_state: {
      drift: {
        ok: components.drift.parsed.ok,
        path: normalizedMap.drift,
        sha256: sha256Hex(components.drift.canonicalBytes)
      },
      mainline_guard: {
        ok: components.mainline_guard.parsed.ok,
        path: normalizedMap.mainline_guard,
        sha256: sha256Hex(components.mainline_guard.canonicalBytes)
      },
      proof_index: {
        path: normalizedMap.proof_index,
        sha256: sha256Hex(components.proof_index.canonicalBytes)
      },
      readiness: {
        ok: components.readiness.parsed.ok,
        path: normalizedMap.readiness,
        sha256: sha256Hex(components.readiness.canonicalBytes)
      }
    },
    generated_at_utc: generatedAtUtc,
    snapshot_id: "v1_freeze_seal_snapshot",
    snapshot_version: "1.0.0"
  };

  const allowedTopLevelKeys = [
    "completeness",
    "engine_compatibility",
    "freeze_state",
    "generated_at_utc",
    "snapshot_id",
    "snapshot_version"
  ];

  const actualTopLevelKeys = Object.keys(snapshot).sort();
  const expectedTopLevelKeys = [...allowedTopLevelKeys].sort();

  if (JSON.stringify(actualTopLevelKeys) !== JSON.stringify(expectedTopLevelKeys)) {
    return fail("CI_MANIFEST_MISMATCH", "snapshot", "Snapshot top-level key set drifted.");
  }

  const canonicalJson = stableStringify(snapshot);
  const canonicalBytes = Buffer.from(canonicalJson, "utf8");
  const snapshotSha256 = sha256Hex(canonicalBytes);

  if (outputPath !== null) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, canonicalBytes);
  }

  return {
    ok: true,
    output: snapshot,
    output_bytes: canonicalBytes,
    output_sha256: snapshotSha256
  };
}

function parseArgs(argv) {
  const args = {
    componentPaths: { ...DEFAULT_REQUIRED_COMPONENTS },
    generatedAtUtc: null,
    outputPath: null
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === "--generated-at") {
      args.generatedAtUtc = next;
      index += 1;
      continue;
    }

    if (token === "--out") {
      args.outputPath = next;
      index += 1;
      continue;
    }

    if (token === "--proof-index") {
      args.componentPaths.proof_index = next;
      index += 1;
      continue;
    }

    if (token === "--readiness") {
      args.componentPaths.readiness = next;
      index += 1;
      continue;
    }

    if (token === "--drift") {
      args.componentPaths.drift = next;
      index += 1;
      continue;
    }

    if (token === "--mainline-guard") {
      args.componentPaths.mainline_guard = next;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  return args;
}

export function runCli(argv = process.argv) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    const report = fail("CI_MANIFEST_MISMATCH", "cli", error.message);
    process.stderr.write(JSON.stringify(report, null, 2) + "\n");
    return 1;
  }

  const result = buildFreezeSealSnapshot({
    componentPaths: args.componentPaths,
    generatedAtUtc: args.generatedAtUtc,
    outputPath: args.outputPath
  });

  if (!result.ok) {
    process.stderr.write(JSON.stringify(result, null, 2) + "\n");
    return 1;
  }

  process.stdout.write(JSON.stringify({
    ok: true,
    output_path: args.outputPath,
    output_sha256: result.output_sha256
  }, null, 2) + "\n");

  return 0;
}

const invokedAsEntrypoint = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (invokedAsEntrypoint) {
  process.exit(runCli(process.argv));
}