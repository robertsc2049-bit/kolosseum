import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const repoRoot = process.cwd();

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function normalizeWhitespace(value) {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function requireMatch(source, pattern, label) {
  assert.match(source, pattern, `Expected ${label} to match ${pattern}`);
}

function collectSnapshot(files) {
  const contents = {};
  for (const [key, relativePath] of Object.entries(files)) {
    const absolutePath = path.join(repoRoot, relativePath);
    assert.ok(fs.existsSync(absolutePath), `Expected repo file to exist: ${relativePath}`);
    contents[key] = normalizeWhitespace(readRepoFile(relativePath));
  }

  const srcBlocksHandlers = contents.blocksHandlersTs;
  const srcBlockQuery = contents.blockQueryTs;
  const srcBlockSessionWrite = contents.blockSessionWriteTs;
  const srcSessionsHandlers = contents.sessionsHandlersTs;
  const srcSessionStateQuery = contents.sessionStateQueryTs;
  const srcSessionEventsQuery = contents.sessionEventsQueryTs;

  const distBlocksHandlers = contents.blocksHandlersJs;
  const distSessionsHandlers = contents.sessionsHandlersJs;

  requireMatch(srcBlocksHandlers, /\bgetBlockByIdQuery\b/, "src/api/blocks.handlers.ts");
  requireMatch(srcBlocksHandlers, /\bcreateSessionFromBlockMutation\b/, "src/api/blocks.handlers.ts");
  requireMatch(srcBlocksHandlers, /\bexport\s+(?:async\s+)?function\s+getBlock\b|\bexport\s+const\s+getBlock\b/, "src/api/blocks.handlers.ts");
  requireMatch(srcBlocksHandlers, /\bexport\s+(?:async\s+)?function\s+createSessionFromBlock\b|\bexport\s+const\s+createSessionFromBlock\b/, "src/api/blocks.handlers.ts");

  requireMatch(srcBlockQuery, /\bexport\s+(?:async\s+)?function\s+getBlockByIdQuery\b|\bexport\s+const\s+getBlockByIdQuery\b/, "src/api/block_query_service.ts");
  requireMatch(srcBlockSessionWrite, /\bexport\s+(?:async\s+)?function\s+createSessionFromBlockMutation\b|\bexport\s+const\s+createSessionFromBlockMutation\b/, "src/api/block_session_write_service.ts");

  requireMatch(srcSessionsHandlers, /\bgetSessionStateQuery\b/, "src/api/sessions.handlers.ts");
  requireMatch(srcSessionsHandlers, /\blistRuntimeEventsQuery\b/, "src/api/sessions.handlers.ts");
  requireMatch(srcSessionsHandlers, /\bexport\s+(?:async\s+)?function\s+getSessionState\b|\bexport\s+const\s+getSessionState\b/, "src/api/sessions.handlers.ts");
  requireMatch(srcSessionsHandlers, /\bexport\s+(?:async\s+)?function\s+listRuntimeEvents\b|\bexport\s+const\s+listRuntimeEvents\b/, "src/api/sessions.handlers.ts");

  requireMatch(srcSessionStateQuery, /\bexport\s+(?:async\s+)?function\s+getSessionStateQuery\b|\bexport\s+const\s+getSessionStateQuery\b/, "src/api/session_state_query_service.ts");
  requireMatch(srcSessionEventsQuery, /\bexport\s+(?:async\s+)?function\s+listRuntimeEventsQuery\b|\bexport\s+const\s+listRuntimeEventsQuery\b/, "src/api/session_events_query_service.ts");

  requireMatch(distBlocksHandlers, /\bgetBlockByIdQuery\b/, "dist/src/api/blocks.handlers.js");
  requireMatch(distBlocksHandlers, /\bcreateSessionFromBlockMutation\b/, "dist/src/api/blocks.handlers.js");
  requireMatch(distSessionsHandlers, /\bgetSessionStateQuery\b/, "dist/src/api/sessions.handlers.js");
  requireMatch(distSessionsHandlers, /\blistRuntimeEventsQuery\b/, "dist/src/api/sessions.handlers.js");

  return {
    sourceHashes: Object.fromEntries(
      Object.entries(contents).map(([key, value]) => [key, sha256(value)])
    ),
    seamProof: {
      src: {
        persistedBlockReadbackDelegatesToQuery: /\bgetBlockByIdQuery\b/.test(srcBlocksHandlers),
        createSessionDelegatesToPersistedBlockMutation: /\bcreateSessionFromBlockMutation\b/.test(srcBlocksHandlers),
        stateReadbackDelegatesToQuery: /\bgetSessionStateQuery\b/.test(srcSessionsHandlers),
        eventsReadbackDelegatesToQuery: /\blistRuntimeEventsQuery\b/.test(srcSessionsHandlers)
      },
      dist: {
        persistedBlockReadbackDelegatesToQuery: /\bgetBlockByIdQuery\b/.test(distBlocksHandlers),
        createSessionDelegatesToPersistedBlockMutation: /\bcreateSessionFromBlockMutation\b/.test(distBlocksHandlers),
        stateReadbackDelegatesToQuery: /\bgetSessionStateQuery\b/.test(distSessionsHandlers),
        eventsReadbackDelegatesToQuery: /\blistRuntimeEventsQuery\b/.test(distSessionsHandlers)
      }
    },
    exportSurfaceProof: {
      srcBlocksGetBlockExported: /\bexport\s+(?:async\s+)?function\s+getBlock\b|\bexport\s+const\s+getBlock\b/.test(srcBlocksHandlers),
      srcBlocksCreateSessionFromBlockExported: /\bexport\s+(?:async\s+)?function\s+createSessionFromBlock\b|\bexport\s+const\s+createSessionFromBlock\b/.test(srcBlocksHandlers),
      srcSessionsGetSessionStateExported: /\bexport\s+(?:async\s+)?function\s+getSessionState\b|\bexport\s+const\s+getSessionState\b/.test(srcSessionsHandlers),
      srcSessionsListRuntimeEventsExported: /\bexport\s+(?:async\s+)?function\s+listRuntimeEvents\b|\bexport\s+const\s+listRuntimeEvents\b/.test(srcSessionsHandlers)
    }
  };
}

test("v0 restart-chain wiring: persisted block -> create-session-from-block -> state/events remains wired across repeated fresh artifact reads", async () => {
  const files = {
    blocksHandlersTs: "src/api/blocks.handlers.ts",
    blockQueryTs: "src/api/block_query_service.ts",
    blockSessionWriteTs: "src/api/block_session_write_service.ts",
    sessionsHandlersTs: "src/api/sessions.handlers.ts",
    sessionStateQueryTs: "src/api/session_state_query_service.ts",
    sessionEventsQueryTs: "src/api/session_events_query_service.ts",
    blocksHandlersJs: "dist/src/api/blocks.handlers.js",
    sessionsHandlersJs: "dist/src/api/sessions.handlers.js"
  };

  const snapshotA = collectSnapshot(files);
  const snapshotB = collectSnapshot(files);

  assert.deepEqual(snapshotB, snapshotA);
  assert.equal(sha256(JSON.stringify(snapshotB)), sha256(JSON.stringify(snapshotA)));

  assert.equal(snapshotA.seamProof.src.persistedBlockReadbackDelegatesToQuery, true);
  assert.equal(snapshotA.seamProof.src.createSessionDelegatesToPersistedBlockMutation, true);
  assert.equal(snapshotA.seamProof.src.stateReadbackDelegatesToQuery, true);
  assert.equal(snapshotA.seamProof.src.eventsReadbackDelegatesToQuery, true);

  assert.equal(snapshotA.seamProof.dist.persistedBlockReadbackDelegatesToQuery, true);
  assert.equal(snapshotA.seamProof.dist.createSessionDelegatesToPersistedBlockMutation, true);
  assert.equal(snapshotA.seamProof.dist.stateReadbackDelegatesToQuery, true);
  assert.equal(snapshotA.seamProof.dist.eventsReadbackDelegatesToQuery, true);

  assert.equal(snapshotA.exportSurfaceProof.srcBlocksGetBlockExported, true);
  assert.equal(snapshotA.exportSurfaceProof.srcBlocksCreateSessionFromBlockExported, true);
  assert.equal(snapshotA.exportSurfaceProof.srcSessionsGetSessionStateExported, true);
  assert.equal(snapshotA.exportSurfaceProof.srcSessionsListRuntimeEventsExported, true);
});