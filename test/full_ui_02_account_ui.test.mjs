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
      "accountProfileForm",
      "requestVerificationButton",
      "completeVerificationButton",
      "accountPasswordForm",
      "accountConsentHistory",
      "signOutButton",
      "accountClosureForm"
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
  }
);

test(
  "FULL-UI-02 browser client exposes the complete account API",
  () => {
    const functions = [
      "registerAccount",
      "signInAccount",
      "restoreAccountSession",
      "signOutAccount",
      "loadAccountDetail",
      "updateAccountProfile",
      "changeAccountPassword",
      "requestPasswordReset",
      "completePasswordReset",
      "requestEmailVerification",
      "completeEmailVerification",
      "requestAccountClosure"
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
    for (const token of [
      "applyAccountSession",
      "bootstrapApplication",
      "restoreAccountSession",
      "handleEntrySubmit",
      "loadPersistentAccountDetail",
      "saveAccountProfile",
      "requestAccountVerificationCode",
      "verifyAccountEmail",
      "saveAccountPassword",
      "closePersistentAccount"
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
      styles,
      /FULL-UI-02 persistent account access/u
    );
  }
);