// DEV NOTE: FULL-UI-08 authenticated commercial account API.
// Commercial state is owned by the product layer and is never engine input.

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
  ProductCommercialError,
  createProductCommercialCheckout,
  createProductCommercialPortalRequest,
  getProductCommercialOverview,
  recordProductCommercialPaymentReturn
} from "./product_commercial_service.js";

export const productCommercialRouter = Router();

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

    const key =
      item.slice(0, separatorIndex).trim();

    if (key !== name) {
      continue;
    }

    const encoded =
      item.slice(separatorIndex + 1).trim();

    try {
      return decodeURIComponent(encoded);
    }
    catch {
      return "";
    }
  }

  return "";
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

async function accountIdentity(
  request: Request
): Promise<Readonly<{
  token: string;
  user_id: string;
  actor_type: string;
}>> {
  const token = sessionToken(request);
  const session =
    await resolveProductSession(token);
  const account =
    session.account as Readonly<
      Record<string, unknown>
    >;
  const userId = String(
    account.user_id ?? ""
  ).trim();
  const actorType = String(
    account.actor_type ?? ""
  ).trim();

  if (!userId || !actorType) {
    throw new ProductAccountError(
      "account_session_invalid",
      401
    );
  }

  return Object.freeze({
    token,
    user_id: userId,
    actor_type: actorType
  });
}

productCommercialRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const identity =
      await accountIdentity(request);

    const result =
      await getProductCommercialOverview(
        identity.user_id,
        identity.actor_type
      );

    return response.status(200).json(result);
  })
);

productCommercialRouter.post(
  "/checkout",
  asyncHandler(async (request, response) => {
    const identity =
      await accountIdentity(request);

    assertMutationAuthorised(
      request,
      identity.token
    );

    const result =
      await createProductCommercialCheckout(
        identity.user_id,
        identity.actor_type,
        request.body
      );

    return response.status(201).json(result);
  })
);

productCommercialRouter.post(
  "/payment-return",
  asyncHandler(async (request, response) => {
    const identity =
      await accountIdentity(request);

    assertMutationAuthorised(
      request,
      identity.token
    );

    const result =
      await recordProductCommercialPaymentReturn(
        identity.user_id,
        identity.actor_type,
        request.body
      );

    return response.status(201).json(result);
  })
);

productCommercialRouter.post(
  "/portal",
  asyncHandler(async (request, response) => {
    const identity =
      await accountIdentity(request);

    assertMutationAuthorised(
      request,
      identity.token
    );

    const result =
      await createProductCommercialPortalRequest(
        identity.user_id,
        identity.actor_type,
        request.body
      );

    return response.status(201).json(result);
  })
);

productCommercialRouter.use(
  (
    error: unknown,
    _request: Request,
    response: Response,
    next: NextFunction
  ) => {
    if (error instanceof ProductCommercialError) {
      response.status(error.status).json({
        error: error.code,
        details: error.details,
        calls_engine: false,
        engine_visible: false
      });
      return;
    }

    if (error instanceof ProductAccountError) {
      response.status(error.status).json({
        error: error.code,
        account_state:
          error.account_state ?? null
      });
      return;
    }

    next(error);
  }
);
