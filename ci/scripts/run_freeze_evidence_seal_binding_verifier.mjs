import fs from "node:fs";
import path from "node:path";

function fail(code, message, extra = {}) {
  const payload = {
    ok: false,
    code,
    message,
    ...extra,
  };
  process.stderr.write(JSON.stringify(payload, null, 2) + "\n");
  process.exit(1);
}

function ok(payload) {
  process.stdout.write(JSON.stringify({ ok: true, ...payload }, null, 2) + "\n");
  process.exit(0);
}

function readJson(filePath, label) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    fail(
      "CI_MANIFEST_MISMATCH",
      `${label} file not found.`,
      { path: filePath, details: String(error?.message ?? error) }
    );
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    fail(
      "CI_MANIFEST_MISMATCH",
      `${label} is not valid JSON.`,
      { path: filePath, details: String(error?.message ?? error) }
    );
  }
}

function ensureObject(value, code, message, extra = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(code, message, extra);
  }
}

function getString(obj, key, code, message, extra = {}) {
  const value = obj?.[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(code, message, { field: key, ...extra });
  }
  return value;
}

function resolveActiveSealIdentity(activeSeal) {
  const sealId =
    typeof activeSeal.seal_id === "string" && activeSeal.seal_id.trim().length > 0
      ? activeSeal.seal_id.trim()
      : typeof activeSeal.registry_seal_id === "string" && activeSeal.registry_seal_id.trim().length > 0
        ? activeSeal.registry_seal_id.trim()
        : null;

  const sealHash =
    typeof activeSeal.registry_bundle_hash === "string" && activeSeal.registry_bundle_hash.trim().length > 0
      ? activeSeal.registry_bundle_hash.trim()
      : typeof activeSeal.seal_hash === "string" && activeSeal.seal_hash.trim().length > 0
        ? activeSeal.seal_hash.trim()
        : typeof activeSeal.registry_seal_hash === "string" && activeSeal.registry_seal_hash.trim().length > 0
          ? activeSeal.registry_seal_hash.trim()
          : null;

  if (!sealId) {
    fail(
      "CI_MANIFEST_MISMATCH",
      "Active sealed registry state is missing seal identity.",
      { required_one_of: ["seal_id", "registry_seal_id"] }
    );
  }

  if (!sealHash) {
    fail(
      "CI_MANIFEST_MISMATCH",
      "Active sealed registry state is missing seal hash.",
      { required_one_of: ["registry_bundle_hash", "seal_hash", "registry_seal_hash"] }
    );
  }

  return { sealId, sealHash };
}

function resolveManifestBinding(manifest) {
  ensureObject(
    manifest,
    "CI_MANIFEST_MISMATCH",
    "Freeze evidence manifest must be a JSON object."
  );

  const directBinding = manifest.freeze_evidence_seal_binding;
  const nestedBinding = manifest.binding?.active_registry_seal;
  const legacyBinding = manifest.registry_seal_binding;

  const binding = directBinding ?? nestedBinding ?? legacyBinding;
  ensureObject(
    binding,
    "CI_MANIFEST_MISMATCH",
    "Freeze evidence manifest is missing seal binding.",
    {
      required_one_of: [
        "freeze_evidence_seal_binding",
        "binding.active_registry_seal",
        "registry_seal_binding"
      ]
    }
  );

  const manifestSealId =
    typeof binding.seal_id === "string" && binding.seal_id.trim().length > 0
      ? binding.seal_id.trim()
      : typeof binding.registry_seal_id === "string" && binding.registry_seal_id.trim().length > 0
        ? binding.registry_seal_id.trim()
        : null;

  const manifestSealHash =
    typeof binding.registry_bundle_hash === "string" && binding.registry_bundle_hash.trim().length > 0
      ? binding.registry_bundle_hash.trim()
      : typeof binding.seal_hash === "string" && binding.seal_hash.trim().length > 0
        ? binding.seal_hash.trim()
        : typeof binding.registry_seal_hash === "string" && binding.registry_seal_hash.trim().length > 0
          ? binding.registry_seal_hash.trim()
          : null;

  if (!manifestSealId) {
    fail(
      "CI_MANIFEST_MISMATCH",
      "Freeze evidence manifest seal binding is missing seal identity.",
      { required_one_of: ["seal_id", "registry_seal_id"] }
    );
  }

  if (!manifestSealHash) {
    fail(
      "CI_MANIFEST_MISMATCH",
      "Freeze evidence manifest seal binding is missing seal hash.",
      { required_one_of: ["registry_bundle_hash", "seal_hash", "registry_seal_hash"] }
    );
  }

  return { manifestSealId, manifestSealHash };
}

function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2) {
    fail(
      "CI_MANIFEST_MISMATCH",
      "Usage: node ci/scripts/run_freeze_evidence_seal_binding_verifier.mjs <freeze-evidence-manifest.json> <active-sealed-registry-state.json>"
    );
  }

  const manifestPath = path.resolve(args[0]);
  const activeSealPath = path.resolve(args[1]);

  const manifest = readJson(manifestPath, "freeze evidence manifest");
  const activeSeal = readJson(activeSealPath, "active sealed registry state");

  const { manifestSealId, manifestSealHash } = resolveManifestBinding(manifest);
  const { sealId, sealHash } = resolveActiveSealIdentity(activeSeal);

  if (manifestSealId !== sealId) {
    fail(
      "CI_MANIFEST_MISMATCH",
      "Freeze evidence manifest seal identity does not match active sealed registry state.",
      {
        manifest_path: manifestPath,
        active_seal_path: activeSealPath,
        manifest_seal_id: manifestSealId,
        active_seal_id: sealId
      }
    );
  }

  if (manifestSealHash !== sealHash) {
    fail(
      "CI_MANIFEST_MISMATCH",
      "Freeze evidence manifest seal hash does not match active sealed registry state.",
      {
        manifest_path: manifestPath,
        active_seal_path: activeSealPath,
        manifest_registry_bundle_hash: manifestSealHash,
        active_registry_bundle_hash: sealHash
      }
    );
  }

  ok({
    verifier: "freeze_evidence_seal_binding",
    manifest_path: manifestPath,
    active_seal_path: activeSealPath,
    seal_id: sealId,
    registry_bundle_hash: sealHash
  });
}

main();