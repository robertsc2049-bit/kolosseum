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

export function loadCurrentTerms() {
  return request(
    "GET",
    "/account/terms"
  );
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

// DEV NOTE: FULL-UI-02 sign_out transport moved to React (client.ts's
// signOutAccount()) - was only ever consumed by app.js's now-removed
// clearLocalSession().

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

// DEV NOTE: FULL-UI-02 account_close_request transport moved to React
// (client.ts's requestAccountClosure()) - was only ever consumed by
// app.js's now-removed closePersistentAccount().

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

// DEV NOTE: FULL-UI-19 data rights transport moved to React
// (dataRightsClient.ts) - requestDataExport()/loadDataExportStatus()/
// downloadDataExport()/loadDataDeletionPreview()/confirmDataDeletion()/
// loadDataDeletionStatus() were only ever consumed by app.js's now-removed
// data rights panel rendering.

export function loadCoachOnboardingState() {
  return request(
    "GET",
    "/account/coach-onboarding"
  );
}

export function saveCoachOnboardingProfile(
  input,
  csrfToken
) {
  return request(
    "PATCH",
    "/account/coach-onboarding/profile",
    input,
    csrfToken
  );
}

export function acceptCoachOnboardingTerms(
  input,
  csrfToken
) {
  return request(
    "POST",
    "/account/coach-onboarding/terms",
    input,
    csrfToken
  );
}

export function completeCoachOnboarding(
  input,
  csrfToken
) {
  return request(
    "POST",
    "/account/coach-onboarding/complete",
    input,
    csrfToken
  );
}

// DEV NOTE: FULL-UI-65 coach branding transport moved to React
// (coachBrandingClient.ts) - loadCoachBrandPreference()/
// saveCoachBrandPreference() were only ever consumed by the now-retired
// coach_branding_ui.js.
