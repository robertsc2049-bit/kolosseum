import fs from "node:fs";
import { writeRepoJsonSync } from "./repo_io.mjs";

function die(msg) {
  console.error(msg);
  process.exit(1);
}

const pkgPath = "package.json";
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

if (!pkg || typeof pkg !== "object") die("add_test_ci_entry: package.json parse failed.");
if (!pkg.scripts || typeof pkg.scripts !== "object") die("add_test_ci_entry: package.json missing scripts.");
if (!pkg.scripts["test:ci"] || typeof pkg.scripts["test:ci"] !== "string") die("add_test_ci_entry: scripts.test:ci missing.");

const needle = "node test/ci_ban_set_content_utf8_guard_outfile_negative.test.mjs";
const cur = pkg.scripts["test:ci"];

if (cur.includes(needle)) {
  console.log("OK: test:ci already includes ban_set_content_utf8_guard Out-File negative test.");
  process.exit(0);
}

// Maintain the existing style: it's a chain of `node test/... && node test/...`
// Append at the end.
pkg.scripts["test:ci"] = cur.trim() + " && " + needle;

writeRepoJsonSync(pkgPath, pkg, { space: 2, suffixNewline: true });

console.log("UPDATED: scripts.test:ci appended:", needle);