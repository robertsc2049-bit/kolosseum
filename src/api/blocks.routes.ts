import { Router } from "express";
import {
  compileBlock,
  createBlock,
  getBlock,
  createSessionFromBlock,
  listBlockSessions
} from "./blocks.handlers.js";

export const blocksRouter = Router();

blocksRouter.post("/compile", compileBlock);
blocksRouter.post("/", createBlock);
blocksRouter.get("/:block_id", getBlock);
blocksRouter.post("/:block_id/sessions", createSessionFromBlock);
blocksRouter.get("/:block_id/sessions", listBlockSessions);

