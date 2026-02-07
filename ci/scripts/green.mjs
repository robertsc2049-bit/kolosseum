import { spawnSync } from "node:child_process";
import process from "node:process";

function die(msg, code = 1) {
  process.stderr.write(msg + "\n");
  process.exit(code);
}

function run(cmd, args, label, envExtra = {}) {
  process.stdout.write(`\n== GREEN STEP: ${label} ==\n`);
  const r = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: false,
    env: { ...process.env, ...envExtra },
  });
  if (r.status !== 0) die(`GREEN_FAIL: step '${label}' failed with exit code ${r.status}`, r.status ?? 1);
}

function git(args) {
  const r = spawnSync("git", args, { encoding: "utf8", shell: false });
  if (r.status !== 0) {
    const out = (r.stdout || "") + (r.stderr || "");
    die(`GREEN_FAIL: git ${args.join(" ")} failed\n${out}`.trim(), r.status ?? 1);
  }
  return (r.stdout || "").toString();
}

function porcelain() {
  return git(["status", "--porcelain=v1", "--untracked-files=normal"]);
}

function listUntracked(p) {
  return p
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((l) => l.startsWith("?? "))
    .map((l) => l.slice(3).trim());
}

function invariantClean(label) {
  const p = porcelain();
  if (p.trim().length) {
    const untracked = listUntracked(p);
    const tracked = p
      .split(/\r?\n/)
      .filter(Boolean)
      .filter((l) => !l.startsWith("?? "))
      .map((l) => l.trim());

    const lines = [
      `GREEN_FAIL: working tree became dirty after step '${label}'.`,
      "",
      tracked.length ? "Tracked changes:" : "Tracked changes: (none)",
      ...tracked.map((x) => `  ${x}`),
      "",
      untracked.length ? "New untracked files:" : "New untracked files: (none)",
      ...untracked.map((x) => `  ${x}`),
      "",
      "Action:",
      "- This is treated as an implicit write and is forbidden unless explicitly run in a write mode.",
      "- The offender is the step named above.",
    ];
    die(lines.join("\n"));
  }
}

function ensureStartClean() {
  const p = porcelain();
  if (p.trim().length) {
    die(
      [
        "GREEN_FAIL: working tree is not clean at start.",
        "Refusing to run.",
        "",
        "Run:",
        "  npm run dev:status",
      ].join("\n")
    );
  }
}

// Canonical: single entry point + set KOLOSSEUM_GREEN=1 so sub-commands are allowed.
const env = { KOLOSSEUM_GREEN: "1" };

ensureStartClean();

run("npm", ["run", "lint:fast"], "lint:fast", env);
invariantClean("lint:fast");

run("npm", ["run", "test:unit"], "test:unit", env);
invariantClean("test:unit");

run("npm", ["run", "build:fast"], "build:fast", env);
invariantClean("build:fast");

run("npm", ["run", "dev:fast"], "dev:fast", env);
invariantClean("dev:fast");

process.stdout.write("\nGREEN_OK: all steps passed; tree remained clean.\n");