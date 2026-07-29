// DEV NOTE: FULL-UI-03C authenticated athlete onboarding HTTP boundary.
// This route exposes factual declaration state only and cannot infer training decisions.

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
import {
  AthleteOnboardingError,
  confirmAthleteOnboarding,
  getAthleteOnboardingState,
  saveAthleteOnboardingDraft,
  updateAthleteOnboardingPreferences
} from "./athlete_onboarding_service.js";

export const athleteOnboardingRouter = Router();

type AsyncHandler = (
  request: Request,
  response: Response,
  next: NextFunction
) => Promise<unknown>;

function asyncHandler(handler: AsyncHandler) {
  return (request: Request, response: Response, next: NextFunction): void => {
    void handler(request, response, next).catch(next);
  };
}

function cookieValue(request: Request, name: string): string {
  const header = String(request.headers.cookie ?? "");
  for (const item of header.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0 || item.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(item.slice(separator + 1).trim());
    }
    catch {
      return "";
    }
  }
  return "";
}

async function athleteSession(request: Request) {
  const token = cookieValue(request, PRODUCT_SESSION_COOKIE);
  if (!token) throw new ProductAccountError("account_session_missing", 401);

  const session = await resolveProductSession(token);
  if (session.account_row.actor_type !== "athlete") {
    throw new AthleteOnboardingError("athlete_onboarding_athlete_required", 403);
  }

  return { token, session };
}

function assertMutation(request: Request, token: string): void {
  assertProductCsrf(token, request.get("x-kolosseum-csrf"));
}

athleteOnboardingRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const { session } = await athleteSession(request);
    const state = await getAthleteOnboardingState(session.account_row.user_id);
    return response.status(200).json(state);
  })
);

athleteOnboardingRouter.patch(
  "/draft",
  asyncHandler(async (request, response) => {
    const { token, session } = await athleteSession(request);
    assertMutation(request, token);
    const state = await saveAthleteOnboardingDraft(
      session.account_row.user_id,
      request.body
    );
    return response.status(200).json(state);
  })
);

athleteOnboardingRouter.post(
  "/confirm",
  asyncHandler(async (request, response) => {
    const { token, session } = await athleteSession(request);
    assertMutation(request, token);
    const state = await confirmAthleteOnboarding(
      session.account_row.user_id,
      request.body
    );
    return response.status(200).json(state);
  })
);

athleteOnboardingRouter.patch(
  "/preferences",
  asyncHandler(async (request, response) => {
    const { token, session } = await athleteSession(request);
    assertMutation(request, token);
    const state = await updateAthleteOnboardingPreferences(
      session.account_row.user_id,
      request.body
    );
    return response.status(200).json(state);
  })
);

athleteOnboardingRouter.use(
  (
    error: unknown,
    _request: Request,
    response: Response,
    next: NextFunction
  ) => {
    if (error instanceof AthleteOnboardingError) {
      response.status(error.status).json({
        error: error.code,
        field_errors: error.field_errors
      });
      return;
    }

    if (error instanceof ProductAccountError) {
      response.status(error.status).json({
        error: error.code,
        account_state: error.account_state ?? null
      });
      return;
    }

    next(error);
  }
);
