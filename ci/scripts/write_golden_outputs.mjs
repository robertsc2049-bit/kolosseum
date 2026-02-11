import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function normalizeLf(s) {
  return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function stripBom(s) {
  return s.replace(/^\uFEFF/, "");
}

function readTextUtf8Normalized(p) {
  const raw = fs.readFileSync(p, "utf8");
  return normalizeLf(stripBom(raw));
}

function sha256Hex(bufOrText) {
  return crypto.createHash("sha256").update(bufOrText).digest("hex");
}

function listJsonFiles(dirAbs) {
  if (!fs.existsSync(dirAbs)) return [];
  return fs
    .readdirSync(dirAbs)
    .filter((f) => f.toLowerCase().endsWith(".json"))
    .map((f) => path.join(dirAbs, f))
    .sort((a, b) => a.localeCompare(b));
}

function writeUtf8NoBomLf(p, text) {
  fs.writeFileSync(p, normalizeLf(text), { encoding: "utf8" });
}

function repoRoot() {
  return process.cwd();
}

function main() {
  const root = repoRoot();
  const goldenRoot = path.join(root, "test", "fixtures", "golden");
  const expectedDir = path.join(goldenRoot, "expected");

  const outputsPath = path.join(goldenRoot, "golden_outputs.v1.json");
  const outputsShaPath = path.join(goldenRoot, "golden_outputs.v1.sha256");

  if (!fs.existsSync(goldenRoot)) die(`Missing golden root: ${goldenRoot}`);
  if (!fs.existsSync(expectedDir)) die(`Missing expected dir: ${expectedDir}`);

  const expectedFiles = listJsonFiles(expectedDir);
  if (expectedFiles.length === 0) die(`No expected fixtures found under: ${expectedDir}`);

  const outputs = {};
  for (const p of expectedFiles) {
    const name = path.basename(p, ".json");
    const text = readTextUtf8Normalized(p);
    outputs[name] = sha256Hex(text);
  }

  const doc = {
    outputs_version: "1.0.0",
    generated_utc: new Date().toISOString(),
    root: "test/fixtures/golden/expected",
    output_sha256_by_fixture: outputs
  };

  const json = JSON.stringify(doc, null, 2) + "\n";
  writeUtf8NoBomLf(outputsPath, json);

  const outputsBytes = fs.readFileSync(outputsPath);
  const outSha = sha256Hex(outputsBytes);
  writeUtf8NoBomLf(outputsShaPath, outSha + "\n");

  console.log(`OK: Wrote test/fixtures/golden/golden_outputs.v1.json (${expectedFiles.length} fixture(s))`);
  console.log(`OK: Wrote test/fixtures/golden/golden_outputs.v1.sha256 = ${outSha}`);
}

main();
