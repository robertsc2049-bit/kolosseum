import { spawnSync } from "node:child_process";
import { existsSync, statSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function assertNoRendered(out) {
  assert(!out.rendered_text, "rendered_text must NOT exist");
}

function assertHasRendered(out) {
  assert(!!out.rendered_text, "rendered_text must exist");
  assert(Array.isArray(out.rendered_text.lines), "rendered_text.lines must be array");
  assert(out.rendered_text.lines.every((x) => typeof x === "string"), "rendered_text.lines must be string[]");
}

// Build dist if missing or stale vs relevant sources.
// Reason: this test runs `node dist/src/run_pipeline_cli.js` directly.
function ensureBuilt() {
  const distCli = resolve("dist/src/run_pipeline_cli.js");
  const srcCli = resolve("src/run_pipeline_cli.ts");
  const srcPipeline = resolve("src/run_pipeline.ts");
  const srcRenderer = resolve("engine/src/render/session_text.ts");

  const sources = [srcCli, srcPipeline, srcRenderer].filter((p) => existsSync(p));

  if (!existsSync(distCli)) {
    buildNow("dist cli missing");
    return;
  }

  const distMtime = statSync(distCli).mtimeMs;
  const newestSrc = Math.max(...sources.map((p) => statSync(p).mtimeMs));

  if (newestSrc > distMtime) {
    buildNow("dist older than source");
  }
}

function buildNow(reason) {
  let p;

  if (process.platform === "win32") {
    // On this repo, `npm` resolves to npm.ps1 (PowerShell), not npm.cmd.
    // So we must build via PowerShell.
    p = spawnSync(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "npm run build:fast"],
      { encoding: "utf8" }
    );
  } else {
    p = spawnSync("npm", ["run", "build:fast"], { encoding: "utf8" });
  }

  const stderr = (p.stderr ?? "").trim();
  const stdout = (p.stdout ?? "").trim();
  const spawnErr = p.error ? String(p.error) : "";

  assert(
    p.status === 0,
    `build:fast must succeed (${reason}) (status=${p.status})\nspawn_error=\n${spawnErr}\nstdout=\n${stdout}\nstderr=\n${stderr}`
  );
}

function runCli(args, stdinText) {
  // Hermetic env: prevent dev machine env from changing return phase.
  const env = { ...process.env };
  delete env.KOLOSSEUM_RETURN_PHASE;

  const p = spawnSync("node", ["dist/src/run_pipeline_cli.js", ...args], {
    input: stdinText ?? undefined,
    encoding: "utf8",
    env,
  });

  const stdout = (p.stdout ?? "").trim();
  const stderr = (p.stderr ?? "").trim();

  assert(p.status === 0, `cli exit code must be 0 (status=${p.status}) stderr=${stderr}`);
  assert(stdout.length > 0, "stdout must not be empty");

  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error(`stdout must be valid JSON; got: ${stdout}`);
  }

  return { out: parsed, stderr };
}

(function main() {
  ensureBuilt();

  const basePath = "test/fixtures/golden/inputs/vanilla_minimal.json";
  const base = JSON.parse(readFileSync(basePath, "utf8"));
  const debug = { ...base, debug_render_session_text: true };

  const normalRes = runCli([], JSON.stringify(base));
  assert(normalRes.out && typeof normalRes.out === "object", "normal output must be object");
  assert(normalRes.out.ok === true, "normal run must be ok");
  assertNoRendered(normalRes.out);

  const debugRes = runCli([], JSON.stringify(debug));
  assert(debugRes.out && typeof debugRes.out === "object", "debug output must be object");
  assert(debugRes.out.ok === true, "debug run must be ok");
  assertHasRendered(debugRes.out);

  const first = debugRes.out.rendered_text.lines[0];
  const expected = "1) bench_press \u2014 4x5 @ 75% rest 180s";
  assert(first === expected, `unexpected first rendered line: ${first}`);

  console.log("PASS test/cli_runner_rendered_text.test.mjs");
})();
