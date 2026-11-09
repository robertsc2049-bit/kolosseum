// Server error alerts (src/api/server_error_alerts.ts) against a real
// database: a 5xx from any handler is recorded without personal data, the
// admin's first email goes straight away, later ones at most hourly, and the
// admin console summary counts the last 24 hours.
import assert from "node:assert/strict";
import test from "node:test";
import express from "express";

import { pool } from "../dist/src/db/pool.js";
import { apiErrorMiddleware } from "../dist/src/api/error_middleware.js";
import { recordServerErrors, runServerErrorDigest, serverErrorSummary } from "../dist/src/api/server_error_alerts.js";

test.after(() => pool.end());

const until = async (check) => {
  for (let i = 0; i < 50; i += 1) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("timed out");
};

test("server errors are recorded, emailed at most hourly, and summarised for the console", { timeout: 60000 }, async (t) => {
  // Own the table for this test: the digest reads every row.
  const saved = (await pool.query(`SELECT * FROM server_error_events`)).rows;
  await pool.query(`DELETE FROM server_error_events`);
  const app = express();
  app.use(recordServerErrors);
  app.use(express.json());
  const router = express.Router();
  router.get("/sessions/:session_id/sets", () => { throw new Error("duplicate key value violates unique constraint Key (email)=(someone@example.com)"); });
  router.get("/fine", (_request, response) => response.status(200).json({ ok: true }));
  router.get("/not-found", (_request, response) => response.status(404).json({ ok: false, error: "not_found" }));
  router.get("/unavailable", (_request, response) => response.status(503).json({ ok: false, error: "messaging_unavailable" }));
  app.use("/account", router);
  app.use(apiErrorMiddleware);
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await pool.query(`DELETE FROM server_error_events`);
    for (const row of saved) {
      await pool.query(`INSERT INTO server_error_events (event_id, occurred_at, method, route, status, error_code, alerted_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [row.event_id, row.occurred_at, row.method, row.route, row.status, row.error_code, row.alerted_at]);
    }
  });
  const count = async () => Number((await pool.query(`SELECT count(*) FROM server_error_events`)).rows[0].count);

  // The person still gets the normal error response.
  const failed = await fetch(`${base}/account/sessions/sess_8f7e6d5c4b3a2/sets?token=abc`);
  assert.equal(failed.status, 500);
  await fetch(`${base}/account/sessions/sess_1a2b3c4d5e6f7/sets`);
  await fetch(`${base}/account/unavailable`);
  assert.equal((await fetch(`${base}/account/fine`)).status, 200);
  assert.equal((await fetch(`${base}/account/not-found`)).status, 404);
  await until(async () => (await count()) === 3);

  const rows = (await pool.query(`SELECT method, route, status, error_code, alerted_at FROM server_error_events ORDER BY route, occurred_at`)).rows;
  assert.deepEqual(rows.map((r) => [r.method, r.route, r.status, r.error_code]), [
    ["GET", "/account/sessions/:session_id/sets", 500, "INTERNAL"],
    ["GET", "/account/sessions/:session_id/sets", 500, "INTERNAL"],
    ["GET", "/account/unavailable", 503, "messaging_unavailable"]
  ], "only 5xx; the route pattern instead of ids, no query string, and not the exception's message");
  assert.ok(!JSON.stringify(rows).includes("someone@example.com"));

  const sent = [];
  const send = async (subject, lines) => { sent.push({ subject, lines }); };
  const start = new Date();
  assert.equal(await runServerErrorDigest({ send, now: start }), 3, "the first email goes straight away");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].subject, "Kolosseum: 3 server errors on the live app");
  assert.ok(sent[0].lines.some((line) => line.startsWith("- GET /account/sessions/:session_id/sets - INTERNAL (500): 2,")));
  assert.equal(await runServerErrorDigest({ send, now: new Date(start.getTime() + 1000) }), 0, "nothing new");

  await fetch(`${base}/account/unavailable`);
  await until(async () => (await count()) === 4);
  assert.equal(await runServerErrorDigest({ send, now: new Date(start.getTime() + 30 * 60 * 1000) }), 0, "waits for the hour");
  assert.equal(sent.length, 1);
  assert.equal(await runServerErrorDigest({ send, now: new Date(start.getTime() + 61 * 60 * 1000) }), 1, "then sends what's new");
  assert.equal(sent.length, 2);
  assert.equal(sent[1].subject, "Kolosseum: 1 server error on the live app");

  const summary = await serverErrorSummary(pool, new Date(start.getTime() + 61 * 60 * 1000));
  assert.equal(summary.last_24h, 4);
  assert.deepEqual(summary.groups.map((g) => [g.route, g.count]), [["/account/unavailable", 2], ["/account/sessions/:session_id/sets", 2]], "commonest first, the latest first on a tie");
  assert.equal((await serverErrorSummary(pool, new Date(start.getTime() + 25 * 3600 * 1000))).last_24h, 0, "only the last 24 hours");

  // Kept 30 days.
  await runServerErrorDigest({ send, now: new Date(start.getTime() + 31 * 86_400_000) });
  assert.equal(await count(), 0);
});
