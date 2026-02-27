// src/server.ts
import express from "express";
import { sessionsRouter } from "./api/sessions.routes.js";
import { blocksRouter } from "./api/blocks.routes.js";
import { apiErrorMiddleware } from "./api/error_middleware.js";

export const app = express();

app.use(express.json({ limit: "1mb" }));

app.use("/sessions", sessionsRouter);
app.use("/blocks", blocksRouter);

// Single error contract (must be last)
app.use(apiErrorMiddleware);