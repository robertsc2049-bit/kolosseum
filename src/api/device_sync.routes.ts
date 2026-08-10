// DEV NOTE: FULL-UI-31 / S-V1-P-06 - device sync routes, mounted at
// /device-sync. Athlete identity is resolved via a local
// authenticatedAthlete helper mirroring the identical pattern already
// duplicated in body_metrics.routes.ts and habit_tracking.routes.ts.
// Connect/disconnect/ingest are athlete-self only (simulated - no
// redirect to any real provider, no live SDK call anywhere in this
// file); the coach-facing surface is deliberately read-only, mirroring
// body_metrics.routes.ts's coach sub-path convention.

import {
  Router,
  type NextFunction,
  type Request,
  type Response
} from "express";

import {
  PRODUCT_SESSION_COOKIE,
  ProductAccountError,
  assertProductCsrf,
  resolveProductSession
} from "./product_account_service.js";
import { forbidden, unauthorized } from "./http_errors.js";
import { authenticatedCoach, cookieValue } from "./coach_session_auth.js";
import {
  DeviceSyncError,
  connectDevice,
  disconnectDevice,
  ingestDeviceMetric,
  listDeviceConnectionsForAthlete,
  listDeviceConnectionsForCoach,
  listDeviceMetricHistoryForAthlete,
  listDeviceMetricHistoryForCoach
} from "./device_sync_service.js";

export const deviceSyncRouter = Router();

type AsyncHandler = (
  request: Request,
  response: Response,
  next: NextFunction
) => Promise<unknown>;

function asyncHandler(handler: AsyncHandler) {
  return (request: Request, response: Response, next: NextFunction): void => {
    handler(request, response, next).catch(next);
  };
}

async function authenticatedAthlete(request: Request, mutation: boolean): Promise<string> {
  const rawToken = cookieValue(request, PRODUCT_SESSION_COOKIE);
  if (!rawToken) {
    throw unauthorized("ACCOUNT_SESSION_REQUIRED", { failure_token: "account_session_missing" });
  }

  try {
    if (mutation) {
      assertProductCsrf(rawToken, request.get("x-kolosseum-csrf"));
    }
    const session = await resolveProductSession(rawToken);
    if (session.account_row.actor_type !== "athlete") {
      throw forbidden("ATHLETE_ACCOUNT_REQUIRED", { failure_token: "athlete_account_required" });
    }
    return session.account_row.user_id;
  }
  catch (error) {
    if (error instanceof ProductAccountError) {
      if (error.status === 401) {
        throw unauthorized("ACCOUNT_SESSION_REQUIRED", { failure_token: error.code });
      }
      throw forbidden("ACCOUNT_ACTION_DENIED", { failure_token: error.code });
    }
    throw error;
  }
}

deviceSyncRouter.post(
  "/connect",
  asyncHandler(async (request, response) => {
    const athleteUserId = await authenticatedAthlete(request, true);
    const record = await connectDevice(athleteUserId, request.body ?? {});
    return response.status(201).json({ ok: true, connection: record });
  })
);

deviceSyncRouter.post(
  "/disconnect",
  asyncHandler(async (request, response) => {
    const athleteUserId = await authenticatedAthlete(request, true);
    const connectionId = (request.body ?? {}).connection_id;
    const record = await disconnectDevice(athleteUserId, String(connectionId ?? ""));
    return response.status(200).json({ ok: true, connection: record });
  })
);

deviceSyncRouter.post(
  "/ingest",
  asyncHandler(async (request, response) => {
    const athleteUserId = await authenticatedAthlete(request, true);
    const record = await ingestDeviceMetric(athleteUserId, request.body ?? {});
    return response.status(201).json({ ok: true, entry: record });
  })
);

deviceSyncRouter.get(
  "/connections",
  asyncHandler(async (request, response) => {
    const athleteUserId = await authenticatedAthlete(request, false);
    const connections = await listDeviceConnectionsForAthlete(athleteUserId);
    return response.status(200).json({ ok: true, connections });
  })
);

deviceSyncRouter.get(
  "/connections/coach/:athlete_user_id",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, false);
    const connections = await listDeviceConnectionsForCoach(coachUserId, String(request.params.athlete_user_id));
    return response.status(200).json({ ok: true, connections });
  })
);

deviceSyncRouter.get(
  "/metrics",
  asyncHandler(async (request, response) => {
    const athleteUserId = await authenticatedAthlete(request, false);
    const entries = await listDeviceMetricHistoryForAthlete(athleteUserId);
    return response.status(200).json({ ok: true, entries });
  })
);

deviceSyncRouter.get(
  "/metrics/coach/:athlete_user_id",
  asyncHandler(async (request, response) => {
    const coachUserId = await authenticatedCoach(request, false);
    const entries = await listDeviceMetricHistoryForCoach(coachUserId, String(request.params.athlete_user_id));
    return response.status(200).json({ ok: true, entries });
  })
);

deviceSyncRouter.use(
  (error: unknown, _request: Request, response: Response, next: NextFunction) => {
    if (error instanceof DeviceSyncError) {
      response.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
);
