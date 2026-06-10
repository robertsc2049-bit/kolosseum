import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

function run(cmd) {
  try {
    execSync(cmd, { stdio: "pipe" });
    return { ok: true, out: "" };
  } catch (e) {
    const out =
      (e?.stdout ? e.stdout.toString("utf8") : "") +
      (e?.stderr ? e.stderr.toString("utf8") : "");
    return { ok: false, out };
  }
}

function die(msg) {
  process.stderr.write(String(msg).trimEnd() + "\n");
  process.exit(1);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kolosseum-artefacts-"));
const rel = "ci/artefacts/bad_artefacts.json";
const abs = path.join(tmp, rel);

fs.mkdirSync(path.dirname(abs), { recursive: true });

// invalid: version wrong + empty groups + missing decision keys + CRLF content
const bad = "{\r\n  \"version\": 2,\r\n  \"groups\": [],\r\n  \"decision\": {}\r\n}\r\n";
fs.writeFileSync(abs, bad, { encoding: "utf8" });

const cmd = `node ci/guards/artefacts_map_guard.mjs --path "${abs.replace(/\\/g, "/")}"`;
const r = run(cmd);

if (r.ok) die("Expected artefacts_map_guard to FAIL on invalid artefacts json, but it passed.");

process.stdout.write("OK: negative test proves guard fails on invalid artefacts map\n");
