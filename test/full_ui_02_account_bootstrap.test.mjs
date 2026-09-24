import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { V1_ACTIVITY_IDS } from "../shared/v1-boundary/v1ActivityRegistry.mjs";

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

    // Activity ids come from the shared v1 activity registry (single
    // source of truth), not hardcoded literals in this service - see
    // shared/v1-boundary/v1ActivityRegistry.mjs.
    assert.match(
      service,
      /V1_ACTIVITY_IDS/u
    );

    assert.ok(
      V1_ACTIVITY_IDS.includes("powerlifting")
    );

    assert.ok(
      V1_ACTIVITY_IDS.includes("general_strength")
    );

    assert.ok(
      V1_ACTIVITY_IDS.includes("rugby_union")
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