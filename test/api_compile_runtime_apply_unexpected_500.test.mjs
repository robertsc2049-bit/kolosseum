 // test/api_compile_runtime_apply_unexpected_500.test.mjs
 import test, { mock } from "node:test";
 import assert from "node:assert/strict";

 // Requires: node --test --experimental-test-module-mocks
 // Mock by absolute dist URLs to avoid relative resolution surprises.

 const distPoolUrl = new URL("../dist/src/db/pool.js", import.meta.url).href;
 const distHttpErrorsUrl = new URL("../dist/src/api/http_errors.js", import.meta.url).href;
 const distHandlerUrl = new URL("../dist/src/api/blocks.handlers.js", import.meta.url).href;

 mock.module(distPoolUrl, {
   namedExports: {
     pool: {
       connect: async () => {
         const client = {
           query: async (sql) => {
             const s = String(sql);
             if (/BEGIN/i.test(s)) return { rowCount: 0, rows: [] };
             if (/COMMIT/i.test(s)) return { rowCount: 0, rows: [] };
             if (/ROLLBACK/i.test(s)) return { rowCount: 0, rows: [] };

             if (/INSERT INTO blocks/i.test(s)) {
               return { rowCount: 1, rows: [{ block_id: "b_test" }] };
             }

             return { rowCount: 0, rows: [] };
           },
           release: () => {}
         };
         return client;
       }
     }
   }
 });

 mock.module(distHttpErrorsUrl, {
   namedExports: {
     badRequest: (msg, meta) => Object.assign(new Error(msg), { status: 400, meta }),
     notFound: (msg, meta) => Object.assign(new Error(msg), { status: 404, meta }),
     internalError: (msg, meta) => Object.assign(new Error(msg), { status: 500, meta })
   }
 });

 mock.module("@kolosseum/engine/phases/phase1.js", {
   namedExports: { phase1Validate: () => ({ ok: true, canonical_input: { activity: "general_strength" } }) }
 });
 mock.module("@kolosseum/engine/phases/phase2.js", {
   namedExports: {
     phase2CanonicaliseAndHash: () => ({
       ok: true,
       phase2: { phase2_canonical_json: "{}", phase2_hash: "h", canonical_input_hash: "c" }
     })
   }
 });
 mock.module("@kolosseum/engine/phases/phase3.js", {
   namedExports: { phase3ResolveConstraintsAndLoadRegistries: () => ({ ok: true, phase3: {} }) }
 });
 mock.module("@kolosseum/engine/phases/phase4.js", {
   namedExports: { phase4AssembleProgram: () => ({ ok: true, program: { plan: [] } }) }
 });
 mock.module("@kolosseum/engine/phases/phase6.js", {
   namedExports: {
     phase6ProduceSessionOutput: () => ({
       ok: true,
       session: { session_id: "s_planned", exercises: [{ exercise_id: "ex1" }] }
     })
   }
 });

 mock.module("@kolosseum/engine/runtime/session_summary.js", {
   namedExports: { validateWireRuntimeEvent: (x) => x }
 });

 mock.module("@kolosseum/engine/runtime/apply_runtime_event.js", {
   namedExports: {
     applyRuntimeEvents: () => {
       throw new Error("SOME_UNEXPECTED_ENGINE_BUG");
     }
   }
 });

 const { compileBlock } = await import(distHandlerUrl);

 test("POST /blocks/compile returns 500 when runtime apply throws unexpected error (no 4xx misclassification)", async () => {
   const req = {
     body: { phase1_input: { any: "thing" }, runtime_events: [{ type: "ANY" }] },
     query: {},
     get: () => undefined
   };

   const res = {
     _status: null,
     _json: null,
     status(code) { this._status = code; return this; },
     json(payload) { this._json = payload; return this; }
   };

   let err;
   try {
     await compileBlock(req, res);
   } catch (e) {
     err = e;
   }

   assert.ok(err, "expected handler to throw");
   const status = err.status ?? err.statusCode;
   assert.equal(status, 500, `expected 500, got ${status}`);
 });