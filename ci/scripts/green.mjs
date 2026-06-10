import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

function die(msg, code = 1) {
  process.stderr.write(String(msg).trimEnd() + "\n");
  process.exit(code);
}

function run(cmd, args, label, opts = {}) {
  process.stdout.write(`\n== GREEN STEP: ${label} ==\n`);
  // If a step asks to run "node", prefer the current Node binary.
  // GitHub Actions can surface ENOENT when spawning "node" by name.
  if (cmd === "node" || cmd === "node.exe") cmd = process.execPath;

  const r = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: false,
    env: opts.env ?? process.env,
    windowsHide: true,
  });

  if (r.status === null) {
    const bits = [
      `GREEN_FAIL: step '${label}' produced no exit code (status=null).`,
      `cmd: ${cmd} ${args.join(" ")}`,
      r.signal ? `signal: ${r.signal}` : "signal: (none)",
      r.error ? `error: ${r.error.message || String(r.error)}` : "error: (none)",
      "",
      "This is almost always a spawn/exec failure on this platform.",
    ];
    die(bits.join("\n"), 1);
  }

  if (r.status !== 0) {
    die(`GREEN_FAIL: step '${label}' failed with exit code ${r.status}`, r.status ?? 1);
  }
}

function runNpm(scriptName, envExtra = {}) {
  const env = { ...process.env, ...envExtra };

  // Windows: go through cmd.exe for npm to avoid spawn EINVAL edge cases.
  if (process.platform === "win32") {
    const comspec = process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe";
    run(comspec, ["/d", "/s", "/c", `npm run ${scriptName}`], `npm run ${scriptName}`, { env });
    return;
  }

  run("npm", ["run", scriptName], `npm run ${scriptName}`, { env });
}

function git(args) {
  const r = spawnSync("git", args, { encoding: "utf8", shell: false, windowsHide: true });
  if (r.status !== 0) {
    const out = (r.stdout || "") + (r.stderr || "");
    die(`GREEN_FAIL: git ${args.join(" ")} failed\n${out}`.trim(), r.status ?? 1);
  }
  return (r.stdout || "").toString();
}

function porcelain() {
  return git(["status", "--porcelain=v1", "--untracked-files=normal"]);
}

function splitLines(p) {
  return p.split(/\r?\n/).filter(Boolean);
}

function hasUntracked(lines) {
  return lines.some((l) => l.startsWith("?? "));
}

function hasUnstaged(lines) {
  // XY: X=index, Y=working tree
  return lines.some((l) => l.length >= 2 && l[1] !== " ");
}

function prettyList(title, items) {
  const out = [title];
  if (!items.length) out.push("  (none)");
  else for (const it of items) out.push("  " + it);
  return out.join("\n");
}

function assertStartStateAllowed(baseLines) {
  if (hasUntracked(baseLines) || hasUnstaged(baseLines)) {
    const untracked = baseLines.filter((l) => l.startsWith("?? "));
    const unstaged = baseLines.filter((l) => !l.startsWith("?? ") && l.length >= 2 && l[1] !== " ");
    die(
      [
        "GREEN_FAIL: start state is not allowed.",
        "",
        prettyList("Untracked files (forbidden):", untracked),
        "",
        prettyList("Unstaged changes (forbidden):", unstaged),
        "",
        "Fix:",
        "- Staged changes are allowed.",
        "- Untracked + unstaged are forbidden.",
      ].join("\n")
    );
  }
}

function diffSets(baseLines, nowLines) {
  const b = new Set(baseLines);
  const n = new Set(nowLines);
  const added = [...n].filter((x) => !b.has(x)).sort();
  const removed = [...b].filter((x) => !n.has(x)).sort();
  return { added, removed };
}

function assertNoImplicitWrites(stepLabel, basePorcelain) {
  const now = porcelain();
  if (now === basePorcelain) return;

  const baseLines = splitLines(basePorcelain);
  const nowLines = splitLines(now);
  const { added, removed } = diffSets(baseLines, nowLines);

  const msg = [
    `GREEN_FAIL: repo state changed after step '${stepLabel}'.`,
    "",
    "This is an implicit write and is forbidden unless behind an explicit --write mode.",
    "",
    prettyList("New status lines:", added),
    "",
    prettyList("Missing status lines:", removed),
    "",
    prettyList("Untracked now:", nowLines.filter((l) => l.startsWith("?? "))),
    "",
    `Offender: step '${stepLabel}'.`,
  ].join("\n");

  die(msg, 1);
}

function makeGreenNonceHandshake() {
  const nonce = crypto.randomBytes(18).toString("hex"); // 36 chars
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kolosseum-green-"));
  const file = path.join(dir, "nonce.txt");
  fs.writeFileSync(file, nonce + "\n", { encoding: "utf8" });
  return { nonce, file, dir };
}

// Baseline: allow staged index; forbid unstaged/untracked.
const base = porcelain();
const baseLines = splitLines(base);
assertStartStateAllowed(baseLines);

// Mint a per-run nonce handshake so clean_tree_guard can skip safely during sub-steps.
const hs = makeGreenNonceHandshake();

const env = {
  KOLOSSEUM_GREEN: "1",
  KOLOSSEUM_GREEN_NONCE: hs.nonce,
  KOLOSSEUM_GREEN_NONCE_FILE: hs.file,
};

try {
  // Run sequence (authoritative)
  runNpm("lint:fast", env);
  assertNoImplicitWrites("lint:fast", base);

  runNpm("test:unit", env);
  assertNoImplicitWrites("test:unit", base);

  runNpm("build:fast", env);
  assertNoImplicitWrites("build:fast", base);

  runNpm("dev:fast", env);
  assertNoImplicitWrites("dev:fast", base);

  process.stdout.write("\nGREEN_OK: all steps passed; repo state unchanged from baseline.\n");
} finally {
  // Best-effort cleanup of temp handshake
  try { fs.rmSync(hs.dir, { recursive: true, force: true }); } catch {}
}
