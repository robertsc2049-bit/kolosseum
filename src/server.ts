// src/server.ts
import express from "express";
import path from "node:path";

import { sessionsRouter } from "./api/sessions.routes.js";
import { blocksRouter } from "./api/blocks.routes.js";
import { apiErrorMiddleware } from "./api/error_middleware.js";

import { VERSION } from "./version.js";

export const app = express();

/**
 * @law: Health Contract
 * @severity: high
 *
 * Must be unauthenticated and must not touch DB.
 * Used by CI + deploy health probes.
 */
app.get("/health", (_req, res) => {
  return res.status(200).json({ status: "ok", version: VERSION });
});

app.use(express.json({ limit: "1mb" }));

/**
 * Minimal built-in UI (static, no framework)
 * - /ui/session.html?session_id=...
 * - /ui/session/:session_id (redirect convenience)
 * - /ui/decision-summary.html?run_id=...
 * - /ui/decision-summary/:run_id (redirect convenience)
 */
const publicDir = path.resolve(process.cwd(), "public");
app.use("/ui", express.static(publicDir));

app.get("/ui/session/:session_id", (req, res) => {
  const sid = String(req.params.session_id ?? "").trim();
  if (!sid) return res.redirect("/ui/session.html");
  return res.redirect(`/ui/session.html?session_id=${encodeURIComponent(sid)}`);
});

app.get("/ui/decision-summary/:run_id", (req, res) => {
  const runId = String(req.params.run_id ?? "").trim();
  if (!runId) return res.redirect("/ui/decision-summary.html");
  return res.redirect(`/ui/decision-summary.html?run_id=${encodeURIComponent(runId)}`);
});

app.use("/sessions", sessionsRouter);
app.use("/blocks", blocksRouter);

app.use(apiErrorMiddleware);
