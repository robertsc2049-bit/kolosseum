import { spawnSync } from "node:child_process";
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

// If GREEN has already validated baseline + enforces "no implicit writes" after each step,
// re-checking clean tree in every sub-step is redundant noise.
if (process.env.KOLOSSEUM_GREEN === "1" && process.env.KOLOSSEUM_GREEN_BASELINE_CLEAN === "1") {
  ok("OK: clean_tree_guard (skipped: green baseline clean verified)");
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