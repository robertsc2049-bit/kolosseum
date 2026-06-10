// @law: Encoding Hygiene
// @severity: high
// @scope: repo
import fs from "node:fs";
import { spawnSync } from "node:child_process";

function die(msg) {
  console.error(String(msg).trimEnd());
  process.exit(1);
}

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

function findFirstNeedle(hay, needle) {
  return hay.indexOf(needle);
}

// Detect common UTF-8->legacy decode artifacts by searching for *byte sequences*.
// NOTE: Keep this source ASCII-only. Do NOT paste mojibake glyphs here.
//
// Needles listed as hex bytes; name is hex-only to avoid accidental glyph leakage.
const NEEDLES = [
  // "prefix family" seen in many mojibake runs (covers many punctuation/quotes cases)
  { name: "moji_prefix_C383C2A2C3A2E2809AC2AC", bytes: [0xC3,0x83,0xC2,0xA2,0xC3,0xA2,0xE2,0x80,0x9A,0xC2,0xAC] },

  // stray NBSP marker before ASCII space
  { name: "moji_C38220", bytes: [0xC3,0x82,0x20] },

  // middle dot leak
  { name: "moji_C382C2B7", bytes: [0xC3,0x82,0xC2,0xB7] },

  // dash leak variants
  { name: "moji_C382E28094", bytes: [0xC3,0x82,0xE2,0x80,0x94] },
  { name: "moji_C382E28093", bytes: [0xC3,0x82,0xE2,0x80,0x93] },

  // Optional weak signal (disabled to avoid false positives):
  // { name: "weak_C383", bytes: [0xC3,0x83] },
].map(x => ({ name: x.name, needle: Buffer.from(x.bytes) }));

function scanFile(p) {
  const buf = fs.readFileSync(p);
  for (const n of NEEDLES) {
    const at = findFirstNeedle(buf, n.needle);
    if (at >= 0) return { path: p, which: n.name, offset: at };
  }
  return null;
}

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

  console.log("OK: no_mojibake_guard");
}

main();
