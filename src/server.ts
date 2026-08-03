
// DEV NOTE: Application source surface. Keep product/UI behaviour separated from deterministic
// engine truth. UI, notes, and workflow convenience must not change canonical engine inputs or
// outputs unless routed through an explicit validated contract.

// src/server.ts
import express from "express";
import path from "node:path";

import { sessionsRouter } from "./api/sessions.routes.js";
import { beta17CoachNoteWriteRouter } from "./api/beta17_coach_note_write.routes.js";
import { blocksRouter } from "./api/blocks.routes.js";
import { templatesRouter } from "./api/templates.routes.js";
import { coachWorkspaceRouter } from "./api/coach_workspace.routes.js";
import { productAssignmentRouter } from "./api/product_assignment.routes.js";
import { productReviewRouter } from "./api/product_review.routes.js";
import { productAccountRouter } from "./api/product_account.routes.js";
import { productNotificationRouter } from "./api/product_notification.routes.js";
import { productSupportRouter } from "./api/product_support.routes.js";
import { athleteOnboardingRouter } from "./api/athlete_onboarding.routes.js";
import { coachOnboardingRouter } from "./api/coach_onboarding.routes.js";
import { productCommercialRouter } from "./api/product_commercial.routes.js";
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
const productAppDir = path.join(publicDir, "app");

/**
 * Product application surface.
 *
 * /app is the production-shaped browser workspace. It uses the public
 * application API and must not expose diagnostic state or engine internals.
 */
app.get("/", (_req, res) => {
  return res.redirect(302, "/app/");
});
app.use("/app", express.static(productAppDir));
/**
 * Local diagnostic UI gate.
 *
 * The /ui files are retained for explicit local inspection only.
 * They are disabled unless KOLOSSEUM_ENABLE_DIAGNOSTIC_UI=true.
 */
const diagnosticUiEnabled = process.env.KOLOSSEUM_ENABLE_DIAGNOSTIC_UI === "true";

app.use("/ui", (req, res, next) => {
  if (diagnosticUiEnabled) return next();
  return res.status(404).json({ error: "diagnostic_ui_disabled" });
});
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

app.use("/account/commercial", productCommercialRouter);
app.use("/account/coach-onboarding", coachOnboardingRouter);
app.use("/account/onboarding", athleteOnboardingRouter);
app.use("/account", productAccountRouter);
app.use("/account", productNotificationRouter);
app.use("/account", productSupportRouter);
app.use("/templates", templatesRouter);
app.use("/coach-workspace", coachWorkspaceRouter);
app.use("/coach-workspace", productAssignmentRouter);
app.use("/coach-workspace", productReviewRouter);
app.use("/sessions", sessionsRouter);
app.use("/sessions", beta17CoachNoteWriteRouter);
app.use("/blocks", blocksRouter);

app.use(apiErrorMiddleware);
