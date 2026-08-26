process.env.DATABASE_URL ??=
  "postgresql://direct-proof:direct-proof@127.0.0.1:1/direct-proof";

import assert
  from "node:assert/strict";

import fs
  from "node:fs";

import test
  from "node:test";

import {
  PRODUCT_ROUTE_MAP,
  actorCanAccessRoute,
  parseProductRoute,
  routeForView,
  serializeProductRoute
} from "../public/app/route_bootstrap.js";

const service = await import(
  "../dist/src/api/coach_onboarding_service.js"
);

const onboardingUi =
  fs.readFileSync(
    new URL(
      "../public/app/coach_onboarding_ui.js",
      import.meta.url
    ),
    "utf8"
  );

// DEV NOTE: FULL-UI-08 commercial/billing rendering moved to React
// (CommercialPanel.tsx + useCommercialAccount.ts) - commercial_ui.js is
// retired.
const commercialPanel =
  fs.readFileSync(
    new URL(
      "../public/app-src/screens/account/CommercialPanel.tsx",
      import.meta.url
    ),
    "utf8"
  );

const commercialHook =
  fs.readFileSync(
    new URL(
      "../public/app-src/screens/account/useCommercialAccount.ts",
      import.meta.url
    ),
    "utf8"
  );

const commercialService =
  fs.readFileSync(
    new URL(
      "../src/api/product_commercial_service.ts",
      import.meta.url
    ),
    "utf8"
  );

const onboardingRoutes =
  fs.readFileSync(
    new URL(
      "../src/api/coach_onboarding.routes.ts",
      import.meta.url
    ),
    "utf8"
  );

const server =
  fs.readFileSync(
    new URL(
      "../src/server.ts",
      import.meta.url
    ),
    "utf8"
  );

const accountUi =
  fs.readFileSync(
    new URL(
      "../public/app/account_ui.js",
      import.meta.url
    ),
    "utf8"
  );

const manifest =
  JSON.parse(
    fs.readFileSync(
      new URL(
        "../product/ui/function_manifest.json",
        import.meta.url
      ),
      "utf8"
    )
  );

const closure =
  JSON.parse(
    fs.readFileSync(
      new URL(
        "../product/ui/full_ui_04c_coach_commercial_closure.json",
        import.meta.url
      ),
      "utf8"
    )
  );

test(
  "FULL-UI-04C exposes a coach-only onboarding route",
  () => {
    const route =
      parseProductRoute(
        "#/coach/onboarding"
      );

    assert.equal(
      route?.route_id,
      "coach_onboarding"
    );

    assert.equal(
      actorCanAccessRoute(
        "coach",
        route
      ),
      true
    );

    assert.equal(
      actorCanAccessRoute(
        "athlete",
        route
      ),
      false
    );

    assert.equal(
      serializeProductRoute(
        "coach_onboarding"
      ),
      "#/coach/onboarding"
    );

    assert.equal(
      routeForView(
        "coach",
        "coach-onboarding"
      ),
      "#/coach/onboarding"
    );

    assert.equal(
      PRODUCT_ROUTE_MAP.filter(
        (entry) =>
          entry.route_id ===
          "coach_onboarding"
      ).length,
      1
    );
  }
);

test(
  "FULL-UI-04C validates profile terms and completion directly",
  () => {
    assert.deepEqual(
      service
        .validateCoachOnboardingProfileInput({
          display_name:
            "Coach Proof",
          email:
            "COACH@EXAMPLE.TEST"
        }),
      {
        display_name:
          "Coach Proof",
        email:
          "coach@example.test"
      }
    );

    assert.deepEqual(
      service
        .validateCoachTermsInput({
          accepted: true,
          terms_version:
            "terms_v1"
        }),
      {
        accepted: true,
        terms_version:
          "terms_v1"
      }
    );

    assert.equal(
      service
        .validateCoachCompletionInput({
          completion_confirmed:
            true
        }),
      true
    );

    assert.throws(
      () =>
        service
          .validateCoachTermsInput({
            accepted: false,
            terms_version:
              "terms_v1"
          }),
      (error) =>
        error.code ===
        "coach_terms_invalid"
    );

    assert.throws(
      () =>
        service
          .validateCoachCompletionInput({
            completion_confirmed:
              false
          }),
      (error) =>
        error.code ===
        "coach_onboarding_completion_invalid"
    );
  }
);

