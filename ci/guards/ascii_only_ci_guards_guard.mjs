// @law: Repo Governance
// @severity: medium
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
    die(`[ERR] ascii_only_ci_guards_guard: git ls-files failed\n${err}`.trim());
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

function isTarget(p) {
  // Only enforce ASCII-only on CI guard sources (the place we keep strict hygiene).
  // Note: We intentionally do NOT enforce this globally; other files may legitimately contain Unicode.
  const lower = p.toLowerCase();
  return lower.startsWith("ci/guards/") && lower.endsWith(".mjs");
}

function isAllowedByte(b) {
  // allow: TAB(0x09), LF(0x0A), and printable ASCII 0x20..0x7E
  if (b === 0x09) return true;
  if (b === 0x0A) return true;
  if (b >= 0x20 && b <= 0x7E) return true;
  return false;
}

function hex2(b) {
  return b.toString(16).toUpperCase().padStart(2, "0");
}

function main() {
  const files = gitLsFilesZ().filter(isTarget);

  const offenders = [];
  for (const p of files) {
    let buf;
    try {
      buf = fs.readFileSync(p);
    } catch (e) {
      const msg = String(e?.message ?? e);
      if (/ENOENT/.test(msg)) continue;
      die(`[ERR] ascii_only_ci_guards_guard: failed reading ${p}\n${msg}`.trim());
    }

    for (let i = 0; i < buf.length; i++) {
      const b = buf[i];
      if (!isAllowedByte(b)) {
        offenders.push({ path: p, offset: i, byte: b });
        break; // first hit per file is enough
      }
    }

    if (offenders.length >= 50) break;
  }

  if (offenders.length) {
    console.error("[ERR] Non-ASCII byte(s) detected in ci/guards/*.mjs (TAB/LF/printable ASCII only). Offenders:");
    for (const o of offenders.slice(0, 20)) {
      console.error(`- ${o.path} :: byte=0x${hex2(o.byte)} @ offset=${o.offset}`);
    }
    if (offenders.length > 20) console.error(`(and ${offenders.length - 20} more...)`);
    die("[ERR] ascii_only_ci_guards_guard failed.");
  }

  console.log("OK: ascii_only_ci_guards_guard");
}

main();
