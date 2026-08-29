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

// DEV NOTE: FULL-UI-02D loadCurrentTerms/registerAccount/signInAccount
// moved to public/app-src/api/authClient.ts (the entry/sign-up screen
// itself is React now - EntryAuthPanel.tsx/useEntryAuth.ts). This function
// stays since bootstrapApplication()'s shell-vs-entry-view decision must
// stay plain JS, independent of the React bundle.
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

// DEV NOTE: FULL-UI-02D requestPasswordReset/completePasswordReset moved
// to public/app-src/api/authClient.ts alongside the rest of the entry
// screen's transport - see the DEV NOTE above restoreAccountSession().

// DEV NOTE: updateAccountProfile/changeAccountPassword/
// requestEmailVerification/completeEmailVerification moved to React
// (client.ts) alongside ProfileForm.tsx/PasswordForm.tsx/
// EmailVerificationPanel.tsx - these copies had zero remaining callers
// (found via a post-migration audit sweep) and were only kept alive by a
// source-text-only governance assertion, not any real usage.

// DEV NOTE: FULL-UI-02 account_close_request transport moved to React
// (client.ts's requestAccountClosure()) - was only ever consumed by
// app.js's now-removed closePersistentAccount().

// DEV NOTE: FULL-UI-08 commercial/billing transport moved to React
// (commercialClient.ts) - loadCommercialAccount()/
// requestCommercialCheckout()/recordCommercialPaymentReturn()/
// requestCommercialBillingPortal() were only ever consumed by the now-
// retired commercial_ui.js.

// DEV NOTE: FULL-UI-19 data rights transport moved to React
// (dataRightsClient.ts) - requestDataExport()/loadDataExportStatus()/
// downloadDataExport()/loadDataDeletionPreview()/confirmDataDeletion()/
// loadDataDeletionStatus() were only ever consumed by app.js's now-removed
// data rights panel rendering.

// DEV NOTE: FULL-UI-04C profile/terms/completion mutations moved to
// public/app-src/api/coachOnboardingClient.ts - this one stays here since
// coach_onboarding_ui.js's resolveCoachOnboardingGate() (route_bootstrap.js's
// onboarding gate) must stay plain JS, independent of the React bundle.
export function loadCoachOnboardingState() {
  return request(
    "GET",
    "/account/coach-onboarding"
  );
}

// DEV NOTE: FULL-UI-65 coach branding transport moved to React
// (coachBrandingClient.ts) - loadCoachBrandPreference()/
// saveCoachBrandPreference() were only ever consumed by the now-retired
// coach_branding_ui.js.
