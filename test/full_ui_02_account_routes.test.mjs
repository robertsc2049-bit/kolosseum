import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const routes = fs.readFileSync(
  new URL(
    "../src/api/product_account.routes.ts",
    import.meta.url
  ),
  "utf8"
);

const service = fs.readFileSync(
  new URL(
    "../src/api/product_account_service.ts",
    import.meta.url
  ),
  "utf8"
);

const server = fs.readFileSync(
  new URL("../src/server.ts", import.meta.url),
  "utf8"
);

const schema = fs.readFileSync(
  new URL("../schema.sql", import.meta.url),
  "utf8"
);

const requiredRoutes = [
  '"/terms"',
  '"/register"',
  '"/sign-in"',
  '"/session"',
  '"/sign-out"',
  '"/detail"',
  '"/profile"',
  '"/password/change"',
  '"/password/reset/request"',
  '"/password/reset/complete"',
  '"/email-verification/request"',
  '"/email-verification/complete"',
  '"/closure"'
];

test(
  "FULL-UI-02 exposes the complete account HTTP surface",
  () => {
    for (const route of requiredRoutes) {
      assert.match(
        routes,
        new RegExp(
          route.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"),
          "u"
        ),
        `missing account route ${route}`
      );
    }

    assert.match(
      routes,
      /httpOnly:\s*true/u
    );

    assert.match(
      routes,
      /sameSite:\s*"lax"/u
    );

    assert.match(
      routes,
      /assertMutationAuthorised/u
    );

    assert.match(
      routes,
      /x-kolosseum-csrf/u
    );

    assert.match(
      server,
      /app\.use\("\/account", productAccountRouter\);/u
    );
  }
);

test(
  "FULL-UI-02 retains persistent account and session law",
  () => {
    const serviceFunctions = [
      "registerProductAccount",
      "signInProductAccount",
      "resolveProductSession",
      "signOutProductAccount",
      "getProductAccountDetail",
      "updateProductAccountProfile",
      "changeProductPassword",
      "requestProductPasswordReset",
      "completeProductPasswordReset",
      "requestProductEmailVerification",
      "completeProductEmailVerification",
      "requestProductAccountClosure"
    ];

    for (const functionName of serviceFunctions) {
      assert.match(
        service,
        new RegExp(
          `export async function ${functionName}\\b`,
          "u"
        ),
        `missing service function ${functionName}`
      );
    }

    assert.match(
      service,
      /export function getCurrentProductTerms\b/u
    );

    assert.match(
      service,
      /account_acceptance_version_mismatch/u
    );

    assert.match(
      service,
      /accepted_terms_version/u
    );

    assert.match(
      service,
      /accepted_consent_version/u
    );

    assert.match(
      routes,
      /getCurrentProductTerms/u
    );

    assert.match(
      service,
      /crypto\.scrypt/u
    );

    assert.match(
      service,
      /crypto\.timingSafeEqual/u
    );

    assert.match(
      service,
      /account_state !== "active"/u
    );

    const tables = [
      "beta_accounts",
      "product_accounts",
      "product_auth_sessions",
      "product_auth_challenges",
      "product_account_events",
      "product_account_closure_requests"
    ];

    for (const table of tables) {
      assert.match(
        schema,
        new RegExp(
          `CREATE TABLE IF NOT EXISTS ${table}\\b`,
          "u"
        ),
        `missing schema table ${table}`
      );
    }
  }
);
