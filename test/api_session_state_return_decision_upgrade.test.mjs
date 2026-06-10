 // test/api_session_state_return_decision_upgrade.test.mjs
 import test, { mock } from "node:test";
 import assert from "node:assert/strict";

 // Requires: node --test --experimental-test-module-mocks
 // We mock by absolute dist URLs so Node can resolve modules deterministically.

 const calls = [];

 const distPoolUrl = new URL("../dist/src/db/pool.js", import.meta.url).href;
 const distHttpErrorsUrl = new URL("../dist/src/api/http_errors.js", import.meta.url).href;
 const distHandlerUrl = new URL("../dist/src/api/sessions.handlers.js", import.meta.url).href;

 mock.module(distPoolUrl, {
   namedExports: {
     pool: {
       connect: async () => {
         const client = {
           query: async (sql, params) => {
             calls.push({ sql: String(sql), params });

             // loadSession() query in getSessionState()
             if (/SELECT session_id, planned_session, session_state_summary\s+FROM sessions\s+WHERE session_id = \$1/i.test(String(sql))) {
               return {
                 rowCount: 1,
                 rows: [
                   {
                     session_id: "s_test",
                     planned_session: {
                       exercises: [{ exercise_id: "ex1", source: "program" }],
                       notes: []
                     },
                     // Legacy runtime: split_active exists; explicit return_decision_* missing
                     session_state_summary: {
                       started: true,
                       runtime: {
                         split_active: true,
                         remaining_ids: ["ex1"],
                         completed_ids: [],
                         skipped_ids: []
                       }
                     }
                   }
                 ]
               };
             }

             // upgrade UPDATE
             if (/UPDATE sessions\s+SET session_state_summary = \$2::jsonb/i.test(String(sql))) {
               return { rowCount: 1, rows: [] };
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

 mock.module("@kolosseum/engine/runtime/session_summary.js", {
   namedExports: {
     normalizeSummary: (_planned, rawSummary) => {
       // API must still upgrade contract fields even if engine says no upgrade needed
       return { summary: rawSummary, needsUpgrade: false };
     },
     deriveTrace: (summary) => {
       const rt = summary?.runtime ?? {};
       return {
         started: summary?.started === true,
         remaining_ids: Array.isArray(rt.remaining_ids) ? rt.remaining_ids : [],
         completed_ids: Array.isArray(rt.completed_ids) ? rt.completed_ids : [],
         dropped_ids: Array.isArray(rt.skipped_ids) ? rt.skipped_ids : []
       };
     },
     applyWireEvent: () => { throw new Error("not used"); },
     validateWireRuntimeEvent: () => null
   }
 });

 mock.module(distHttpErrorsUrl, {
   namedExports: {
     badRequest: (msg, meta) => Object.assign(new Error(msg), { status: 400, meta }),
     notFound: (msg, meta) => Object.assign(new Error(msg), { status: 404, meta }),
     upstreamBadGateway: (msg, meta) => Object.assign(new Error(msg), { status: 502, meta }),
     internalError: (msg, meta) => Object.assign(new Error(msg), { status: 500, meta })
   }
 });

 const { getSessionState } = await import(distHandlerUrl);

 test("GET /sessions/:id/state upgrades legacy split_active into explicit return_decision_* contract (no response-time inference)", async () => {
   const req = { params: { session_id: "s_test" } };
   const res = {
     _json: null,
     json(payload) { this._json = payload; return this; }
   };

   await getSessionState(req, res);

   assert.ok(res._json, "expected json response");
   assert.equal(res._json.trace.return_decision_required, true);
   assert.deepEqual(res._json.trace.return_decision_options, ["RETURN_CONTINUE", "RETURN_SKIP"]);

   const didUpgrade = calls.some(c => /UPDATE sessions\s+SET session_state_summary = \$2::jsonb/i.test(c.sql));
   assert.equal(didUpgrade, true, "expected session_state_summary upgrade to be persisted");
 });