import { spawnSync } from "node:child_process";
import fs from "node:fs";

function runCli(args, stdinText) {
  const p = spawnSync("node", ["dist/src/run_pipeline_cli.js", ...args], {
    input: stdinText ?? undefined,
    encoding: "utf8",
  });

  // stdout must always be JSON per contract
  let parsed;
  try {
    parsed = JSON.parse(p.stdout);
  } catch (e) {
    throw new Error(
      `CLI stdout was not valid JSON.\nexit=${p.status}\nstdout=\n${p.stdout}\nstderr=\n${p.stderr}`
    );
  }

  return { status: p.status, out: parsed, stdout: p.stdout, stderr: p.stderr };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function assertNoRendered(out) {
  assert(!Object.prototype.hasOwnProperty.call(out, "rendered_text"), "rendered_text must be absent");
}

function assertHasRendered(out) {
  assert(Object.prototype.hasOwnProperty.call(out, "rendered_text"), "rendered_text must exist");
  const rt = out.rendered_text;
  assert(rt && typeof rt === "object", "rendered_text must be an object");
  assert(typeof rt.title === "string", "rendered_text.title must be string");
  assert(Array.isArray(rt.lines), "rendered_text.lines must be array");
  assert(rt.lines.every((x) => typeof x === "string"), "rendered_text.lines must be string[]");
  assert(Array.isArray(rt.warnings), "rendered_text.warnings must be array");
}

function loadJson(path) {
  const raw = fs.readFileSync(path);
  const s = raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf ? raw.slice(3).toString("utf8") : raw.toString("utf8");
  return JSON.parse(s);
}

function writeJson(path, obj) {
  fs.writeFileSync(path, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

(function main() {
  // Build two inputs:
  // - normal hello_world.json
  // - debug variant via flag at top-level
  const base = loadJson("examples/hello_world.json");
  const debug = { ...base, debug_render_session_text: true };

  // Run via stdin to ensure stdin path also strips BOM and supports flags
  const normalRes = runCli([], JSON.stringify(base));
  assert(normalRes.out && typeof normalRes.out === "object", "normal output must be object");
  assert(normalRes.out.ok === true, "normal run must be ok");
  assertNoRendered(normalRes.out);

  const debugRes = runCli([], JSON.stringify(debug));
  assert(debugRes.out && typeof debugRes.out === "object", "debug output must be object");
  assert(debugRes.out.ok === true, "debug run must be ok");
  assertHasRendered(debugRes.out);

  // Deterministic first line check for hello_world
  const first = debugRes.out.rendered_text.lines[0];
  assert(first === "1) bench_press — 3x5", `unexpected first rendered line: ${first}`);

  console.log("PASS test/cli_runner_rendered_text.test.mjs");
})();
