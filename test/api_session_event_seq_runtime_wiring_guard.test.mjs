// DEV NOTE: Human-maintained repo surface. Keep this file aligned with canonical contracts,
// deterministic checks, and developer handover standards. Do not introduce hidden defaults,
// broad discovery, or unreviewed boundary changes.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

test("runtime session event seq wiring: write service imports and validates allocNextSeq", async () => {
  const source = await fs.readFile("src/api/session_state_write_service.ts", "utf8");

  assert.match(
    source,
    /import\s+\{\s*assertNextSessionEventSequence\s*\}\s+from\s+"\.\.\/domain\/session_event_sequence\.js";/,
    "session_state_write_service.ts must import assertNextSessionEventSequence from the domain helper"
  );

  assert.match(
    source,
    /const nextSeq = Number\(r\.rows\?\.\[0\]\?\.next_seq\);[\s\S]*?if \(!Number\.isFinite\(nextSeq\) \|\| nextSeq < 1\) \{[\s\S]*?\}[\s\S]*?assertNextSessionEventSequence\(nextSeq - 1, nextSeq\);[\s\S]*?return nextSeq;/,
    "expected allocNextSeq to validate the allocated next_seq before returning it"
  );
});

test("S-V0-13 source contract: append path allocates runtime seq before event insert", async () => {
  const source = await fs.readFile("src/api/session_state_write_service.ts", "utf8");

  assert.match(
    source,
    /async function allocNextSeq\(client: any, session_id: string\): Promise<number>[\s\S]*?INSERT INTO session_event_seq\(session_id, next_seq\)[\s\S]*?VALUES \(\$1, 0\)[\s\S]*?UPDATE session_event_seq[\s\S]*?SET next_seq = next_seq \+ 1[\s\S]*?RETURNING next_seq[\s\S]*?assertNextSessionEventSequence\(nextSeq - 1, nextSeq\);[\s\S]*?return nextSeq;/,
    "allocNextSeq must initialise at 0, atomically increment, validate exact next seq, and return the allocated seq"
  );

  const startBody = source.match(/export async function startSessionMutation[\s\S]*?export async function appendRuntimeEventMutation/)?.[0] ?? "";
  assert.match(
    startBody,
    /const seq = await allocNextSeq\(client, session_id\);[\s\S]*?INSERT INTO runtime_events\(session_id, seq, event\)/,
    "startSessionMutation must allocate seq before START_SESSION insert"
  );

  const appendBody = source.match(/export async function appendRuntimeEventMutation[\s\S]*$/)?.[0] ?? "";
  assert.match(
    appendBody,
    /const seq = await allocNextSeq\(client, session_id\);[\s\S]*?INSERT INTO runtime_events\(session_id, seq, event\)/,
    "appendRuntimeEventMutation must allocate seq before runtime event insert"
  );
});

test("S-V0-13 source contract: rejected append paths happen before seq allocation", async () => {
  const source = await fs.readFile("src/api/session_state_write_service.ts", "utf8");
  const appendBody = source.match(/export async function appendRuntimeEventMutation[\s\S]*$/)?.[0] ?? "";

  const validateEventIndex = appendBody.indexOf("validateWireRuntimeEvent");
  const replayDecisionIndex = appendBody.indexOf("ensureResolvedReturnDecisionReplayRejected");
  const replayExerciseIndex = appendBody.indexOf("ensureExerciseReplayRejected");
  const applyIndex = appendBody.indexOf("applyWireEvent");
  const allocIndex = appendBody.indexOf("const seq = await allocNextSeq(client, session_id);");

  assert.ok(validateEventIndex >= 0, "append path must validate wire event before seq allocation");
  assert.ok(replayDecisionIndex >= 0, "append path must reject resolved return-decision replay before seq allocation");
  assert.ok(replayExerciseIndex >= 0, "append path must reject resolved exercise replay before seq allocation");
  assert.ok(applyIndex >= 0, "append path must apply the event before seq allocation");
  assert.ok(allocIndex >= 0, "append path must allocate seq");

  assert.ok(validateEventIndex < allocIndex, "wire validation must happen before seq allocation");
  assert.ok(replayDecisionIndex < allocIndex, "return-decision replay rejection must happen before seq allocation");
  assert.ok(replayExerciseIndex < allocIndex, "exercise replay rejection must happen before seq allocation");
  assert.ok(applyIndex < allocIndex, "engine/application mutation check must happen before seq allocation");
});