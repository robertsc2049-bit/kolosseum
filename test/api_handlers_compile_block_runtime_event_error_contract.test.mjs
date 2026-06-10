import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("compileBlock source contract: runtime event validation and apply failures preserve explicit error contracts", () => {
  const repo = process.cwd();
  const file = path.join(repo, "src", "api", "blocks.handlers.ts");
  const src = fs.readFileSync(file, "utf8");

  assert.match(
    src,
    /if\s*\(!Array\.isArray\(raw\)\)\s*throw badRequest\("Invalid runtime_events\/events \(expected array\)"\);/,
    "expected non-array runtime_events/events to be rejected with the explicit badRequest contract"
  );

  assert.match(
    src,
    /throw badRequest\("Invalid runtime_events\/events \(event failed validation\)",\s*\{\s*index:\s*i\s*\}\);/,
    "expected invalid runtime event objects to preserve indexed badRequest validation feedback"
  );

  assert.match(
    src,
    /if\s*\(msg\.startsWith\("PHASE6_RUNTIME_AWAIT_RETURN_DECISION"\)\)\s*\{\s*throw badRequest\("Runtime event rejected \(await return decision\)",\s*\{[\s\S]*failure_token:\s*"phase6_runtime_await_return_decision"[\s\S]*cause:\s*msg[\s\S]*\}\);\s*\}/,
    "expected await-return-decision engine failure to map to explicit badRequest contract"
  );

  assert.match(
    src,
    /if\s*\(msg\.startsWith\("PHASE6_RUNTIME_UNKNOWN_EVENT"\)\)\s*\{\s*throw badRequest\("Runtime event rejected \(unknown event type\)",\s*\{[\s\S]*failure_token:\s*"phase6_runtime_unknown_event"[\s\S]*cause:\s*msg[\s\S]*\}\);\s*\}/,
    "expected unknown-event engine failure to map to explicit badRequest contract"
  );

  assert.match(
    src,
    /if\s*\(msg\.startsWith\("PHASE6_RUNTIME_INVALID_EVENT"\)\)\s*\{\s*throw badRequest\("Runtime event rejected \(invalid event shape\)",\s*\{[\s\S]*failure_token:\s*"phase6_runtime_invalid_event"[\s\S]*cause:\s*msg[\s\S]*\}\);\s*\}/,
    "expected invalid-event engine failure to map to explicit badRequest contract"
  );

  assert.match(
    src,
    /throw internalError\("Runtime apply failed \(unexpected engine error\)",\s*\{\s*cause:\s*msg\s*\}\);/,
    "expected unexpected runtime apply failures to map to internalError with cause"
  );
});