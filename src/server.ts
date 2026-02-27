// src/server.ts
import express from 'express';

import { sessionsRouter } from './api/sessions.routes.js';
import { blocksRouter } from './api/blocks.routes.js';
import { apiErrorMiddleware } from './api/error_middleware.js';

import { VERSION } from './version.js';

export const app = express();

/**
 * @law: Health Contract
 * @severity: high
 *
 * Must be unauthenticated and must not touch DB.
 * Used by CI + deploy health probes.
 */
app.get('/health', (_req, res) => {
  return res.status(200).json({ status: 'ok', version: VERSION });
});

app.use(express.json({ limit: '1mb' }));

app.use('/sessions', sessionsRouter);
app.use('/blocks', blocksRouter);

app.use(apiErrorMiddleware);