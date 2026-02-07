import { spawnSync } from "node:child_process";
import fs from "node:fs";
import process from "node:process";

function die(msg, code = 1) {
  process.stderr.write(String(msg).trimEnd() + "\n");
  process.exit(code);
}

function ok(msg) {
  process.stdout.write(String(msg).trimEnd() + "\n");
}

function git(args) {
  const r = spawnSync("git", args, { encoding: "utf8", shell: false, windowsHide: true });
  if (r.status !== 0) {
    const out = (r.stdout || "") + (r.stderr || "");
    die(`❌ clean_tree_guard: git ${args.join(" ")} failed\n${out}`.trim(), r.status ?? 1);
  }
  return (r.stdout || "").toString();
}

function canSkipUnderGreen() {
  // Only skip when invoked by GREEN with a nonce proven via a temp-file handshake.
  // This prevents accidental env poisoning (e.g., someone exporting KOLOSSEUM_GREEN_* manually).
  if (process.env.KOLOSSEUM_GREEN !== "1") return false;

  const nonce = process.env.KOLOSSEUM_GREEN_NONCE || "";
  const file = process.env.KOLOSSEUM_GREEN_NONCE_FILE || "";
  if (!nonce || !file) return false;

  try {
    const disk = fs.readFileSync(file, "utf8").trim();
    if (disk !== nonce) return false;
    return true;
  } catch {
    return false;
  }
}

if (canSkipUnderGreen()) {
  ok("OK: clean_tree_guard (skipped: green nonce verified)");
  process.exit(0);
}

const porcelain = git(["status", "--porcelain=v1", "--untracked-files=normal"]).trimEnd();

if (!porcelain) {
  ok("OK: clean_tree_guard (WORKING TREE: CLEAN)");
  process.exit(0);
}

const lines = porcelain.split(/\r?\n/).filter(Boolean);
const limited = lines.slice(0, 200);
const suffix = lines.length > 200 ? `\n... (${lines.length - 200} more)` : "";

die(
  [
    "❌ clean_tree_guard: WORKING TREE: DIRTY (unstaged or untracked)",
    "",
    "Dirty entries:",
    ...limited.map((l) => " " + l),
    suffix,
    "",
    "Fix:",
    "  - stage/commit what you intended, OR",
    "  - discard with: git restore -- . && git clean -fd",
  ].join("\n").trimEnd(),
  1
);