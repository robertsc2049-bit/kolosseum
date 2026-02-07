import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function readUtf8(p) {
  return fs.readFileSync(p, "utf8");
}

function mustExist(p) {
  assert.ok(fs.existsSync(p), `missing: ${p}`);
}

test("CLI export contract docs exist and match ENGINE_CONTRACT reference", () => {
  const root = process.cwd();
  const docs = path.join(root, "docs", "CLI_EXPORT.md");
  const engine = path.join(root, "ENGINE_CONTRACT.md");

  mustExist(docs);
  mustExist(engine);

  const docsTxt = readUtf8(docs);
  const engTxt = readUtf8(engine);

  // LF-only: policy is enforced repo-wide; docs should not introduce CRLF.
  assert.equal(docsTxt.includes("\r"), false, "docs/CLI_EXPORT.md must be LF-only");
  assert.equal(engTxt.includes("\r"), false, "ENGINE_CONTRACT.md must be LF-only");

  // ENGINE_CONTRACT must acknowledge the CLI export contract and point to the normative doc.
  assert.ok(engTxt.includes("## CLI export contract"), "ENGINE_CONTRACT missing CLI export section");
  assert.ok(engTxt.includes("docs/CLI_EXPORT.md"), "ENGINE_CONTRACT must reference docs/CLI_EXPORT.md");

  // Normative doc must state the stable output surface.
  assert.ok(docsTxt.includes("## Output Contract"), "CLI_EXPORT.md missing Output Contract section");
  assert.ok(docsTxt.includes("When `--outdir` is provided"), "CLI_EXPORT.md must describe --outdir behavior");
  assert.ok(docsTxt.includes("session.json"), "CLI_EXPORT.md must mention session.json");
  assert.ok(docsTxt.includes("session.txt"), "CLI_EXPORT.md must mention session.txt");
  assert.ok(docsTxt.includes("exactly two files"), "CLI_EXPORT.md must state exactly two files");
});
