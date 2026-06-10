import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repo = process.cwd();

function die(message) {
  console.error(String(message).trimEnd());
  process.exit(1);
}

function git(args) {
  const r = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
  if (r.status !== 0) {
    die(`[ERR] git ${args.join(" ")} failed\n${r.stderr || r.stdout || ""}`);
  }
  return r.stdout;
}

function norm(p) {
  return String(p).replace(/\\/g, "/");
}

function readText(file) {
  return fs.readFileSync(path.join(repo, file), "utf8");
}

function writeText(file, text) {
  const abs = path.join(repo, file);
  fs.writeFileSync(abs, text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n*$/, "\n"), { encoding: "utf8" });
}

function hasDevNote(text) {
  return /\bDEV NOTE\b/.test(text) || /\bDEV NOTES\b/.test(text) || /"_dev_notes"\s*:/.test(text);
}

function isGeneratedOrPinned(file) {
  const f = norm(file).toLowerCase();

  if (f.includes("/node_modules/") || f.startsWith("node_modules/")) return "dependency directory";
  if (f.includes("/dist/") || f.startsWith("dist/")) return "generated dist output";
  if (f.includes("/build/") || f.startsWith("build/")) return "generated build output";
  if (f.includes("/coverage/") || f.startsWith("coverage/")) return "generated coverage output";
  if (f.includes("/.next/") || f.startsWith(".next/")) return "generated Next output";
  if (f.includes("/.turbo/") || f.startsWith(".turbo/")) return "generated turbo output";

  if (f.endsWith("package-lock.json")) return "lockfile / package manager truth";
  if (f.endsWith("pnpm-lock.yaml")) return "lockfile / package manager truth";
  if (f.endsWith("yarn.lock")) return "lockfile / package manager truth";

  if (f.endsWith(".sha256")) return "hash pin";
  if (f.includes("/golden/")) return "golden fixture / byte-pinned surface";
  if (f.includes("/fixtures/")) return "fixture surface; update only by specific slice";
  if (f.includes("/evidence/") && f.endsWith(".json")) return "evidence/seal surface; update only by specific slice";
  if (f.includes("/freeze/") && f.endsWith(".json")) return "freeze manifest; update only by specific slice";
  if (f.includes("/contracts/") && f.endsWith(".json")) return "contract JSON; update only by specific slice";
  if (f.includes("/artefacts/") && f.endsWith(".json")) return "artefact map; update only by specific slice";
  if (f.includes("/golden/") && f.endsWith(".json")) return "golden JSON; update only by specific slice";

  if (f.endsWith(".png") || f.endsWith(".jpg") || f.endsWith(".jpeg") || f.endsWith(".webp") || f.endsWith(".ico") || f.endsWith(".pdf") || f.endsWith(".docx") || f.endsWith(".zip")) {
    return "binary/document file";
  }

  return "";
}

function noteFor(file) {
  const f = norm(file);
  const lower = f.toLowerCase();

  if (lower.startsWith("ci/guards/")) {
    return "DEV NOTE: CI guard surface. This file enforces a repo boundary and should fail closed with readable output. Do not weaken the guard to make a failing build pass; fix the underlying boundary drift or update the canonical contract deliberately.";
  }

  if (lower.startsWith("ci/scripts/") || lower.startsWith("scripts/")) {
    return "DEV NOTE: Repository automation script. This file exists to make a repeatable repo operation deterministic and reviewable. Keep side effects explicit, paths repo-root relative, and failure output readable for PowerShell and CI users.";
  }

  if (lower.startsWith("engine/")) {
    return "DEV NOTE: Engine-side implementation surface. Keep this code deterministic, closed-world, and free of product/UI/coach-note influence. Engine truth must come from explicit inputs, canonical registries, and validated contracts only.";
  }

  if (lower.startsWith("src/api/") || lower.includes("/api/")) {
    return "DEV NOTE: API boundary surface. This file may expose or transport engine results, but must not bypass engine package boundaries, infer hidden truth, or let UI/product state mutate deterministic engine behaviour.";
  }

  if (lower.startsWith("src/") || lower.startsWith("app/")) {
    return "DEV NOTE: Application source surface. Keep product/UI behaviour separated from deterministic engine truth. UI, notes, and workflow convenience must not change canonical engine inputs or outputs unless routed through an explicit validated contract.";
  }

  if (lower.startsWith(".github/workflows/")) {
    return "DEV NOTE: CI workflow surface. This workflow should call stable npm/package entrypoints rather than duplicating guard logic inline. Keep CI behaviour explicit so local green and GitHub green remain aligned.";
  }

  if (lower.startsWith("docs/")) {
    return "DEV NOTE: Developer documentation surface. This document explains repo behaviour or boundaries, but canonical law remains in the tracked contracts, guards, and tests. Keep docs aligned with executable checks.";
  }

  return "DEV NOTE: Human-maintained repo surface. Keep this file aligned with canonical contracts, deterministic checks, and developer handover standards. Do not introduce hidden defaults, broad discovery, or unreviewed boundary changes.";
}

