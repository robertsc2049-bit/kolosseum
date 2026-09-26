// DEV NOTE: regression proof for a live-reproduced bug - a self-directed
// athlete changed activity via Declarations -> "Change activity" (applied
// immediately), then clicked Today -> "Create session", and the compile
// was sent with the PREVIOUS declaration (old declaration_id, old sport).
// Two independent causes, both covered here:
//  1. app.js's createSession() compiled against the declaration cached at
//     bootstrap, relying on a page reload to refresh it.
//  2. That reload never happened - athlete_onboarding_ui.js's reload guard
//     did location.assign("/app/#/athlete/today") while already on /app/,
//     which is a fragment-only, same-document navigation.
// Bug fix, not a new capability area - no FULL-UI slice number or
// product/ui/function_manifest.json entry is claimed.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { JSDOM, VirtualConsole } from "jsdom";

import { loadCurrentAthleteDeclaration } from "../public/app/account_ui.js";

const root = process.cwd();
const appJs = fs.readFileSync(path.join(root, "public", "app", "app.js"), "utf8");

function declaration(declarationId, activityId) {
  return {
    declaration_id: declarationId,
    engine_phase1_input: { activity_id: activityId, actor_type: "athlete" }
  };
}

test("loadCurrentAthleteDeclaration returns the server's current declaration, not a cached one", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), method: init?.method });
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        account: { user_id: "u1", actor_type: "athlete" },
        bootstrap: { declaration_record: declaration("decl_new", "hyrox") }
      })
    };
  };

  try {
    const current = await loadCurrentAthleteDeclaration();

    assert.deepEqual(calls, [{ url: "/account/session", method: "GET" }]);
    assert.equal(current.declaration_record.declaration_id, "decl_new");
    assert.equal(current.phase1_input.activity_id, "hyrox");
  }
  finally {
    globalThis.fetch = originalFetch;
  }
});

test("loadCurrentAthleteDeclaration reports a missing declaration as null rather than throwing", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ account: {}, bootstrap: {} })
  });

  try {
    assert.deepEqual(await loadCurrentAthleteDeclaration(), {
      declaration_record: null,
      phase1_input: null
    });
  }
  finally {
    globalThis.fetch = originalFetch;
  }
});

test("createSession re-reads the current declaration before building the compile body", () => {
  const body = appJs.slice(
    appJs.indexOf("async function createSession()"),
    appJs.indexOf("\n}\n", appJs.indexOf("async function createSession()"))
  );

  const refreshAt = body.indexOf("await refreshAthleteDeclaration()");
  const activityCheckAt = body.indexOf("if (!state.phase1Input?.activity_id)");
  const compileAt = body.indexOf("/blocks/compile?create_session=true");

  assert.ok(refreshAt > 0, "createSession must refresh the declaration");
  assert.ok(refreshAt < activityCheckAt, "refresh must precede the activity check");
  assert.ok(refreshAt < compileAt, "refresh must precede the compile request");

  const helper = appJs.slice(
    appJs.indexOf("async function refreshAthleteDeclaration()"),
    appJs.indexOf("async function createSession()")
  );
  assert.match(helper, /await loadCurrentAthleteDeclaration\(\)/u);
  assert.match(helper, /state\.declarationRecord =/u);
  assert.match(helper, /state\.phase1Input =/u);
});

test("the post-change reload guard really reloads when the app is already at /app/", async () => {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => errors.push(String(error.message)));

  const dom = new JSDOM(
    `<!doctype html><button class="nav-item" data-view="today" id="todayNav">Today</button>`,
    { url: "http://localhost:3000/app/#/athlete/onboarding", virtualConsole }
  );
  const { window } = dom;

  const saved = {};
  for (const key of ["document", "location", "history", "sessionStorage", "localStorage"]) {
    saved[key] = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value: window[key], configurable: true, writable: true });
  }

  try {
    const { installAthleteOnboardingUi } = await import("../public/app/athlete_onboarding_ui.js");
    installAthleteOnboardingUi();

    window.sessionStorage.setItem("kolosseum.athlete_onboarding.reload_required", "1");
    window.document.getElementById("todayNav").click();

    assert.equal(window.location.href, "http://localhost:3000/app/#/athlete/today");
    assert.equal(window.sessionStorage.getItem("kolosseum.athlete_onboarding.reload_required"), null);
    // jsdom can't perform a real navigation - it reports every non-hash one
    // as "not implemented". A fragment-only location.assign() would NOT
    // raise this, so its presence proves a genuine reload was requested.
    assert.ok(
      errors.some((message) => /navigation/iu.test(message)),
      `expected a real (non-fragment) navigation, got: ${JSON.stringify(errors)}`
    );
  }
  finally {
    for (const [key, descriptor] of Object.entries(saved)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
    window.close();
  }
});
