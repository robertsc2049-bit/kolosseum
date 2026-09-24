import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(
  new URL(
    "../public/app/index.html",
    import.meta.url
  ),
  "utf8"
);

const app = fs.readFileSync(
  new URL(
    "../public/app/app.js",
    import.meta.url
  ),
  "utf8"
);

const accountUi = fs.readFileSync(
  new URL(
    "../public/app/account_ui.js",
    import.meta.url
  ),
  "utf8"
);

const styles = fs.readFileSync(
  new URL(
    "../public/app/styles.css",
    import.meta.url
  ),
  "utf8"
);

const manifest = JSON.parse(
  fs.readFileSync(
    new URL(
      "../product/ui/function_manifest.json",
      import.meta.url
    ),
    "utf8"
  )
);

const integrationManifest = JSON.parse(
  fs.readFileSync(
    new URL(
      "../ci/contracts/test_ci_integration_vertical_slice_cluster_manifest.json",
      import.meta.url
    ),
    "utf8"
  )
);

// DEV NOTE: FULL-UI-02D the entry (sign-up/sign-in/password-reset) screen
// moved to React - see EntryAuthPanel.tsx/useEntryAuth.ts/authClient.ts,
// mounted at #entry-auth-root (replacing the static tabs+entryForm+
// passwordResetRequestForm+passwordResetCompleteForm markup this file used
// to check inside index.html/app.js/account_ui.js).
const authClient = fs.readFileSync(
  new URL("../public/app-src/api/authClient.ts", import.meta.url),
  "utf8"
);
const entryAuthPanel = fs.readFileSync(
  new URL("../public/app-src/screens/entry/EntryAuthPanel.tsx", import.meta.url),
  "utf8"
);
const useEntryAuthHook = fs.readFileSync(
  new URL("../public/app-src/screens/entry/useEntryAuth.ts", import.meta.url),
  "utf8"
);

test(
  "FULL-UI-02 exposes every account function through normal UI controls",
  () => {
    // profile_update/email_verification/password_change/consent_history/
    // sign_out/account_close_request (accountProfileForm/
    // requestVerificationButton/completeVerificationButton/
    // accountPasswordForm/accountConsentHistory/
    // accountCurrentTermsVersion/accountAcceptedTermsVersion/
    // accountCurrentConsentVersion/accountAcceptedConsentVersion/
    // signOutButton/accountClosureForm) migrated to the React island
    // mounted here - their controls are proven behaviorally in
    // public/app-src/__tests__/AccountIdentityPanel.test.tsx rather than
    // as static HTML control IDs.
    assert.match(html, /id="account-identity-root"/u);
    assert.doesNotMatch(html, /id="signOutButton"/u);
    assert.doesNotMatch(html, /id="accountClosureForm"/u);

    // account_create/account_sign_in/password_reset/terms_version
    // (entryCreateTab/entrySignInTab/entryPassword/forgotPasswordButton/
    // passwordResetRequestForm/passwordResetCompleteForm/
    // entryTermsVersion/entryConsentVersion) migrated to React too - see
    // public/app-src/__tests__/EntryAuthPanel.test.tsx.
    assert.match(html, /id="entry-auth-root"/u);
    assert.doesNotMatch(html, /id="entryForm"/u);
    assert.doesNotMatch(html, /id="entryPassword"/u);
    assert.doesNotMatch(html, /id="passwordResetRequestForm"/u);
    assert.doesNotMatch(html, /id="passwordResetCompleteForm"/u);

    assert.match(entryAuthPanel, /role="tab"/u);
    assert.match(entryAuthPanel, />\s*Sign in\s*</u);
    assert.match(entryAuthPanel, /autoComplete="new-password"/u);
    assert.match(entryAuthPanel, />Request code</u);
    assert.match(entryAuthPanel, /Set new password/u);
    assert.match(entryAuthPanel, /terms\?\.current_terms_version/u);
    assert.match(entryAuthPanel, /terms\?\.current_consent_version/u);
  }
);