function insertJsStyle(text, file, linePrefix) {
  if (hasDevNote(text)) return text;

  const note = noteFor(file);
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  let insertAt = 0;

  if (lines[0]?.startsWith("#!")) {
    insertAt = 1;
  }

  while (
    insertAt < Math.min(lines.length, 20) &&
    (
      lines[insertAt].startsWith("// @") ||
      lines[insertAt].startsWith("# @") ||
      lines[insertAt].trim() === ""
    )
  ) {
    insertAt++;
  }

  const wrapped = wrapComment(note, linePrefix);
  lines.splice(insertAt, 0, "", ...wrapped, "");
  return lines.join("\n");
}

function wrapComment(text, prefix) {
  const words = text.split(/\s+/);
  const out = [];
  let line = prefix;
  for (const word of words) {
    if ((line + " " + word).length > 96) {
      out.push(line);
      line = prefix + word;
    } else {
      line += (line === prefix ? "" : " ") + word;
    }
  }
  out.push(line);
  return out;
}

function insertMd(text, file) {
  if (hasDevNote(text)) return text;
  const note = noteFor(file);
  return `<!-- DEV NOTE: ${note.replace(/^DEV NOTE:\s*/, "")} -->\n\n${text}`;
}

function insertYaml(text, file) {
  return insertJsStyle(text, file, "# ");
}

function classify(file) {
  const lower = norm(file).toLowerCase();

  const skip = isGeneratedOrPinned(file);
  if (skip) return { action: "skip", reason: skip };

  if (lower.endsWith(".mjs") || lower.endsWith(".js") || lower.endsWith(".cjs") || lower.endsWith(".ts") || lower.endsWith(".tsx")) {
    return { action: "comment", style: "js" };
  }

  if (lower.endsWith(".ps1") || lower.endsWith(".sh")) {
    return { action: "comment", style: "hash" };
  }

  if (lower.endsWith(".md") || lower.endsWith(".txt")) {
    return { action: "comment", style: "md" };
  }

  if (lower.endsWith(".yml") || lower.endsWith(".yaml")) {
    return { action: "comment", style: "yaml" };
  }

  return { action: "skip", reason: "unsupported or unsafe extension" };
}

const tracked = git(["ls-files"])
  .split(/\r?\n/)
  .map((s) => s.trim())
  .filter(Boolean);

const changed = [];
const skipped = [];
const already = [];

for (const file of tracked) {
  const c = classify(file);

  if (c.action === "skip") {
    skipped.push({ file, reason: c.reason });
    continue;
  }

  let before;
  try {
    before = readText(file);
  } catch {
    skipped.push({ file, reason: "could not read as UTF-8 text" });
    continue;
  }

  if (hasDevNote(before)) {
    already.push(file);
    continue;
  }

  let after = before;

  if (c.style === "js") after = insertJsStyle(before, file, "// ");
  else if (c.style === "hash") after = insertJsStyle(before, file, "# ");
  else if (c.style === "md") after = insertMd(before, file);
  else if (c.style === "yaml") after = insertYaml(before, file);

  if (after !== before) {
    writeText(file, after);
    changed.push(file);
  }
}

const reportDir = path.join(repo, "docs", "dev");
fs.mkdirSync(reportDir, { recursive: true });

const report = [
  "# Repo-wide DEV NOTE pass report",
  "",
  "This report was generated by `scripts/add_repo_wide_dev_notes.mjs`.",
  "",
  "## Updated files",
  "",
  ...(changed.length ? changed.map((f) => `- ${f}`) : ["- None"]),
  "",
  "## Already had DEV NOTE / _dev_notes",
  "",
  ...(already.length ? already.map((f) => `- ${f}`) : ["- None"]),
  "",
  "## Skipped files",
  "",
  ...(skipped.length ? skipped.map((x) => `- ${x.file} — ${x.reason}`) : ["- None"]),
  "",
].join("\n");

fs.writeFileSync(path.join(reportDir, "REPO_WIDE_DEV_NOTES_REPORT.md"), report.replace(/\n*$/, "\n"), "utf8");

console.log(`Updated files: ${changed.length}`);
console.log(`Already noted: ${already.length}`);
console.log(`Skipped files: ${skipped.length}`);
console.log("Report: docs/dev/REPO_WIDE_DEV_NOTES_REPORT.md");
