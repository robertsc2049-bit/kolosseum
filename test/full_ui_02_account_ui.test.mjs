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

test(
  "FULL-UI-02 exposes every account function through normal UI controls",
  () => {
    const controlIds = [
      "entryCreateTab",
      "entrySignInTab",
      "entryPassword",
      "forgotPasswordButton",
      "passwordResetRequestForm",
      "passwordResetCompleteForm",
      "entryTermsVersion",
      "entryConsentVersion"
    ];

    for (const id of controlIds) {
      assert.match(
        html,
        new RegExp(
          `id="${id}"`,
          "u"
        ),
        `missing UI control ${id}`
      );
    }

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
  }
);

test(
  "FULL-UI-02 browser client exposes the complete account API",
  () => {
    const functions = [
      "loadCurrentTerms",
      "registerAccount",
      "signInAccount",
      "restoreAccountSession",
      "loadAccountDetail",
      "updateAccountProfile",
      "changeAccountPassword",
      "requestPasswordReset",
      "completePasswordReset",
      "requestEmailVerification",
      "completeEmailVerification"
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

    // signOutAccount/requestAccountClosure moved to the React client
    // (public/app-src/api/client.ts) alongside sign_out/
    // account_close_request's migrated controls.
    const reactClient = fs.readFileSync(
      new URL("../public/app-src/api/client.ts", import.meta.url),
      "utf8"
    );
    assert.match(reactClient, /export function signOutAccount/u);
    assert.match(reactClient, /export function requestAccountClosure/u);
    assert.doesNotMatch(accountUi, /export function signOutAccount/u);
    assert.doesNotMatch(accountUi, /export function requestAccountClosure/u);

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
      "loadServerTerms",
      "renderTermsState",
      "restoreAccountSession",
      "handleEntrySubmit",
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

    assert.match(
      app,
      /bootstrap\.declaration_record/u
    );

    assert.match(
      app,
      /bootstrap\.coach_profile/u
    );

    assert.match(
      app,
      /accepted_terms_version:\s*state\.currentTerms/u
    );

    assert.match(
      app,
      /accepted_consent_version:\s*state\.currentTerms/u
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
    // sign_out/account_close_request migrated to React - their direct_test
    // now points at the component test file that replaced this file's
    // former source-text checks for exactly those six functions. Every
    // other function in this area is still legacy-rendered and keeps
    // pointing here.
    const migratedToReact = new Set([
      "profile_update",
      "password_change",
      "email_verification",
      "consent_history",
      "sign_out",
      "account_close_request"
    ]);

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
        migratedToReact.has(entry.function_id)
          ? "public/app-src/__tests__/AccountIdentityPanel.test.tsx"
          : "test/full_ui_02_account_ui.test.mjs",
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
