import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relPath) {
  const full = path.join(root, relPath);
  assert.ok(fs.existsSync(full), `required file missing: ${relPath}`);
  return fs.readFileSync(full, "utf8");
}

function mustNotMatch(text, patterns, label) {
  for (const pattern of patterns) {
    assert.doesNotMatch(text, pattern, `${label} must not include ${pattern}`);
  }
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, acc);
    } else {
      acc.push(full);
    }
  }
  return acc;
}

const truthFiles = [
  "src/api/blocks.handlers.ts",
  "src/api/blocks.routes.ts",
  "src/api/block_compile_write_service.ts",
  "src/api/engine_runner_service.ts",
  "src/api/sessions.handlers.ts",
  "src/api/sessions.routes.ts",
  "src/api/session_state_query_service.ts",
  "src/api/session_state_read_model.ts",
  "src/api/session_state_write_service.ts",
  "test/api_handlers_compile_block_response_allowlist_contract.test.mjs",
  "test/api_session_state_public_trace_contract.regression.test.mjs",
  "test/api_get_session_state_executed_handler_http_contract.test.mjs",
  "test/api_append_runtime_event_executed_handler_http_contract.test.mjs",
  "test/api_start_session_executed_handler_http_contract.test.mjs"
];

const coachNotePatterns = [
  /\bcoach_note\b/i,
  /\bcoach notes\b/i,
  /\bcoachNotes\b/i,
  /\bcoachNote\b/i,
  /\bcoach-notes\b/i,
  /\bcoach_notes\b/i
];

test("P152 contract doc exists and locks the coach-notes truth boundary", () => {
  const src = read("docs/v0/P152_COACH_NOTES_BOUNDARY_PROOF.md");
  assert.match(src, /# P152/);
  assert.match(src, /Coach Notes Boundary Proof/);
  assert.match(src, /Prove coach notes stay completely outside engine truth/);
  assert.match(src, /compile/);
  assert.match(src, /execution/);
  assert.match(src, /session-state factual summary/);
  assert.match(src, /non-authoritative commentary only/);
});

test("P152 compile and execution truth surfaces do not mention coach-note inputs", () => {
  const compileHandlers = read("src/api/blocks.handlers.ts");
  const compileWrite = read("src/api/block_compile_write_service.ts");
  const sessionsHandlers = read("src/api/sessions.handlers.ts");
  const sessionRead = read("src/api/session_state_read_model.ts");
  const sessionWrite = read("src/api/session_state_write_service.ts");

  mustNotMatch(compileHandlers, coachNotePatterns, "src/api/blocks.handlers.ts");
  mustNotMatch(compileWrite, coachNotePatterns, "src/api/block_compile_write_service.ts");
  mustNotMatch(sessionsHandlers, coachNotePatterns, "src/api/sessions.handlers.ts");
  mustNotMatch(sessionRead, coachNotePatterns, "src/api/session_state_read_model.ts");
  mustNotMatch(sessionWrite, coachNotePatterns, "src/api/session_state_write_service.ts");
});

test("P152 public truth contracts do not widen to coach-note fields", () => {
  const allowlist = read("test/api_handlers_compile_block_response_allowlist_contract.test.mjs");
  const publicTrace = read("test/api_session_state_public_trace_contract.regression.test.mjs");
  const getState = read("test/api_get_session_state_executed_handler_http_contract.test.mjs");

  mustNotMatch(allowlist, coachNotePatterns, "compile response allowlist contract");
  mustNotMatch(publicTrace, coachNotePatterns, "session state public trace contract");
  mustNotMatch(getState, coachNotePatterns, "get session state executed handler contract");
});

test("P152 runtime event and session start contracts do not widen to coach-note fields", () => {
  const appendEvent = read("test/api_append_runtime_event_executed_handler_http_contract.test.mjs");
  const startSession = read("test/api_start_session_executed_handler_http_contract.test.mjs");

  mustNotMatch(appendEvent, coachNotePatterns, "append runtime event executed handler contract");
  mustNotMatch(startSession, coachNotePatterns, "start session executed handler contract");
});

test("P152 discovered coach-note files, if any exist, remain separate from engine truth services", () => {
  const candidateFiles = walk(path.join(root, "src"))
    .filter((full) => /\.(ts|tsx|js|mjs|cjs)$/.test(full))
    .filter((full) => {
      const text = fs.readFileSync(full, "utf8");
      return /coach[_\s-]?note|coachNotes|coachNote/i.test(text) || /coach[_\s-]?note|coachNotes|coachNote/i.test(path.basename(full));
    });

  for (const full of candidateFiles) {
    const rel = path.relative(root, full).replace(/\\/g, "/");
    const text = fs.readFileSync(full, "utf8");

    assert.doesNotMatch(
      text,
      /session_state_write_service\.js|session_state_query_service\.js|block_compile_write_service\.js|engine_runner_service\.js/i,
      `coach-note candidate file must not import engine truth services directly: ${rel}`
    );
  }
});

test("P152 truth surfaces remain non-advisory and coach-note free together", () => {
  for (const relPath of truthFiles) {
    const src = read(relPath);
    mustNotMatch(src, coachNotePatterns, relPath);
    assert.doesNotMatch(src, /\brecommend/i, `${relPath} must not recommend`);
    assert.doesNotMatch(src, /\bshould\b/i, `${relPath} must not advise`);
  }
});