test(
  "FULL-UI-02 browser client exposes the complete account API",
  () => {
    const functions = [
      "restoreAccountSession",
      "loadAccountDetail"
    ];

    for (const functionName of functions) {
      assert.match(
        accountUi,
        new RegExp(
          `export function ${functionName}\\b`,
          "u"
        ),
        `missing account client function ${functionName}`
      );
    }

    // signOutAccount/requestAccountClosure/updateAccountProfile/
    // changeAccountPassword/requestEmailVerification/
    // completeEmailVerification moved to the React client
    // (public/app-src/api/client.ts) alongside sign_out/
    // account_close_request/profile_update/password_change/
    // email_verification's migrated controls. The latter four were found
    // via a post-migration audit sweep to have zero remaining callers in
    // account_ui.js despite still being exported there.
    const reactClient = fs.readFileSync(
      new URL("../public/app-src/api/client.ts", import.meta.url),
      "utf8"
    );
    for (const functionName of [
      "signOutAccount",
      "requestAccountClosure",
      "updateAccountProfile",
      "changeAccountPassword",
      "requestEmailVerification",
      "completeEmailVerification"
    ]) {
      assert.match(
        reactClient,
        new RegExp(`export function ${functionName}\\b`, "u"),
        `missing React client function ${functionName}`
      );
      assert.doesNotMatch(
        accountUi,
        new RegExp(`export function ${functionName}\\b`, "u"),
        `${functionName} should have moved out of account_ui.js`
      );
    }

    // loadCurrentTerms/registerAccount/signInAccount/requestPasswordReset/
    // completePasswordReset moved to authClient.ts alongside the entry
    // screen's own migrated controls.
    for (const functionName of [
      "loadCurrentTerms",
      "registerAccount",
      "signInAccount",
      "requestPasswordReset",
      "completePasswordReset"
    ]) {
      assert.match(
        authClient,
        new RegExp(`export function ${functionName}\\b`, "u"),
        `missing authClient function ${functionName}`
      );
      assert.doesNotMatch(
        accountUi,
        new RegExp(`export function ${functionName}\\b`, "u"),
        `${functionName} should have moved out of account_ui.js`
      );
    }

    assert.match(
      accountUi,
      /credentials:\s*"same-origin"/u
    );

    assert.match(
      accountUi,
      /x-kolosseum-csrf/u
    );
  }
);

test(
  "FULL-UI-02 restores server identity into the existing product workspace",
  () => {
    // saveAccountProfile/requestAccountVerificationCode/verifyAccountEmail/
    // saveAccountPassword/closePersistentAccount/clearLocalSession migrated
    // to React - see public/app-src/screens/account/ and the
    // kolosseum:account-identity-updated/kolosseum:account-session-ended
    // bridge listeners app.js keeps to stay in sync with React-driven
    // identity updates and session endings.
    assert.match(
      app,
      /kolosseum:account-identity-updated/u
    );

    assert.match(
      app,
      /kolosseum:account-session-ended/u
    );

    assert.doesNotMatch(
      app,
      /\bclosePersistentAccount\b/u
    );

    assert.doesNotMatch(
      app,
      /\bclearLocalSession\b/u
    );

    for (const token of [
      "applyAccountSession",
      "actorHomeView",
      "bootstrapApplication",
      "factualAccountStateMessage",
      "restoreAccountSession",
      "loadPersistentAccountDetail"
    ]) {
      assert.match(
        app,
        new RegExp(
          `\\b${token}\\b`,
          "u"
        ),
        `missing application integration ${token}`
      );
    }

    // FULL-UI-02D setEntryMode/showEntryMessage/handleEntrySubmit/
    // currentTermsAvailable/renderTermsState/loadServerTerms are gone -
    // EntryAuthPanel.tsx/useEntryAuth.ts own all of that now, independently
    // fetching terms via authClient.ts. app.js's own listener for the
    // kolosseum:entry-auth-succeeded bridge event covers only
    // applyAccountSession()/enterApplication(), already checked above.
    for (const token of [
      "handleEntrySubmit",
      "renderTermsState",
      "loadServerTerms",
      "currentTermsAvailable",
      "setEntryMode",
      "guardedAction"
    ]) {
      assert.doesNotMatch(
        app,
        new RegExp(`function ${token}\\b`, "u"),
        `${token} should have moved to React`
      );
    }

    assert.match(app, /kolosseum:entry-auth-succeeded/u);
    assert.match(app, /kolosseum:entry-auth-session-rejected/u);
    assert.match(app, /kolosseum:entry-bootstrap-notice/u);

    assert.match(
      app,
      /bootstrap\.declaration_record/u
    );

    assert.match(
      app,
      /bootstrap\.coach_profile/u
    );

    assert.match(
      useEntryAuthHook,
      /accepted_terms_version:\s*state\.terms\?\.current_terms_version/u
    );

    assert.match(
      useEntryAuthHook,
      /accepted_consent_version:\s*state\.terms\?\.current_consent_version/u
    );

    assert.match(
      app,
      /This account is suspended\. Workspace access is unavailable\./u
    );

    assert.match(
      app,
      /This account is closed\. Sign-in and workspace access are unavailable\./u
    );

    assert.match(
      app,
      /This account has been deleted\. Sign-in and workspace access are unavailable\./u
    );

    assert.match(
      styles,
      /FULL-UI-02 persistent account access/u
    );
  }
);

