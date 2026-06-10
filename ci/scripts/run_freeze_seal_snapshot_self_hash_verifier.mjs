import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const SNAPSHOT_PATH = "docs/releases/V1_FREEZE_SEAL_SNAPSHOT.json";
export const HASH_FIELD = "self_hash_sha256";
export const ENGINE_COMPATIBILITY = "EB2-1.0.0";

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

function fail(token, details, pathValue = null) {
  const failure = { token, details };
  if (pathValue !== null) {
    failure.path = pathValue;
  }
  return {
    ok: false,
    failures: [failure]
  };
}

const ALLOWED_TOP_LEVEL_KEYS = Object.freeze([
  "completeness",
  "engine_compatibility",
  "freeze_state",
  "generated_at_utc",
  HASH_FIELD,
  "snapshot_id",
  "snapshot_version"
]);

function validateSnapshotShape(snapshot) {
  if (!isPlainObject(snapshot)) {
    return fail("CI_MANIFEST_MISMATCH", "Freeze seal snapshot must be a JSON object.", SNAPSHOT_PATH);
  }

  const actualKeys = Object.keys(snapshot).sort();
  const expectedKeys = [...ALLOWED_TOP_LEVEL_KEYS].sort();

  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
    return fail(
      "CI_MANIFEST_MISMATCH",
      `Freeze seal snapshot top-level key set drifted. Expected ${expectedKeys.join(", ")} but found ${actualKeys.join(", ")}.`,
      SNAPSHOT_PATH
    );
  }

  if (snapshot.engine_compatibility !== ENGINE_COMPATIBILITY) {
    return fail(
      "version_mismatch",
      `Freeze seal snapshot engine_compatibility must be '${ENGINE_COMPATIBILITY}'.`,
      SNAPSHOT_PATH
    );
  }

  if (typeof snapshot[HASH_FIELD] !== "string" || snapshot[HASH_FIELD].length === 0) {
    return fail("CI_MANIFEST_MISMATCH", "Freeze seal snapshot is missing embedded self-hash.", `${SNAPSHOT_PATH}.${HASH_FIELD}`);
  }

  if (!/^[a-f0-9]{64}$/.test(snapshot[HASH_FIELD])) {
    return fail("invalid_format", "Freeze seal snapshot embedded self-hash must be lowercase 64-char hex.", `${SNAPSHOT_PATH}.${HASH_FIELD}`);
  }

  return { ok: true };
}

export function computeFreezeSealSnapshotSelfHash(snapshot) {
  const clone = structuredClone(snapshot);
  delete clone[HASH_FIELD];
  const canonicalJson = stableStringify(clone);
  const canonicalBytes = Buffer.from(canonicalJson, "utf8");
  return {
    canonical_json: canonicalJson,
    canonical_bytes: canonicalBytes,
    sha256: sha256Hex(canonicalBytes)
  };
}

export function verifyFreezeSealSnapshotSelfHash(snapshotPath = SNAPSHOT_PATH) {
  if (!fs.existsSync(snapshotPath)) {
    return fail("CI_MANIFEST_MISMATCH", "Freeze seal snapshot file is missing.", snapshotPath);
  }

  let raw;
  try {
    raw = fs.readFileSync(snapshotPath, "utf8");
  } catch (error) {
    return fail("CI_MANIFEST_MISMATCH", `Unable to read freeze seal snapshot: ${error.message}`, snapshotPath);
  }

  let snapshot;
  try {
    snapshot = JSON.parse(raw);
  } catch (error) {
    return fail("CI_MANIFEST_MISMATCH", `Freeze seal snapshot contains invalid JSON: ${error.message}`, snapshotPath);
  }

  const shapeResult = validateSnapshotShape(snapshot);
  if (!shapeResult.ok) {
    return shapeResult;
  }

  const embeddedHash = snapshot[HASH_FIELD];
  const recompute = computeFreezeSealSnapshotSelfHash(snapshot);

  if (recompute.sha256 !== embeddedHash) {
    return fail(
      "content_hash_mismatch",
      `Freeze seal snapshot self-hash mismatch: embedded=${embeddedHash} recomputed=${recompute.sha256}.`,
      snapshotPath
    );
  }

  return {
    ok: true,
    snapshot_path: snapshotPath,
    embedded_hash: embeddedHash,
    recomputed_hash: recompute.sha256
  };
}

function runCli(argv = process.argv) {
  const snapshotPath = argv[2] ?? SNAPSHOT_PATH;
  const result = verifyFreezeSealSnapshotSelfHash(snapshotPath);

  if (!result.ok) {
    process.stderr.write(JSON.stringify(result, null, 2) + "\n");
    return 1;
  }

  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  return 0;
}

const invokedAsEntrypoint = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (invokedAsEntrypoint) {
  process.exit(runCli(process.argv));
}
