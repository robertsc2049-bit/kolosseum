// DEV NOTE: FULL-UI-02 account API boundary.
// Product identity state cannot alter deterministic engine inputs, outputs or registry law.

import {
  Router,
  type NextFunction,
  type Request,
  type Response
} from "express";

import {
  PRODUCT_SESSION_COOKIE,
  PRODUCT_SESSION_MAX_AGE_SECONDS,
  ProductAccountError,
  assertProductCsrf,
  changeProductPassword,
  completeProductEmailVerification,
  completeProductPasswordReset,
  getProductAccountDetail,
  registerProductAccount,
  requestProductAccountClosure,
  requestProductEmailVerification,
  requestProductPasswordReset,
  resolveProductSession,
  signInProductAccount,
  signOutProductAccount,
  updateProductAccountProfile
} from "./product_account_service.js";

export const productAccountRouter = Router();

type AsyncHandler = (
  request: Request,
  response: Response,
  next: NextFunction
) => Promise<unknown>;

function asyncHandler(handler: AsyncHandler) {
  return (
    request: Request,
    response: Response,
    next: NextFunction
  ): void => {
    void handler(request, response, next).catch(next);
  };
}

function cookieValue(
  request: Request,
  name: string
): string {
  const cookieHeader = String(
    request.headers.cookie ?? ""
  );

  for (const item of cookieHeader.split(";")) {
    const separatorIndex = item.indexOf("=");

    if (separatorIndex < 0) {
      continue;
    }

    const key = item.slice(0, separatorIndex).trim();

    if (key !== name) {
      continue;
    }

    const encoded = item
      .slice(separatorIndex + 1)
      .trim();

    try {
      return decodeURIComponent(encoded);
    }
    catch {
      return "";
    }
  }

  return "";
}

function userAgent(request: Request): string {
  const value = request.headers["user-agent"];

  if (Array.isArray(value)) {
    return value.join(" ");
  }

  return typeof value === "string"
    ? value
    : "unknown";
}

function sessionToken(request: Request): string {
  const token = cookieValue(
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
    request.get("x-kolosseum-csrf")
  );
}

function setSessionCookie(
  response: Response,
  rawToken: string
): void {
  response.cookie(
    PRODUCT_SESSION_COOKIE,
    rawToken,
    {
      httpOnly: true,
      sameSite: "lax",
      secure:
        process.env.NODE_ENV === "production",
      path: "/",
      maxAge:
        PRODUCT_SESSION_MAX_AGE_SECONDS *
        1000
    }
  );
}

function clearSessionCookie(
  response: Response
): void {
  response.clearCookie(
    PRODUCT_SESSION_COOKIE,
    {
      httpOnly: true,
      sameSite: "lax",
      secure:
        process.env.NODE_ENV === "production",
      path: "/"
    }
  );
}

productAccountRouter.post(
  "/register",
  asyncHandler(async (request, response) => {
    const result = await registerProductAccount(
      request.body,
      userAgent(request)
    );

    setSessionCookie(
      response,
      result.session.raw_session_token
    );

    return response.status(201).json({
      account: result.session.account,
      bootstrap:
        result.session.bootstrap,
      csrf_token:
        result.session.csrf_token,
      session_expires_at_iso8601:
        result.session.expires_at_iso8601,
      verification:
        result.verification,
      claimed_existing_identity:
        result.claimed_existing_identity
    });
  })
);

productAccountRouter.post(
  "/sign-in",
  asyncHandler(async (request, response) => {
    const session = await signInProductAccount(
      request.body,
      userAgent(request)
    );

    setSessionCookie(
      response,
      session.raw_session_token
    );

    return response.status(200).json({
      account: session.account,
      bootstrap: session.bootstrap,
      csrf_token: session.csrf_token,
      session_expires_at_iso8601:
        session.expires_at_iso8601
    });
  })
);

productAccountRouter.get(
  "/session",
  asyncHandler(async (request, response) => {
    const token = sessionToken(request);
    const session = await resolveProductSession(
      token
    );

    return response.status(200).json({
      account: session.account,
      bootstrap: session.bootstrap,
      csrf_token: session.csrf_token,
      session_expires_at_iso8601:
        session.expires_at_iso8601
    });
  })
);

productAccountRouter.post(
  "/sign-out",
  asyncHandler(async (request, response) => {
    const token = sessionToken(request);

    assertMutationAuthorised(
      request,
      token
    );

    await signOutProductAccount(token);
    clearSessionCookie(response);

    return response.status(204).end();
  })
);

productAccountRouter.get(
  "/detail",
  asyncHandler(async (request, response) => {
    const token = sessionToken(request);
    const detail = await getProductAccountDetail(
      token
    );

    const session = await resolveProductSession(
      token
    );

    return response.status(200).json({
      ...detail,
      csrf_token: session.csrf_token
    });
  })
);

productAccountRouter.patch(
  "/profile",
  asyncHandler(async (request, response) => {
    const token = sessionToken(request);

    assertMutationAuthorised(
      request,
      token
    );

    const result =
      await updateProductAccountProfile(
        token,
        request.body
      );

    return response.status(200).json(result);
  })
);

productAccountRouter.post(
  "/password/change",
  asyncHandler(async (request, response) => {
    const token = sessionToken(request);

    assertMutationAuthorised(
      request,
      token
    );

    await changeProductPassword(
      token,
      request.body
    );

    return response.status(204).end();
  })
);

productAccountRouter.post(
  "/password/reset/request",
  asyncHandler(async (request, response) => {
    const result =
      await requestProductPasswordReset(
        request.body
      );

    return response.status(202).json(result);
  })
);

productAccountRouter.post(
  "/password/reset/complete",
  asyncHandler(async (request, response) => {
    await completeProductPasswordReset(
      request.body
    );

    clearSessionCookie(response);

    return response.status(204).end();
  })
);

productAccountRouter.post(
  "/email-verification/request",
  asyncHandler(async (request, response) => {
    const token = sessionToken(request);

    assertMutationAuthorised(
      request,
      token
    );

    const result =
      await requestProductEmailVerification(
        token
      );

    return response.status(202).json(result);
  })
);

productAccountRouter.post(
  "/email-verification/complete",
  asyncHandler(async (request, response) => {
    const token = sessionToken(request);

    assertMutationAuthorised(
      request,
      token
    );

    const account =
      await completeProductEmailVerification(
        token,
        request.body
      );

    return response.status(200).json({
      account
    });
  })
);

productAccountRouter.post(
  "/closure",
  asyncHandler(async (request, response) => {
    const token = sessionToken(request);

    assertMutationAuthorised(
      request,
      token
    );

    const result =
      await requestProductAccountClosure(
        token,
        request.body
      );

    clearSessionCookie(response);

    return response.status(202).json(result);
  })
);

productAccountRouter.use(
  (
    error: unknown,
    _request: Request,
    response: Response,
    next: NextFunction
  ) => {
    if (!(error instanceof ProductAccountError)) {
      next(error);
      return;
    }

    response.status(error.status).json({
      error: error.code,
      account_state:
        error.account_state ?? null
    });
  }
);