import "dotenv/config";
import express from "express";
import { sessionsRouter } from "./api/sessions.routes.js";
import { blocksRouter } from "./api/blocks.routes.js";
import { VERSION } from "./version.js";

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) =>
  res.json({ status: "ok", version: VERSION })
);
app.use("/sessions", sessionsRouter);
app.use("/blocks", blocksRouter);

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(port, () => console.log(`Kolosseum API listening on :${port}`));


