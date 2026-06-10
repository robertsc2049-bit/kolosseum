import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

function shOut(cmd) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString("utf8").trim();
}

const summaryPath = process.env.GITHUB_STEP_SUMMARY;
if (!summaryPath) {
  console.log("ci_write_summary: no GITHUB_STEP_SUMMARY available.");
  process.exit(0);
}

const mode = (process.env.CI_MODE || "").trim();
const base = (process.env.BASE_SHA || "").trim();
const head = (process.env.HEAD_SHA || "").trim();

const nodeV = process.versions.node;
let npmV = "";
try { npmV = shOut("npm -v"); } catch {}

let files = [];
if (existsSync("ci_changed_files.txt")) {
  files = readFileSync("ci_changed_files.txt", "utf8")
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean);
}

const top = files.slice(0, 50).map(f => `- \`${f}\``).join("\n");
const overflow = files.length > 50 ? `\n\n(+${files.length - 50} more)` : "";

const body =
`## CI Summary

- **mode:** \`${mode || "unknown"}\`
- **node:** \`${nodeV}\`
- **npm:** \`${npmV || "unknown"}\`
- **base:** \`${base}\`
- **head:** \`${head}\`
- **changed files:** \`${files.length}\`

### Changed files
${files.length ? top + overflow : "(none)"}
`;

writeFileSync(summaryPath, body, { encoding: "utf8", flag: "a" });
console.log("ci_write_summary: wrote summary.");