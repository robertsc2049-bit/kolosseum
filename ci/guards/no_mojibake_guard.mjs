// @law: Encoding Hygiene
// @severity: high
// @scope: repo

// DEV NOTE: Mojibake guard. This script protects repo text from common
// UTF-8-to-legacy-decoder corruption signatures. It scans tracked text-like files
// as raw bytes so corrupted glyphs are detected without pasting those glyphs into
// this source file.

import fs from "node:fs";
import { spawnSync } from "node:child_process";

/**
 * DEV NOTE: Terminate with a stable guard-owned message and non-zero exit code.
 * Messages are trimmed so encoding failures remain readable in CI and PowerShell
 * output without trailing whitespace noise.
 */
function die(msg) {
  console.error(String(msg).trimEnd());
  process.exit(1);
}

/**
 * DEV NOTE: Read tracked files from git using NUL separation.
 * This keeps the scan bound to reviewed repo files and avoids noisy failures from
 * untracked local scratch files.
 */
function gitLsFilesZ() {
  const r = spawnSync("git", ["ls-files", "-z"], { encoding: "buffer" });
  if (r.status !== 0) {
    const err = Buffer.isBuffer(r.stderr) ? r.stderr.toString("utf8") : String(r.stderr ?? "");
    die(`[ERR] no_mojibake_guard: git ls-files failed\n${err}`.trim());
  }
  const out = r.stdout;
  const files = [];
  let start = 0;
  for (let i = 0; i < out.length; i++) {
    if (out[i] === 0) {
      const s = out.slice(start, i).toString("utf8");
      if (s) files.push(s);
      start = i + 1;
    }
  }
  return files;
}

/**
 * DEV NOTE: Limit the mojibake scan to text-like tracked paths.
 * Generated, dependency, and VCS directories are excluded because this guard owns
 * repo-authored text hygiene, not external packages or build output.
 */
function isTextyPath(p) {
  const lower = p.toLowerCase();
  if (lower.startsWith("node_modules/")) return false;
  if (lower.startsWith("dist/")) return false;
  if (lower.startsWith(".git/")) return false;

  return (
    lower.endsWith(".mjs") ||
    lower.endsWith(".cjs") ||
    lower.endsWith(".js") ||
    lower.endsWith(".ts") ||
    lower.endsWith(".tsx") ||
    lower.endsWith(".json") ||
    lower.endsWith(".md") ||
    lower.endsWith(".yml") ||
    lower.endsWith(".yaml") ||
    lower.endsWith(".sql") ||
    lower.endsWith(".ps1") ||
    lower.endsWith(".txt")
  );
}

/**
 * DEV NOTE: Return the first byte offset of a signature inside a file buffer.
 * Buffer.indexOf is used deliberately so detection is byte-based and independent
 * of JavaScript string decoding behaviour.
 */
function findFirstNeedle(hay, needle) {
  return hay.indexOf(needle);
}

// DEV NOTE: Detect common UTF-8-to-legacy-decoder artefacts by byte sequence.
// Keep this source ASCII-only. Do not paste mojibake glyphs here; add signatures
// as hex byte arrays with hex-only names so the guard cannot introduce the problem
// it is meant to detect.
const NEEDLES = [
  // Prefix family seen in many mojibake runs; covers many punctuation/quote cases.
  { name: "moji_prefix_C383C2A2C3A2E2809AC2AC", bytes: [0xC3,0x83,0xC2,0xA2,0xC3,0xA2,0xE2,0x80,0x9A,0xC2,0xAC] },

  // Stray NBSP marker before ASCII space.
  { name: "moji_C38220", bytes: [0xC3,0x82,0x20] },

  // Middle dot leak.
  { name: "moji_C382C2B7", bytes: [0xC3,0x82,0xC2,0xB7] },

  // Dash leak variants.
  { name: "moji_C382E28094", bytes: [0xC3,0x82,0xE2,0x80,0x94] },
  { name: "moji_C382E28093", bytes: [0xC3,0x82,0xE2,0x80,0x93] },

  // Optional weak signal. Disabled to avoid false positives:
  // { name: "weak_C383", bytes: [0xC3,0x83] },
].map(x => ({ name: x.name, needle: Buffer.from(x.bytes) }));

/**
 * DEV NOTE: Scan one file buffer for the first configured mojibake signature.
 * Returning only the first hit keeps failure output compact while still giving the
 * path, signature, and byte offset needed to repair the file.
 */
function scanFile(p) {
  const buf = fs.readFileSync(p);
  for (const n of NEEDLES) {
    const at = findFirstNeedle(buf, n.needle);
    if (at >= 0) return { path: p, which: n.name, offset: at };
  }
  return null;
}

/**
 * DEV NOTE: Main mojibake proof.
 * The guard scans tracked text-like files, reports up to 50 hits, and prints the
 * first 20 for readable CI output. ENOENT is tolerated because clean-tree guards
 * own worktree consistency; other read failures are hard encoding-check failures.
 */
function main() {
  const files = gitLsFilesZ().filter(isTextyPath);

  const hits = [];
  for (const p of files) {
    try {
      const h = scanFile(p);
      if (h) hits.push(h);
      if (hits.length >= 50) break;
    } catch (e) {
      const msg = String(e?.message ?? e);
      if (!/ENOENT/.test(msg)) {
        die(`[ERR] no_mojibake_guard: failed reading ${p}\n${msg}`.trim());
      }
    }
  }

  if (hits.length) {
    console.error("[ERR] Mojibake detected (byte-signature scan). Offenders:");
    for (const h of hits.slice(0, 20)) {
      console.error(`- ${h.path} :: ${h.which} @ byteOffset=${h.offset}`);
    }
    if (hits.length > 20) console.error(`(and ${hits.length - 20} more...)`);
    die("[ERR] no_mojibake_guard failed.");
  }

  // DEV NOTE: Success means no configured mojibake byte signatures were found in
  // scanned tracked text-like files. It does not prove all possible encoding
  // corruption is impossible; it blocks the known signatures this repo has chosen
  // to enforce.
  console.log("OK: no_mojibake_guard");
}

main();
