import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const docsDir = path.resolve("docs");
const outPath = path.join(docsDir, "checksums.sha256");

if (!fs.existsSync(docsDir)) {
  console.error("docs/ folder missing");
  process.exit(1);
}

const files = fs.readdirSync(docsDir)
  .filter(f => f !== "checksums.sha256")
  .filter(f => fs.statSync(path.join(docsDir, f)).isFile())
  .sort((a, b) => a.localeCompare(b));

const lines = [];
for (const f of files) {
  const full = path.join(docsDir, f);
  const bytes = fs.readFileSync(full);
  const hash = crypto.createHash("sha256").update(bytes).digest("hex");
  lines.push(`${hash}  ${f}`);
}

fs.writeFileSync(outPath, lines.join("\n") + (lines.length ? "\n" : ""), "utf8");
console.log(`checksums written: ${outPath}`);