test(
  "FULL-UI-04C mounts authenticated CSRF-protected routes",
  () => {
    for (const path of [
      '"/"',
      '"/profile"',
      '"/terms"',
      '"/complete"'
    ]) {
      assert.ok(
        onboardingRoutes.includes(
          path
        ),
        `Missing coach onboarding route ${path}`
      );
    }

    assert.match(
      onboardingRoutes,
      /assertProductCsrf/u
    );

    assert.match(
      onboardingRoutes,
      /PRODUCT_SESSION_COOKIE/u
    );

    assert.match(
      server,
      /app\.use\("\/account\/coach-onboarding", coachOnboardingRouter\);/u
    );
  }
);

test(
  "FULL-UI-04C browser flow is server-authoritative and explicit",
  () => {
    for (const endpoint of [
      "/account/coach-onboarding",
      "/account/coach-onboarding/profile",
      "/account/coach-onboarding/terms",
      "/account/coach-onboarding/complete"
    ]) {
      assert.ok(
        accountUi.includes(endpoint),
        `Missing account transport ${endpoint}`
      );
    }

    for (const token of [
      "Incomplete onboarding",
      "Coach profile",
      "Coach terms",
      "Completed onboarding",
      "Open coach workspace",
      "Update coach profile",
      "cannot alter engine truth"
    ]) {
      assert.ok(
        onboardingUi.includes(
          token
        ),
        `Missing coach UI state ${token}`
      );
    }

    assert.doesNotMatch(
      onboardingUi,
      /localStorage|sessionStorage/u
    );
  }
);

test(
  "FULL-UI-04C exposes only factual commercial states",
  () => {
    for (const state of [
      "active",
      "controlled_launch",
      "payment_action_required",
      "cancelled",
      "unavailable",
      "seat_limit_reached"
    ]) {
      assert.ok(
        commercialService.includes(
          `"${state}"`
        ),
        `Missing factual commercial state ${state}`
      );
    }

    assert.match(
      commercialPanel,
      /commercial\.factual_state/u
    );

    assert.match(
      commercialService,
      /commercial_seat_limit_reached/u
    );
  }
);

test(
  "FULL-UI-04C surfaces which specific settings are missing when checkout is misconfigured, not just a generic message",
  () => {
    // commercialConfig() has always computed and returned missing_configuration
    // (the exact list of env vars absent) on the ProductCommercialError thrown
    // for commercial_configuration_missing, and product_commercial.routes.ts
    // has always serialized it into the JSON error response as `details`, but
    // commercial_ui.js's (now useCommercialAccount.ts's) errorMessage() only
    // ever mapped the error code to a static, generic string - a coach
    // hitting misconfigured checkout could never see which setting was
    // actually missing. Same phantom-field bug class as PR #877-#881.
    assert.match(
      commercialService,
      /missing_configuration:/u
    );

    assert.match(
      commercialHook,
      /record\?\.details as JsonRecord \| undefined\)\?\.missing_configuration/u
    );

    assert.match(
      commercialHook,
      /const missingSuffix = Array\.isArray\(missing\) && missing\.length > 0/u
    );

    assert.match(
      commercialHook,
      /commercial_configuration_missing:\s*`[^`]*\$\{missingSuffix\}`/u
    );
  }
);

test(
  "FULL-UI-04C preserves commercial and engine separation",
  () => {
    assert.doesNotMatch(
      commercialService,
      /from\s+["'][^"']*engine[^"']*["']/u
    );

    for (const marker of [
      "calls_engine: false",
      "engine_visible: false",
      'engine_legality: "not_mutated"',
      'compile_output: "not_mutated"',
      'session_state: "not_read_or_written"'
    ]) {
      assert.ok(
        `${commercialService}\n${onboardingUi}`
          .includes(marker) ||
        JSON.stringify(closure)
          .includes(
            marker
              .split(":")[0]
              .replaceAll('"', "")
          )
      );
    }
  }
);

test(
  "FULL-UI-04C manifest and closure contain no partial or missing functions",
  () => {
    const areas =
      manifest.product_areas ??
      manifest.areas;

    const area =
      areas.find(
        (entry) =>
          entry.area_id ===
          "coach_commercial"
      );

    assert.ok(area);
    assert.equal(
      area.state,
      "implemented"
    );

    assert.equal(
      area.functions.length,
      9
    );

    assert.equal(
      area.functions.every(
        (entry) =>
          entry.state ===
          "implemented"
      ),
      true
    );

    assert.equal(
      JSON.stringify(area)
        .includes('"partial"'),
      false
    );

    assert.equal(
      JSON.stringify(area)
        .includes('"missing"'),
      false
    );

    assert.equal(
      closure.state,
      "implemented"
    );

    assert.equal(
      Object.values(
        closure.coverage
      ).every(
        (value) =>
          value === "covered"
      ),
      true
    );
  }
);