test(
  "FULL-UI-02C identity manifest is implemented and persistently proven",
  () => {
    const area =
      manifest.product_areas.find(
        (entry) =>
          entry.area_id === "identity_account"
      );

    assert.ok(area);
    assert.equal(
      area.state,
      "implemented"
    );

    const expectedFunctions = [
      "account_create",
      "account_sign_in",
      "authenticated_session",
      "email_verification",
      "password_reset",
      "account_state_message",
      "role_redirect",
      "terms_version",
      "consent_history",
      "profile_update",
      "password_change",
      "account_close_request",
      "sign_out"
    ];

    assert.deepEqual(
      area.functions.map(
        (entry) =>
          entry.function_id
      ),
      expectedFunctions
    );

    // profile_update/password_change/email_verification/consent_history/
    // sign_out/account_close_request migrated to React earlier (this
    // file's AccountIdentityPanel.test.tsx pointer), and account_create/
    // account_sign_in/password_reset/terms_version moved to React too in
    // FULL-UI-02D (EntryAuthPanel.test.tsx). authenticated_session/
    // account_state_message/role_redirect stay legacy-rendered (the
    // shell-vs-entry-view bootstrap decision and factualAccountStateMessage/
    // actorHomeView all stay plain JS) and keep pointing here.
    const directTestByFunction = {
      account_create: "public/app-src/__tests__/EntryAuthPanel.test.tsx",
      account_sign_in: "public/app-src/__tests__/EntryAuthPanel.test.tsx",
      authenticated_session: "test/full_ui_02_account_ui.test.mjs",
      email_verification: "public/app-src/__tests__/AccountIdentityPanel.test.tsx",
      password_reset: "public/app-src/__tests__/EntryAuthPanel.test.tsx",
      account_state_message: "test/full_ui_02_account_ui.test.mjs",
      role_redirect: "test/full_ui_02_account_ui.test.mjs",
      terms_version: "public/app-src/__tests__/EntryAuthPanel.test.tsx",
      consent_history: "public/app-src/__tests__/AccountIdentityPanel.test.tsx",
      profile_update: "public/app-src/__tests__/AccountIdentityPanel.test.tsx",
      password_change: "public/app-src/__tests__/AccountIdentityPanel.test.tsx",
      account_close_request: "public/app-src/__tests__/AccountIdentityPanel.test.tsx",
      sign_out: "public/app-src/__tests__/AccountIdentityPanel.test.tsx"
    };

    for (const entry of area.functions) {
      assert.equal(
        entry.state,
        "implemented",
        entry.function_id
      );

      assert.equal(
        entry.route_id,
        "shared_account",
        entry.function_id
      );

      assert.equal(
        entry.direct_test,
        directTestByFunction[entry.function_id],
        entry.function_id
      );

      assert.equal(
        entry.integration_test,
        "test/full_ui_02c_identity_account_persistent_http.integration.test.mjs",
        entry.function_id
      );

      assert.deepEqual(
        Object.values(
          entry.coverage
        ),
        [
          "covered_or_declared",
          "covered_or_declared",
          "covered_or_declared",
          "covered_or_declared"
        ],
        entry.function_id
      );
    }

    const command =
      "node test/full_ui_02c_identity_account_persistent_http.integration.test.mjs";

    assert.equal(
      integrationManifest.commands.filter(
        (entry) => entry === command
      ).length,
      1
    );

    const slice =
      manifest.delivery_slices.find(
        (entry) =>
          entry.slice_id === "FULL-UI-02"
      );

    assert.equal(
      slice?.state,
      "implemented"
    );
  }
);
