// The /sessions access gate's wiring (src/api/sessions_access_gate.ts),
// pinned without a database: behaviour is proven in
// sessions_access_gate_persistent.integration.test.mjs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("the gate runs before every router mounted at /sessions", () => {
  const server = read("src/server.ts");
  const gate = server.indexOf('app.use("/sessions", sessionsAccessGate);');
  assert.ok(gate > 0, "mounted");
  assert.ok(gate < server.indexOf('app.use("/sessions", sessionsRouter);'));
  assert.ok(gate < server.indexOf('app.use("/sessions", beta17CoachNoteWriteRouter);'));
  assert.ok(server.indexOf("app.use(express.json(") < gate, "after the body parser, so it can read the ids in the body");
});

test("the test harness can never open the routes in production", () => {
  const gate = read("src/api/sessions_access_gate.ts");
  assert.match(gate, /return process\.env\.NODE_ENV !== "production" && process\.env\.KOLOSSEUM_SESSIONS_TEST_HARNESS === "1";/u);
  for (const file of ["docker-compose.prod.yml", "deploy/env.production.example"]) {
    assert.doesNotMatch(read(file), /KOLOSSEUM_SESSIONS_TEST_HARNESS/u, file);
  }
});

test("a coach can only invite or revoke, on the server and in the panel", () => {
  assert.match(read("src/api/sessions_access_gate.ts"), /const COACH_RELATIONSHIP_STATES: ReadonlySet<string> = new Set\(\["invited", "revoked"\]\);/u);
  const panel = read("public/app-src/screens/coach/ConnectAthletePanel.tsx");
  assert.doesNotMatch(panel, /Accepted connection/u);
  assert.match(read("public/app-src/screens/coach/useConnectAthlete.ts"), /relationship_state: "invited",/u);
});

test("compile, blocks, reviews and assignment changes are gated before their routers", () => {
  const server = read("src/server.ts");
  const coachGate = server.indexOf('app.use("/coach-workspace", accessGateRateLimit, coachIdentityGate);');
  assert.ok(coachGate > 0 && coachGate < server.indexOf('app.use("/coach-workspace", coachWorkspaceRouter);'));
  assert.ok(coachGate < server.indexOf('app.use("/coach-workspace", productAssignmentRouter);'));
  assert.ok(coachGate < server.indexOf('app.use("/coach-workspace", productReviewRouter);'));
  const blocksGate = server.indexOf('app.use("/blocks", accessGateRateLimit, blocksAccessGate);');
  assert.ok(blocksGate > 0 && blocksGate < server.indexOf('app.use("/blocks", blocksRouter);'));
  const gate = read("src/api/coach_and_blocks_access_gate.ts");
  assert.ok(gate.includes("reviews|session-review") && gate.includes("athlete-assignment") && gate.includes("(?:replace|cancel)"), "reviews, session review and assignment replace/cancel are covered");
});
