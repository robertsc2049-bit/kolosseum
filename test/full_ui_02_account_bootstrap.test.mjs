import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const service = fs.readFileSync(
  new URL(
    "../src/api/product_account_service.ts",
    import.meta.url
  ),
  "utf8"
);

const routes = fs.readFileSync(
  new URL(
    "../src/api/product_account.routes.ts",
    import.meta.url
  ),
  "utf8"
);

test(
  "FULL-UI-02 creates lawful athlete and coach product records",
  () => {
    for (const token of [
      "createBeta16AuthRecord",
      "createBeta16AcknowledgementRecord",
      "createBeta16Phase1DeclarationRecord",
      "createBeta17CoachProfileRecord",
      "persistBetaProductRecord",
      "persistInitialProductRecords",
      "loadProductBootstrap"
    ]) {
      assert.match(
        service,
        new RegExp(
          `\\b${token}\\b`,
          "u"
        ),
        `missing bootstrap token ${token}`
      );
    }

    assert.match(
      service,
      /actor_type:\s*"athlete"/u
    );

    assert.match(
      service,
      /execution_scope:\s*"individual"/u
    );

    assert.match(
      service,
      /activity_id:\s*activity/u
    );

    assert.match(
      service,
      /"powerlifting"/u
    );

    assert.match(
      service,
      /"general_strength"/u
    );

    assert.match(
      service,
      /"rugby_union"/u
    );
  }
);

test(
  "FULL-UI-02 returns product bootstrap records with every session",
  () => {
    assert.match(
      service,
      /bootstrap:\s*Readonly<JsonRecord>/u
    );

    assert.match(
      service,
      /bootstrap:\s*session\.bootstrap/u
    );

    assert.match(
      routes,
      /bootstrap:\s*result\.session\.bootstrap/u
    );

    const sessionResponses =
      routes.match(
        /bootstrap:\s*session\.bootstrap/gu
      ) ?? [];

    assert.equal(
      sessionResponses.length,
      2
    );
  }
);