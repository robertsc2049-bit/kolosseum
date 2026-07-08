
// DEV NOTE: Human-maintained repo surface. Keep this file aligned with canonical contracts,
// deterministic checks, and developer handover standards. Do not introduce hidden defaults,
// broad discovery, or unreviewed boundary changes.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repo = process.cwd();
const serverPath = path.join(repo, "src", "server.ts");
const serverSrc = fs.readFileSync(serverPath, "utf8");

const gateConst = 'const diagnosticUiEnabled = process.env.KOLOSSEUM_ENABLE_DIAGNOSTIC_UI === "true";';
const gateMiddleware = 'app.use("/ui", (req, res, next) => {';

assert.ok(
  serverSrc.includes(gateConst),
  "expected diagnostic UI env gate constant"
);

assert.ok(
  serverSrc.includes(gateMiddleware),
  "expected /ui middleware gate"
);

assert.match(
  serverSrc,
  /return res\.status\(404\)\.json\(\{ error: "diagnostic_ui_disabled" \}\);/,
  "expected disabled diagnostic UI to return deterministic 404"
);

const gateIndex = serverSrc.indexOf(gateMiddleware);
const uiRegistrations = [
  serverSrc.indexOf('app.use("/ui", express.static'),
  serverSrc.indexOf('app.get("/ui/session/:session_id"'),
  serverSrc.indexOf('app.get("/ui/decision-summary/:run_id"'),
].filter((n) => n >= 0);

assert.ok(uiRegistrations.length > 0, "expected existing /ui registrations to remain present");
assert.ok(
  uiRegistrations.every((idx) => gateIndex < idx),
  "expected diagnostic /ui gate to appear before all /ui static and redirect registrations"
);

console.log("public UI diagnostic route fence contract passed");
