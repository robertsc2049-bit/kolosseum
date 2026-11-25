// Opening the app in one request (src/api/opening.routes.ts): what is asked
// for, as whom, and what is left out.
import assert from "node:assert/strict";
import test from "node:test";

import { collectOpening, openingPaths } from "../dist/src/api/opening.routes.js";

const session = (actor_type, user_id) => ({ status: 200, payload: { account: { actor_type, user_id } } });
function asker(answers) {
  const asked = [];
  const ask = async (method, path, body) => {
    asked.push(`${method} ${path}${body ? ` ${JSON.stringify(body)}` : ""}`);
    const answer = answers[`${method} ${path}`];
    if (answer instanceof Error) throw answer;
    return answer ?? { status: 200, payload: {} };
  };
  return { ask, asked };
}

test("signed out: only the session's own answer, and nothing else is asked", async () => {
  const { ask, asked } = asker({ "GET /account/session": { status: 401, payload: { error: "account_session_missing" } } });
  assert.deepEqual(await collectOpening(ask), { "GET /account/session": { status: 401, payload: { error: "account_session_missing" } } });
  assert.deepEqual(asked, ["GET /account/session"]);
});

test("an athlete gets Today, with the open session's state, and no coach's reads", async () => {
  const { ask, asked } = asker({
    "GET /account/session": session("athlete", "athlete_1"),
    "POST /sessions/beta-athlete-today": { status: 200, payload: { session: { session_id: "s 1" } } }
  });
  const reads = await collectOpening(ask);
  assert.ok(reads['POST /sessions/beta-athlete-today {"athlete_user_id":"athlete_1"}']);
  assert.ok(reads["GET /sessions/s%201/state"], "the session Today opens");
  assert.ok(reads["GET /account/onboarding/readiness"]);
  assert.equal(asked.some((entry) => /coach_user_id|\/templates|reviews|package-members/u.test(entry)), false);
});

test("a coach gets the Overview for themselves, with the maxes of the first six athletes they coach", async () => {
  const relationships = [...Array.from({ length: 8 }, (_, i) => ({ athlete_user_id: `a${i}`, relationship_state: "accepted" })), { athlete_user_id: "left", relationship_state: "revoked" }];
  relationships[0].relationship_expired = true;
  const { ask, asked } = asker({
    "GET /account/session": session("coach", "coach_1"),
    "GET /coach-workspace/relationships?coach_user_id=coach_1": { status: 200, payload: { relationships } }
  });
  const reads = await collectOpening(ask);
  assert.ok(reads["GET /coach-workspace/reviews?coach_user_id=coach_1"]);
  assert.deepEqual(asked.filter((entry) => entry.includes("strength-profile")).map((entry) => entry.split("=").pop()), ["a1", "a2", "a3", "a4", "a5", "a6"]);
  assert.equal(asked.some((entry) => /beta-athlete|onboarding\//u.test(entry)), false);
});

test("a failing or broken read is left out, so the page asks for it itself; a refusal is passed on", async () => {
  const { ask } = asker({
    "GET /account/session": session("athlete", "athlete_1"),
    "GET /weekly-checkins": { status: 500, payload: { error: "internal_error" } },
    "GET /check-ins/mine": new Error("timed out"),
    "GET /check-ins/slots": { status: 403, payload: { error: "no" } }
  });
  const reads = await collectOpening(ask);
  assert.equal("GET /weekly-checkins" in reads, false);
  assert.equal("GET /check-ins/mine" in reads, false);
  assert.equal(reads["GET /check-ins/slots"].status, 403);
  assert.ok(reads["GET /account/detail"]);
});

test("only reads, only fixed paths on this server, for the signed-in person's own id", () => {
  for (const role of ["athlete", "coach"]) {
    for (const [method, path, body] of openingPaths(role, "x/../y")) {
      assert.ok(path.startsWith("/") && !path.startsWith("//"), path);
      if (method === "POST") {
        assert.ok(["/sessions/beta-athlete-today", "/sessions/beta-athlete-history"].includes(path), path);
        assert.deepEqual(body, { athlete_user_id: "x/../y" });
      }
      else assert.equal(path.includes("x/../y"), false, "the id is encoded");
    }
  }
  assert.deepEqual(openingPaths("org_owner", "o"), []);
});

test("no route is applied, or the address changed, before the server has said who this is", async () => {
  const fs = await import("node:fs");
  const route = fs.readFileSync(new URL("../public/app/route_bootstrap.js", import.meta.url), "utf8");
  const apply = route.slice(route.indexOf("async function applyProductRouteNow"));
  assert.ok(apply.indexOf('getElementById("appShell")?.hidden) return false') < apply.indexOf("readRole()"), "the stored role is only read once the workspace is shown");
  assert.match(route, /if \(replace && !lastAppliedHash\) return;/u);
});
