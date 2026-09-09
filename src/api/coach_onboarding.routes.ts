// DEV NOTE: FULL-UI-04C authenticated coach onboarding HTTP routes.

import {
  Router,
  type NextFunction,
  type Request,
  type Response
} from "express";

import { rateLimit } from "express-rate-limit";

import {
  PRODUCT_SESSION_COOKIE,
  ProductAccountError,
  assertProductCsrf
} from "./product_account_service.js";

import {
  CoachOnboardingError,
  acceptCoachOnboardingTerms,
  completeCoachOnboarding,
  getCoachOnboardingState,
  saveCoachOnboardingAccessibilityPreferences,
  saveCoachOnboardingProfile
} from "./coach_onboarding_service.js";

export const coachOnboardingRouter =
  Router();

type AsyncHandler = (
  request: Request,
  response: Response,
  next: NextFunction
) => Promise<unknown>;

function asyncHandler(
  handler: AsyncHandler
) {
  return (
    request: Request,
    response: Response,
    next: NextFunction
  ): void => {
    void handler(
      request,
      response,
      next
    ).catch(next);
  };
}

function cookieValue(
  request: Request,
  name: string
): string {
  const header =
    String(
      request.headers.cookie ??
      ""
    );

  for (
    const item
    of header.split(";")
  ) {
    const separator =
      item.indexOf("=");

    if (separator < 0) {
      continue;
    }

    const key =
      item
        .slice(0, separator)
        .trim();

    if (key !== name) {
      continue;
    }

    const encoded =
      item
        .slice(separator + 1)
        .trim();

    try {
      return decodeURIComponent(
        encoded
      );
    }
    catch {
      return "";
    }
  }

  return "";
}

function sessionToken(
  request: Request
): string {
  const token =
    cookieValue(
      request,
      PRODUCT_SESSION_COOKIE
    );

  if (!token) {
    throw new ProductAccountError(
      "account_session_missing",
      401
    );
  }

  return token;
}

function assertMutationAuthorised(
  request: Request,
  token: string
): void {
  assertProductCsrf(
    token,
    request.get(
      "x-kolosseum-csrf"
    )
  );
}

coachOnboardingRouter.get(
  "/",
  asyncHandler(
    async (
      request,
      response
    ) => {
      const result =
        await getCoachOnboardingState(
          sessionToken(request)
        );

      return response
        .status(200)
        .json(result);
    }
  )
);

coachOnboardingRouter.patch(
  "/profile",
  asyncHandler(
    async (
      request,
      response
    ) => {
      const token =
        sessionToken(request);

      assertMutationAuthorised(
        request,
        token
      );

      const result =
        await saveCoachOnboardingProfile(
          token,
          request.body
        );

      return response
        .status(200)
        .json(result);
    }
  )
);

coachOnboardingRouter.post(
  "/terms",
  asyncHandler(
    async (
      request,
      response
    ) => {
      const token =
        sessionToken(request);

      assertMutationAuthorised(
        request,
        token
      );

      const result =
        await acceptCoachOnboardingTerms(
          token,
          request.body
        );

      return response
        .status(200)
        .json(result);
    }
  )
);

// DEV NOTE: rate-limited (unlike the sibling /profile, /terms, /complete
// mutation routes above, which predate this) because CodeQL's
// js/missing-rate-limiting query flags newly-added authorising routes -
// this keeps the new route from introducing a fresh instance of a gap
// that already exists, unremediated, on its neighbours.
const accessibilityPreferencesRateLimit =
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false
  });

coachOnboardingRouter.patch(
  "/accessibility",
  accessibilityPreferencesRateLimit,
  asyncHandler(
    async (
      request,
      response
    ) => {
      const token =
        sessionToken(request);

      assertMutationAuthorised(
        request,
        token
      );

      const result =
        await saveCoachOnboardingAccessibilityPreferences(
          token,
          request.body
        );

      return response
        .status(200)
        .json(result);
    }
  )
);

coachOnboardingRouter.post(
  "/complete",
  asyncHandler(
    async (
      request,
      response
    ) => {
      const token =
        sessionToken(request);

      assertMutationAuthorised(
        request,
        token
      );

      const result =
        await completeCoachOnboarding(
          token,
          request.body
        );

      return response
        .status(200)
        .json(result);
    }
  )
);

coachOnboardingRouter.use(
  (
    error: unknown,
    _request: Request,
    response: Response,
    next: NextFunction
  ) => {
    if (
      error instanceof
      CoachOnboardingError
    ) {
      response
        .status(error.status)
        .json({
          error: error.code,
          field_errors:
            error.field_errors,
          calls_engine: false,
          engine_visible: false
        });

      return;
    }

    if (
      error instanceof
      ProductAccountError
    ) {
      response
        .status(error.status)
        .json({
          error: error.code,
          account_state:
            error.account_state ??
            null
        });

      return;
    }

    next(error);
  }
);