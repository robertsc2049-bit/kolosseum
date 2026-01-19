import { Router } from "express";
import {
  createBlock,
  getBlock,
  createSessionForBlock,
  getSessionForBlock
} from "./blocks.handlers.js";

export const blocksRouter = Router();

blocksRouter.post("/", createBlock);
blocksRouter.get("/:block_id", getBlock);

// session creation scoped to a block
blocksRouter.post("/:block_id/sessions", createSessionForBlock);
blocksRouter.get("/:block_id/sessions/:session_id", getSessionForBlock);
