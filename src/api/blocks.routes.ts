import { Router } from "express";
import {
  compileBlock,
  getBlock,
  createSessionFromBlock,
  listBlockSessions
} from "./blocks.handlers.js";

export const blocksRouter = Router();

// compile is the ONLY block creation path
blocksRouter.post("/compile", compileBlock);

// read block
blocksRouter.get("/:block_id", getBlock);

// sessions are always created from an existing block
blocksRouter.post("/:block_id/sessions", createSessionFromBlock);
blocksRouter.get("/:block_id/sessions", listBlockSessions);

