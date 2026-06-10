// @law: Repo Governance
// @severity: medium
// @scope: repo
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function sha256Hex(s) {
  return crypto.createHash("sha256").update(String(s), "utf8").digest("hex");
}

function stableStringify(value) {
  // Deterministic JSON stringify: sorts object keys recursively.
  const seen = new WeakSet();

  function norm(v) {
    if (v === null) return null;
    const t = typeof v;
    if (t === "string" || t === "number" || t === "boolean") return v;
    if (t === "bigint") return String(v);
    if (t === "undefined") return "__undefined__";
    if (t === "function") return "__function__";
    if (t !== "object") return String(v);

    if (seen.has(v)) return "__cycle__";
    seen.add(v);

    if (Array.isArray(v)) return v.map(norm);

    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = norm(v[k]);
    return out;
  }

  return JSON.stringify(norm(value));
}

function shapeSignature(value) {
  // Captures "shape" only (keys + primitive types), deterministically.
  // Arrays capture the set of element signatures (unique, sorted).
  function sig(v) {
    if (v === null) return { t: "null" };
    const t = typeof v;
    if (t === "string" || t === "number" || t === "boolean") return { t };
    if (t === "bigint") return { t: "bigint" };
    if (t === "undefined") return { t: "undefined" };
    if (t !== "object") return { t: "other" };

    if (Array.isArray(v)) {
      const parts = v.map(sig).map(stableStringify);
      const uniq = Array.from(new Set(parts)).sort();
      return { t: "array", of: uniq.map((s) => JSON.parse(s)) };
    }

    const keys = Object.keys(v).sort();
    const obj = {};
    for (const k of keys) obj[k] = sig(v[k]);
    return { t: "object", keys: obj };
  }

  return sig(value);
}

function repoRootFromHere() {
  // ci/guards/... -> repo root is 2 levels up from ci/
  return path.resolve(__dirname, "..", "..");
}

function findFixtureFile(repoRoot) {
  // We want a stable, canonical request fixture.
  // Prefer ci/fixtures/**/vanilla_minimal*.json, then test/**/vanilla_minimal*.json
  const candidates = [];

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.isFile()) {
        const n = ent.name.toLowerCase();
        if (n.startsWith("vanilla_minimal") && n.endsWith(".json")) candidates.push(p);
      }
    }
  }

  walk(path.join(repoRoot, "ci"));
  walk(path.join(repoRoot, "test"));
  if (candidates.length === 0) return null;

  // Prefer anything under ci/fixtures first
  const ciPreferred = candidates.filter((p) => p.toLowerCase().includes(`${path.sep}ci${path.sep}fixtures${path.sep}`));
  const pick = (ciPreferred.length ? ciPreferred : candidates).sort()[0];
  return pick;
}

async function loadRunPipeline(repoRoot) {
  const distPath = path.join(repoRoot, "dist", "src", "run_pipeline.js");
  if (!fs.existsSync(distPath)) {
    die(
      [
        "run_pipeline_contract_version_guard: dist/src/run_pipeline.js missing.",
        "This guard must run AFTER build output exists.",
        "Fix: run `npm run build:fast` first (or ensure build:fast produces dist).",
      ].join("\n")
    );
  }

  const mod = await import(pathToFileURL(distPath).href);
  if (typeof mod.runPipeline !== "function") {
    die("run_pipeline_contract_version_guard: dist/src/run_pipeline.js does not export runPipeline()");
  }
  return mod.runPipeline;
}

