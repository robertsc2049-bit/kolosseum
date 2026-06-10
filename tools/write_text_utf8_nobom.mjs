import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { writeRepoTextSync } from "../scripts/repo_io.mjs";

function die(msg) {
  console.error(msg);
  process.exit(1);
}

// Usage:
//   node tools/write_text_utf8_nobom.mjs <path> "<content>"
//   echo "content" | node tools/write_text_utf8_nobom.mjs <path> --stdin
const args = process.argv.slice(2);
if (args.length < 1) die("usage: node tools/write_text_utf8_nobom.mjs <path> \"<content>\" | --stdin");

const outPath = resolve(args[0]);
const mode = args[1] ?? "";

let content = "";
if (mode === "--stdin") {
  content = await new Promise((res) => {
    let s = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (d) => (s += d));
    process.stdin.on("end", () => res(s));
  });
} else {
  content = args.slice(1).join(" ");
  if (!content) die("missing content. provide \"<content>\" or use --stdin.");
}

// Strip accidental BOM char
content = content.replace(/^\uFEFF/, "");

mkdirSync(dirname(outPath), { recursive: true });
writeRepoTextSync(outPath, content);