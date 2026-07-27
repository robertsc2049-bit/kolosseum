// DEV NOTE: FULL-UI-02 browser account transport.
// This module transports account state only and cannot mutate engine law.

async function readJson(response) {
  const text = await response
    .text()
    .catch(() => "");

  try {
    return text
      ? JSON.parse(text)
      : null;
  }
  catch {
    return { raw: text };
  }
}

async function request(
  method,
  path,
  body,
  csrfToken = ""
) {
  const headers = {};

  if (body !== undefined) {
    headers["content-type"] =
      "application/json";
  }

  if (
    csrfToken &&
    method !== "GET" &&
    method !== "HEAD"
  ) {
    headers["x-kolosseum-csrf"] =
      csrfToken;
  }

  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers,
    body:
      body === undefined
        ? undefined
        : JSON.stringify(body)
  });

  const payload = await readJson(response);

  if (!response.ok) {
    const error = new Error(
      String(
        payload?.error ??
        payload?.reason ??
        payload?.failure_token ??
        `account_request_${response.status}`
      )
    );

    error.payload = payload;
    error.status = response.status;

    throw error;
  }

  return payload;
}

export function registerAccount(input) {
  return request(
    "POST",
    "/account/register",
    input
  );
}

export function signInAccount(input) {
  return request(
    "POST",
    "/account/sign-in",
    input
  );
}

export function restoreAccountSession() {
  return request(
    "GET",
    "/account/session"
  );
}

export function signOutAccount(
  csrfToken
) {
  return request(
    "POST",
    "/account/sign-out",
    {},
    csrfToken
  );
}

export function loadAccountDetail() {
  return request(
    "GET",
    "/account/detail"
  );
}

export function updateAccountProfile(
  input,
  csrfToken
) {
  return request(
    "PATCH",
    "/account/profile",
    input,
    csrfToken
  );
}

export function changeAccountPassword(
  input,
  csrfToken
) {
  return request(
    "POST",
    "/account/password/change",
    input,
    csrfToken
  );
}

export function requestPasswordReset(
  input
) {
  return request(
    "POST",
    "/account/password/reset/request",
    input
  );
}

export function completePasswordReset(
  input
) {
  return request(
    "POST",
    "/account/password/reset/complete",
    input
  );
}

export function requestEmailVerification(
  csrfToken
) {
  return request(
    "POST",
    "/account/email-verification/request",
    {},
    csrfToken
  );
}

export function completeEmailVerification(
  input,
  csrfToken
) {
  return request(
    "POST",
    "/account/email-verification/complete",
    input,
    csrfToken
  );
}

export function requestAccountClosure(
  input,
  csrfToken
) {
  return request(
    "POST",
    "/account/closure",
    input,
    csrfToken
  );
}
export function loadCommercialAccount() {
  return request(
    "GET",
    "/account/commercial"
  );
}

export function requestCommercialCheckout(
  input,
  csrfToken
) {
  return request(
    "POST",
    "/account/commercial/checkout",
    input,
    csrfToken
  );
}

export function recordCommercialPaymentReturn(
  input,
  csrfToken
) {
  return request(
    "POST",
    "/account/commercial/payment-return",
    input,
    csrfToken
  );
}

export function requestCommercialBillingPortal(
  input,
  csrfToken
) {
  return request(
    "POST",
    "/account/commercial/portal",
    input,
    csrfToken
  );
}
