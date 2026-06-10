import test, { mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const repo = process.cwd();
const handlersSourcePath = path.join(repo, "src", "api", "sessions.handlers.ts");
const handlersSource = await fs.readFile(handlersSourcePath, "utf8");

function parseNamedRuntimeImports(source) {
  const importRegex = /import\s+\{\s*([^}]+)\s*\}\s+from\s+"(\.\/[^"]+\.js)"/g;
  const imports = new Map();

  for (const match of source.matchAll(importRegex)) {
    const rawSymbols = match[1];
    const specifier = match[2];
    const symbols = rawSymbols
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => part.replace(/\s+as\s+\w+$/, "").trim());

    imports.set(specifier, symbols);
  }

  return imports;
}

function getImportSpecifierForSymbol(imports, symbol) {
  for (const [specifier, symbols] of imports.entries()) {
    if (symbols.includes(symbol)) {
      return specifier;
    }
  }

  throw new Error(`Could not find import specifier for symbol: ${symbol}`);
}

function toDistModuleUrl(specifier) {
  return new URL(`../dist/src/api/${specifier.replace("./", "")}`, import.meta.url).href;
}

function makeSupportedActivityResponse(activity) {
  const exercisesByActivity = {
    powerlifting: ["squat", "bench_press"],
    rugby_union: ["trap_bar_deadlift", "bench_press"],
    general_strength: ["deadlift", "row"]
  };

  const exerciseIds = exercisesByActivity[activity];
  if (!exerciseIds) {
    return {
      ok: true,
      session: { exercises: [] },
      trace: { source: "mock-unsupported-activity", activity }
    };
  }

  return {
    ok: true,
    session: {
      exercises: exerciseIds.map((exercise_id) => ({
        exercise_id,
        source: "program"
      }))
    },
    trace: {
      source: "mock-supported-activity",
      activity
    }
  };
}

const imports = parseNamedRuntimeImports(handlersSource);
const planSessionServiceSpecifier = getImportSpecifierForSymbol(imports, "planSessionService");
const planSessionServiceCalls = [];

for (const [specifier, symbols] of imports.entries()) {
  const moduleUrl = toDistModuleUrl(specifier);

  if (specifier === planSessionServiceSpecifier) {
    mock.module(moduleUrl, {
      namedExports: {
        planSessionService: async (input) => {
          planSessionServiceCalls.push(input);

          const serviceOut = makeSupportedActivityResponse(input?.user?.activity);
          return {
            ok: true,
            result: {
              session: serviceOut.session
            },
            trace: serviceOut.trace
          };
        }
      }
    });
    continue;
  }

  const namedExports = Object.fromEntries(
    symbols.map((symbol) => [
      symbol,
      async () => ({ ok: true, mocked_symbol: symbol })
    ])
  );

  mock.module(moduleUrl, { namedExports });
}

const { planSession } = await import("../dist/src/api/sessions.handlers.js");

function makeReq(body) {
  return { body };
}

function makeRes() {
  return {
    statusCode: 200,
    jsonBody: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.jsonBody = payload;
      return this;
    }
  };
}

function assertSupportedActivityContract(payload, activity) {
  assert.equal(payload?.ok, true, `expected ok=true for activity ${activity}`);
  assert.ok(payload?.session, `expected session object for activity ${activity}`);
  assert.ok(Array.isArray(payload.session.exercises), `expected session.exercises array for activity ${activity}`);
  assert.ok(payload.session.exercises.length > 0, `expected non-empty session.exercises for activity ${activity}`);

  for (const exercise of payload.session.exercises) {
    assert.equal(typeof exercise.exercise_id, "string", `expected exercise_id string for activity ${activity}`);
    assert.ok(exercise.exercise_id.length > 0, `expected non-empty exercise_id for activity ${activity}`);
  }
}

test("plan-session-api preserves supported activity contract end-to-end across powerlifting rugby_union and general_strength without DATABASE_URL dependency", async () => {
  planSessionServiceCalls.length = 0;

  const supportedActivities = [
    "powerlifting",
    "rugby_union",
    "general_strength"
  ];

  for (const activity of supportedActivities) {
    const input = {
      user: { activity },
      constraints: {
        available_equipment: ["barbell", "bench", "dumbbell"],
        session_minutes: 45
      }
    };

    const req = makeReq({ input });
    const res = makeRes();

    await planSession(req, res);

    assert.equal(res.statusCode, 200, `expected HTTP 200 for activity ${activity}`);
    assertSupportedActivityContract(res.jsonBody, activity);
  }

  assert.equal(planSessionServiceCalls.length, supportedActivities.length, "expected one service delegation per supported activity request");
  assert.deepEqual(
    planSessionServiceCalls.map((input) => input.user.activity),
    supportedActivities,
    "expected supported activity requests to delegate in order"
  );
});

test("plan-session-api supported activities do not fall through to stub-like empty exercise output", async () => {
  const supportedActivities = [
    "powerlifting",
    "rugby_union",
    "general_strength"
  ];

  for (const activity of supportedActivities) {
    const req = makeReq({
      input: {
        user: { activity },
        constraints: {
          available_equipment: ["barbell", "bench"],
          session_minutes: 30
        }
      }
    });
    const res = makeRes();

    await planSession(req, res);

    assert.equal(res.statusCode, 200, `expected HTTP 200 for activity ${activity}`);
    assert.equal(res.jsonBody?.ok, true, `expected ok=true for activity ${activity}`);
    assert.ok(Array.isArray(res.jsonBody?.session?.exercises), `expected exercises array for activity ${activity}`);
    assert.ok(res.jsonBody.session.exercises.length > 0, `supported activity ${activity} should not produce empty exercises`);
  }
});
