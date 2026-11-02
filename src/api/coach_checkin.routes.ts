// DEV NOTE: Check-in call routes (coach_checkin_service.ts), mounted at
// /check-ins. Coach routes resolve the coach from their session
// (authenticatedCoach); athlete routes resolve the athlete the same way -
// neither trusts a client-supplied user id for who is acting.
import { Router, type NextFunction, type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";

import { PRODUCT_SESSION_COOKIE, ProductAccountError, assertProductCsrf, resolveProductSession } from "./product_account_service.js";
import { forbidden, unauthorized } from "./http_errors.js";
import { authenticatedCoach, cookieValue } from "./coach_session_auth.js";
import { accountRateLimitKey } from "./rate_limit_key.js";
import {
  CoachCheckinError,
  cancelCheckin,
  getCoachCallSettings,
  listAthleteCheckins,
  listCoachCheckinsForAthlete,
  moveCheckin,
  respondToCheckin,
  saveCoachCallSettings,
  scheduleCheckin
} from "./coach_checkin_service.js";
import {
  addAvailabilityBlock,
  addDayOff,
  athleteBookableSlots,
  bookSlot,
  cancelOwnBooking,
  getCoachAvailability,
  removeAvailabilityBlock,
  removeDayOff
} from "./coach_availability_service.js";
import {
  cancelUpcomingForUnpaid,
  endAthletePackage,
  getAthletePackageForCoach,
  listCoachPackageMembers,
  recordPackagePayment,
  startAthletePackage
} from "./package_membership_service.js";

export const coachCheckinRouter = Router();

type AsyncHandler = (request: Request, response: Response, next: NextFunction) => Promise<unknown>;

function asyncHandler(handler: AsyncHandler) {
  return (request: Request, response: Response, next: NextFunction): void => {
    handler(request, response, next).catch(next);
  };
}

async function authenticatedAthlete(request: Request, mutation: boolean): Promise<string> {
  const rawToken = cookieValue(request, PRODUCT_SESSION_COOKIE);
  if (!rawToken) throw unauthorized("ACCOUNT_SESSION_REQUIRED", { failure_token: "account_session_missing" });
  try {
    if (mutation) assertProductCsrf(rawToken, request.get("x-kolosseum-csrf"));
    const session = await resolveProductSession(rawToken);
    if (session.account_row.actor_type !== "athlete") throw forbidden("ATHLETE_ACCOUNT_REQUIRED", { failure_token: "athlete_account_required" });
    return session.account_row.user_id;
  }
  catch (error) {
    if (error instanceof ProductAccountError) {
      if (error.status === 401) throw unauthorized("ACCOUNT_SESSION_REQUIRED", { failure_token: error.code });
      throw forbidden("ACCOUNT_ACTION_DENIED", { failure_token: error.code });
    }
    throw error;
  }
}

const readLimit = rateLimit({ keyGenerator: accountRateLimitKey, windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false });
const writeLimit = rateLimit({ keyGenerator: accountRateLimitKey, windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false });

// How the coach's athletes reach them for a call.
coachCheckinRouter.get("/call-settings", readLimit, asyncHandler(async (request, response) => {
  const coachUserId = await authenticatedCoach(request, false);
  return response.status(200).json(await getCoachCallSettings(coachUserId));
}));

coachCheckinRouter.put("/call-settings", writeLimit, asyncHandler(async (request, response) => {
  const coachUserId = await authenticatedCoach(request, true);
  return response.status(200).json(await saveCoachCallSettings(coachUserId, request.body));
}));

// The hours the coach is free for check-in calls, and their days off
// (coach_availability_service.ts).
coachCheckinRouter.get("/availability", readLimit, asyncHandler(async (request, response) => {
  const coachUserId = await authenticatedCoach(request, false);
  return response.status(200).json(await getCoachAvailability(coachUserId));
}));

coachCheckinRouter.post("/availability/blocks", writeLimit, asyncHandler(async (request, response) => {
  const coachUserId = await authenticatedCoach(request, true);
  return response.status(201).json(await addAvailabilityBlock(coachUserId, request.body));
}));

coachCheckinRouter.delete("/availability/blocks/:block_id", writeLimit, asyncHandler(async (request, response) => {
  const coachUserId = await authenticatedCoach(request, true);
  return response.status(200).json(await removeAvailabilityBlock(coachUserId, String(request.params.block_id)));
}));

coachCheckinRouter.post("/availability/days-off", writeLimit, asyncHandler(async (request, response) => {
  const coachUserId = await authenticatedCoach(request, true);
  return response.status(201).json(await addDayOff(coachUserId, request.body));
}));

coachCheckinRouter.delete("/availability/days-off/:day_off_id", writeLimit, asyncHandler(async (request, response) => {
  const coachUserId = await authenticatedCoach(request, true);
  return response.status(200).json(await removeDayOff(coachUserId, String(request.params.day_off_id)));
}));

// The coach's check-ins with one athlete, and booking new ones.
coachCheckinRouter.get("/athletes/:athlete_user_id", readLimit, asyncHandler(async (request, response) => {
  const coachUserId = await authenticatedCoach(request, false);
  return response.status(200).json(await listCoachCheckinsForAthlete(coachUserId, request.params.athlete_user_id));
}));

// The athlete's package with this coach (package_membership_service.ts):
// put them on one, record a payment, end it, or - payment due - cancel every
// upcoming call and in-person session.
coachCheckinRouter.get("/package-members", readLimit, asyncHandler(async (request, response) => {
  const coachUserId = await authenticatedCoach(request, false);
  return response.status(200).json(await listCoachPackageMembers(coachUserId));
}));

coachCheckinRouter.get("/athletes/:athlete_user_id/package", readLimit, asyncHandler(async (request, response) => {
  const coachUserId = await authenticatedCoach(request, false);
  return response.status(200).json(await getAthletePackageForCoach(coachUserId, request.params.athlete_user_id));
}));

coachCheckinRouter.put("/athletes/:athlete_user_id/package", writeLimit, asyncHandler(async (request, response) => {
  const coachUserId = await authenticatedCoach(request, true);
  return response.status(200).json(await startAthletePackage(coachUserId, request.params.athlete_user_id, request.body));
}));

coachCheckinRouter.post("/athletes/:athlete_user_id/package/payment", writeLimit, asyncHandler(async (request, response) => {
  const coachUserId = await authenticatedCoach(request, true);
  return response.status(200).json(await recordPackagePayment(coachUserId, request.params.athlete_user_id, request.body));
}));

coachCheckinRouter.post("/athletes/:athlete_user_id/package/end", writeLimit, asyncHandler(async (request, response) => {
  const coachUserId = await authenticatedCoach(request, true);
  return response.status(200).json(await endAthletePackage(coachUserId, request.params.athlete_user_id));
}));

coachCheckinRouter.post("/athletes/:athlete_user_id/package/cancel-upcoming", writeLimit, asyncHandler(async (request, response) => {
  const coachUserId = await authenticatedCoach(request, true);
  return response.status(200).json(await cancelUpcomingForUnpaid(coachUserId, request.params.athlete_user_id));
}));

coachCheckinRouter.post("/", writeLimit, asyncHandler(async (request, response) => {
  const coachUserId = await authenticatedCoach(request, true);
  return response.status(201).json(await scheduleCheckin(coachUserId, request.body));
}));

coachCheckinRouter.post("/:checkin_id/cancel", writeLimit, asyncHandler(async (request, response) => {
  const coachUserId = await authenticatedCoach(request, true);
  return response.status(200).json(await cancelCheckin(coachUserId, String(request.params.checkin_id), request.body));
}));

coachCheckinRouter.post("/:checkin_id/move", writeLimit, asyncHandler(async (request, response) => {
  const coachUserId = await authenticatedCoach(request, true);
  return response.status(200).json(await moveCheckin(coachUserId, String(request.params.checkin_id), request.body));
}));

// Open slots from the athlete's coaches, booking one, and cancelling a call
// the athlete booked.
coachCheckinRouter.get("/slots", readLimit, asyncHandler(async (request, response) => {
  const athleteUserId = await authenticatedAthlete(request, false);
  return response.status(200).json(await athleteBookableSlots(athleteUserId));
}));

coachCheckinRouter.post("/book", writeLimit, asyncHandler(async (request, response) => {
  const athleteUserId = await authenticatedAthlete(request, true);
  return response.status(201).json(await bookSlot(athleteUserId, request.body));
}));

coachCheckinRouter.post("/:checkin_id/cancel-mine", writeLimit, asyncHandler(async (request, response) => {
  const athleteUserId = await authenticatedAthlete(request, true);
  return response.status(200).json(await cancelOwnBooking(athleteUserId, String(request.params.checkin_id)));
}));

// The athlete's upcoming check-ins, and confirming or asking to move one.
coachCheckinRouter.get("/mine", readLimit, asyncHandler(async (request, response) => {
  const athleteUserId = await authenticatedAthlete(request, false);
  return response.status(200).json(await listAthleteCheckins(athleteUserId));
}));

coachCheckinRouter.post("/:checkin_id/respond", writeLimit, asyncHandler(async (request, response) => {
  const athleteUserId = await authenticatedAthlete(request, true);
  return response.status(200).json(await respondToCheckin(athleteUserId, String(request.params.checkin_id), request.body));
}));

coachCheckinRouter.use((error: unknown, _request: Request, response: Response, next: NextFunction) => {
  if (error instanceof CoachCheckinError) {
    response.status(error.status).json({ ok: false, error: error.code, field_errors: error.fieldErrors });
    return;
  }
  next(error);
});
