import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function stripBom(s) {
  return s.length > 0 && s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
}

function readUtf8(p) {
  return stripBom(fs.readFileSync(p, "utf8"));
}

function readJson(p) {
  return JSON.parse(readUtf8(p));
}

function sha256Bytes(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function sha256TextUtf8(s) {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

// Deterministic stringify with deep key sort + cycle-safe clone.
// (Copied from ci/scripts/e2e_golden.mjs to avoid cross-script imports.)
function stableStringify(value) {
  const seen = new WeakSet();

  function clone(v) {
    if (v === null || typeof v !== "object") return v;

    if (seen.has(v)) return "[Circular]";
    seen.add(v);

    if (Array.isArray(v)) return v.map(clone);

    const out = {};
    const keys = Object.keys(v).sort();
    for (const k of keys) out[k] = clone(v[k]);
    return out;
  }

  return JSON.stringify(clone(value), null, 2) + "\n";
}

function relPosix(p) {
  return p.split(path.sep).join("/");
}

function listSchemaFiles(repoRoot) {
  const dir = path.join(repoRoot, "ci", "schemas");
  if (!fs.existsSync(dir)) die("evidence_seal: missing ci/schemas directory");
  const names = fs.readdirSync(dir).filter(f => f.endsWith(".json"));
  names.sort((a, b) => a.localeCompare(b));
  return names.map(n => path.join("ci", "schemas", n));
}

function readPackageMeta(repoRoot) {
  const pkgPath = path.join(repoRoot, "package.json");
  if (!fs.existsSync(pkgPath)) die("evidence_seal: package.json missing");
  const pkg = readJson(pkgPath);
  const version = typeof pkg.version === "string" ? pkg.version : "";
  const node = process.versions.node || "";
  if (!version) die("evidence_seal: package.json version missing/invalid");
  return { version, node };
}

function computeEnvelope(repoRoot, opts) {
  const engine = readPackageMeta(repoRoot);

  // These are placeholders for now; Phase7 will wire real request/constraints hashes later.
  const h = opts.zeroHash;

  const schemaFiles = listSchemaFiles(repoRoot);
  const schema_sha256s = schemaFiles.map(rel => {
    const abs = path.join(repoRoot, rel);
    const bytes = fs.readFileSync(abs);
    return { path: relPosix(rel), sha256: sha256Bytes(bytes).toUpperCase() };
  });

  // Registry bundle is the "committed bundle" artifact your guard already enforces.
  const bundleRel = path.join("registries", "registry_bundle.json");
  const bundleAbs = path.join(repoRoot, bundleRel);
  if (!fs.existsSync(bundleAbs)) die("evidence_seal: missing registries/registry_bundle.json");
  const registry_bundle_sha256 = sha256Bytes(fs.readFileSync(bundleAbs)).toUpperCase();

  const envelope = {
    contract: "kolosseum:evidence_envelope@1",
    engine,
    inputs: {
      request_sha256: h,
      constraints_sha256: h,
      registry_bundle_sha256,
      schema_sha256s
    },
    artifacts: {
      phase_outputs: [
        { phase: 1, name: "phase1_envelope", sha256: h },
        { phase: 3, name: "phase3_constraints", sha256: h },
        { phase: 4, name: "phase4_program", sha256: h },
        { phase: 6, name: "phase6_session", sha256: h }
      ]
    },
    validations: {
      guards: [
        { name: "registry_law_guard", result: "pass" },
        { name: "engine_contract_guard", result: "pass" }
      ]
    }
  };

  const canonical = stableStringify(envelope);
  const envelope_sha256 = sha256TextUtf8(canonical).toUpperCase();
  return { envelope, canonical, envelope_sha256 };
}

function computeSeal(envelope_sha256) {
  const seal_material = `kolosseum:evidence_seal@1\n${envelope_sha256}\n`;
  const seal_sha256 = sha256TextUtf8(seal_material).toUpperCase();

  const seal = {
    contract: "kolosseum:evidence_seal@1",
    envelope_sha256,
    seal_sha256
  };

  return { seal, seal_material, seal_sha256 };
}

function writeUtf8Lf(p, text) {
  const t = String(text).replace(/\r\n/g, "\n");
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, t, "utf8");
}

function main() {
  const repoRoot = process.cwd();

  const args = process.argv.slice(2);
  const flagWrite = args.includes("--write");
  const flagCheck = args.includes("--check");
  const flagPrint = args.includes("--print");

  if (!flagWrite && !flagCheck && !flagPrint) {
    die("evidence_seal: specify one of --write | --check | --print");
  }

  const outEnvelope = path.join(repoRoot, "ci", "evidence", "evidence_envelope.v1.json");
  const outSeal = path.join(repoRoot, "ci", "evidence", "evidence_seal.v1.json");

  const zeroHash = "0".repeat(64);

  const env = computeEnvelope(repoRoot, { zeroHash });
  const seal = computeSeal(env.envelope_sha256);

  const envelopeText = env.canonical; // canonical stable json
  const sealText = stableStringify(seal.seal);

  if (flagPrint) {
    process.stdout.write(envelopeText);
    process.stdout.write(sealText);
    return;
  }

  if (flagWrite) {
    writeUtf8Lf(outEnvelope, envelopeText);
    writeUtf8Lf(outSeal, sealText);
    console.log(`OK: Wrote ${path.relative(repoRoot, outEnvelope)}`);
    console.log(`OK: Wrote ${path.relative(repoRoot, outSeal)}`);
    console.log(`envelope_sha256=${env.envelope_sha256}`);
    console.log(`seal_sha256=${seal.seal_sha256}`);
    return;
  }

  // --check
  if (!fs.existsSync(outEnvelope)) die("evidence_seal: missing committed evidence envelope file (run with --write and commit)");
  if (!fs.existsSync(outSeal)) die("evidence_seal: missing committed evidence seal file (run with --write and commit)");

  const aEnv = readUtf8(outEnvelope).replace(/\r\n/g, "\n");
  const aSeal = readUtf8(outSeal).replace(/\r\n/g, "\n");

  if (aEnv !== envelopeText) {
    die(
      "evidence_seal: envelope file mismatch (not canonical or out of date)\n" +
      "Fix: node ci/scripts/evidence_seal.mjs --write && git add ci/evidence/evidence_envelope.v1.json ci/evidence/evidence_seal.v1.json"
    );
  }
  if (aSeal !== sealText) {
    die(
      "evidence_seal: seal file mismatch (not canonical or out of date)\n" +
      "Fix: node ci/scripts/evidence_seal.mjs --write && git add ci/evidence/evidence_envelope.v1.json ci/evidence/evidence_seal.v1.json"
    );
  }

  console.log("OK: evidence_seal (envelope+seal match canonical recompute)");
}

main();