async function main() {
  const repoRoot = repoRootFromHere();
  const contractDir = path.join(repoRoot, "ci", "contracts");
  const contractPath = path.join(contractDir, "run_pipeline_contract_versions.json");

  const args = new Set(process.argv.slice(2));
  const initMode = args.has("--init");
  const allowWrite = args.has("--write"); // updates hashes WITHOUT bumping versions (intentionally discouraged)

  const fixturePath = findFixtureFile(repoRoot);
  if (!fixturePath) {
    die(
      [
        "run_pipeline_contract_version_guard: could not find a vanilla_minimal*.json fixture.",
        "Expected something like ci/**/vanilla_minimal.json or test/**/vanilla_minimal.json.",
      ].join("\n")
    );
  }

  let requestJson;
  try {
    requestJson = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  } catch (e) {
    die(`run_pipeline_contract_version_guard: failed to parse fixture JSON: ${fixturePath}\n${String(e)}`);
  }

  const runPipeline = await loadRunPipeline(repoRoot);

  let responseJson;
  try {
    responseJson = await runPipeline(requestJson);
  } catch (e) {
    die(`run_pipeline_contract_version_guard: runPipeline threw for fixture ${fixturePath}\n${String(e)}`);
  }

  const reqSig = shapeSignature(requestJson);
  const resSig = shapeSignature(responseJson);

  const reqHash = sha256Hex(stableStringify(reqSig));
  const resHash = sha256Hex(stableStringify(resSig));

  if (initMode) {
    if (!fs.existsSync(contractDir)) fs.mkdirSync(contractDir, { recursive: true });

    if (fs.existsSync(contractPath)) {
      die(`run_pipeline_contract_version_guard: --init refused (contract file already exists): ${contractPath}`);
    }

    const initDoc = {
      meta: {
        tool: "run_pipeline_contract_version_guard",
        fixture: path.relative(repoRoot, fixturePath).replaceAll("\\", "/"),
        created_utc: new Date().toISOString(),
      },
      request: { version: 1, shape_sha256: reqHash },
      response: { version: 1, shape_sha256: resHash },
    };

    fs.writeFileSync(contractPath, stableStringify(initDoc) + "\n", "utf8");
    console.log(`OK: initialized ${path.relative(repoRoot, contractPath)}`);
    return;
  }

  if (!fs.existsSync(contractPath)) {
    die(
      [
        "run_pipeline_contract_version_guard: contract file missing.",
        `Expected: ${path.relative(repoRoot, contractPath)}`,
        "Fix: run `node ci/guards/run_pipeline_contract_version_guard.mjs --init` (after build).",
      ].join("\n")
    );
  }

  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(contractPath, "utf8"));
  } catch (e) {
    die(`run_pipeline_contract_version_guard: failed to parse contract JSON: ${contractPath}\n${String(e)}`);
  }

  if (!doc.request || typeof doc.request.version !== "number" || typeof doc.request.shape_sha256 !== "string") {
    die("run_pipeline_contract_version_guard: contract.request missing or invalid");
  }
  if (!doc.response || typeof doc.response.version !== "number" || typeof doc.response.shape_sha256 !== "string") {
    die("run_pipeline_contract_version_guard: contract.response missing or invalid");
  }

  const reqOk = doc.request.shape_sha256 === reqHash;
  const resOk = doc.response.shape_sha256 === resHash;

  if (reqOk && resOk) {
    console.log("OK: runPipeline request/response shapes match pinned contract hashes.");
    return;
  }

  if (allowWrite) {
    // This is a footgun. It exists only for emergency recovery.
    doc.meta = doc.meta || {};
    doc.meta.last_write_utc = new Date().toISOString();
    doc.request.shape_sha256 = reqHash;
    doc.response.shape_sha256 = resHash;
    fs.writeFileSync(contractPath, stableStringify(doc) + "\n", "utf8");
    console.log("WARN: hashes updated in-place (--write). You likely still need to bump versions.");
    return;
  }

  const lines = [];
  lines.push("FAIL: runPipeline contract shape changed without version bump.");
  lines.push("");
  lines.push(`Fixture: ${path.relative(repoRoot, fixturePath).replaceAll("\\", "/")}`);
  lines.push("");
  if (!reqOk) {
    lines.push(`Request: pinned v${doc.request.version} sha=${doc.request.shape_sha256}`);
    lines.push(`         current        sha=${reqHash}`);
  } else {
    lines.push(`Request: OK (v${doc.request.version})`);
  }
  if (!resOk) {
    lines.push(`Response: pinned v${doc.response.version} sha=${doc.response.shape_sha256}`);
    lines.push(`          current        sha=${resHash}`);
  } else {
    lines.push(`Response: OK (v${doc.response.version})`);
  }
  lines.push("");
  lines.push("Fix (required):");
  lines.push("- Bump request.version and/or response.version in ci/contracts/run_pipeline_contract_versions.json");
  lines.push("- Replace the corresponding shape_sha256 with the 'current' sha above");
  lines.push("- Commit both the code change AND the version bump together");
  lines.push("");
  die(lines.join("\n"));
}

main().catch((e) => die(String(e)));
