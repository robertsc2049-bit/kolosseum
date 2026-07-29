// DEV NOTE: FULL-UI-04C persistent HTTP proof.
// Product operations use authenticated HTTP. Direct database access is limited
// to trusted-provider boundary seeding, persistence inspection and cleanup.

import assert
  from "node:assert/strict";

import crypto
  from "node:crypto";

import fs
  from "node:fs/promises";

import net
  from "node:net";

import path
  from "node:path";

import test
  from "node:test";

import {
  spawn
} from "node:child_process";

import {
  fileURLToPath
} from "node:url";

import {
  Client
} from "pg";

function repoRoot() {
  return path.resolve(
    path.dirname(
      fileURLToPath(
        import.meta.url
      )
    ),
    ".."
  );
}

function delay(
  milliseconds
) {
  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        milliseconds
      )
  );
}

async function freePort() {
  return await new Promise(
    (
      resolve,
      reject
    ) => {
      const server =
        net.createServer();

      server.once(
        "error",
        reject
      );

      server.listen(
        0,
        "127.0.0.1",
        () => {
          const address =
            server.address();

          assert.ok(
            address &&
            typeof address ===
              "object"
          );

          server.close(
            (error) =>
              error
                ? reject(error)
                : resolve(
                    address.port
                  )
          );
        }
      );
    }
  );
}

function spawnNode(
  argumentsList,
  options
) {
  const child =
    spawn(
      process.execPath,
      argumentsList,
      {
        stdio: [
          "ignore",
          "pipe",
          "pipe"
        ],
        ...options
      }
    );

  let stdout = "";
  let stderr = "";

  child.stdout.on(
    "data",
    (chunk) => {
      stdout +=
        chunk.toString(
          "utf8"
        );
    }
  );

  child.stderr.on(
    "data",
    (chunk) => {
      stderr +=
        chunk.toString(
          "utf8"
        );
    }
  );

  return {
    child,
    get stdout() {
      return stdout;
    },
    get stderr() {
      return stderr;
    }
  };
}

async function waitForExit(
  child
) {
  if (
    child.exitCode !== null
  ) {
    return {
      code:
        child.exitCode,
      signal:
        child.signalCode ??
        null
    };
  }

  return await new Promise(
    (resolve) => {
      child.once(
        "exit",
        (
          code,
          signal
        ) => {
          resolve({
            code,
            signal:
              signal ?? null
          });
        }
      );
    }
  );
}

async function waitForHealth(
  processRecord,
  baseUrl,
  timeoutMilliseconds = 20000
) {
  const deadline =
    Date.now() +
    timeoutMilliseconds;

  let lastError = null;

  while (
    Date.now() <
    deadline
  ) {
    if (
      processRecord.child
        .exitCode !== null
    ) {
      const exit =
        await waitForExit(
          processRecord.child
        );

      throw new Error(
        [
          "Server exited before health.",
          `exit_code=${String(exit.code)}`,
          `signal=${String(exit.signal)}`,
          "stdout:",
          processRecord.stdout ||
            "<empty>",
          "stderr:",
          processRecord.stderr ||
            "<empty>"
        ].join("\n")
      );
    }

    try {
      const response =
        await fetch(
          `${baseUrl}/health`
        );

      if (response.ok) {
        return;
      }

      lastError =
        new Error(
          `Health returned ${response.status}`
        );
    }
    catch (error) {
      lastError = error;
    }

    await delay(120);
  }

  throw new Error(
    [
      "Server did not become healthy.",
      `base_url=${baseUrl}`,
      `last_error=${
        lastError?.message ??
        String(lastError)
      }`,
      "stdout:",
      processRecord.stdout ||
        "<empty>",
      "stderr:",
      processRecord.stderr ||
        "<empty>"
    ].join("\n")
  );
}

async function startServer(
  root,
  environment,
  port
) {
  const mainModule =
    path.join(
      root,
      "dist",
      "src",
      "main.js"
    );

  await fs.access(
    mainModule
  );

  const baseUrl =
    `http://127.0.0.1:${port}`;

  const processRecord =
    spawnNode(
      [
        mainModule
      ],
      {
        cwd: root,
        env: {
          ...environment,
          PORT:
            String(port)
        }
      }
    );

  await waitForHealth(
    processRecord,
    baseUrl
  );

  return {
    ...processRecord,
    baseUrl,
    port
  };
}

async function stopServer(
  server
) {
  if (
    !server?.child ||
    server.child.exitCode !==
      null
  ) {
    return;
  }

  server.child.kill(
    process.platform ===
      "win32"
      ? undefined
      : "SIGTERM"
  );

  await Promise.race([
    waitForExit(
      server.child
    ),
    delay(3000)
  ]);

  if (
    server.child.exitCode ===
    null
  ) {
    server.child.kill(
      "SIGKILL"
    );

    await Promise.race([
      waitForExit(
        server.child
      ),
      delay(2000)
    ]);
  }
}

async function requestJson(
  baseUrl,
  method,
  route,
  options = {}
) {
  const headers = {};

  if (
    options.body !== undefined
  ) {
    headers["content-type"] =
      "application/json";
  }

  if (options.cookie) {
    headers.cookie =
      options.cookie;
  }

  if (options.csrf) {
    headers[
      "x-kolosseum-csrf"
    ] = options.csrf;
  }

  const response =
    await fetch(
      `${baseUrl}${route}`,
      {
        method,
        headers,
        redirect: "manual",
        body:
          options.body ===
          undefined
            ? undefined
            : JSON.stringify(
                options.body
              )
      }
    );

  const text =
    await response.text();

  let json = null;

  try {
    json =
      text
        ? JSON.parse(text)
        : null;
  }
  catch {
  }

  return {
    response,
    text,
    json
  };
}

function assertStatus(
  result,
  expected,
  label
) {
  assert.equal(
    result.response.status,
    expected,
    `${label}: expected ${expected}, received ${result.response.status}. raw=${result.text}`
  );
}

function sessionCookie(
  result,
  label
) {
  const values =
    typeof result.response
      .headers.getSetCookie ===
      "function"
      ? result.response
          .headers
          .getSetCookie()
      : [
          result.response
            .headers
            .get("set-cookie")
        ].filter(Boolean);

  const session =
    values.find(
      (value) =>
        String(value)
          .startsWith(
            "kolosseum_session="
          )
    );

  assert.ok(
    session,
    `${label}: expected session cookie`
  );

  return String(session)
    .split(";")[0];
}

async function withClient(
  databaseUrl,
  operation
) {
  const client =
    new Client({
      connectionString:
        databaseUrl
    });

  await client.connect();

  try {
    return await operation(
      client
    );
  }
  finally {
    await client.end();
  }
}

function stableValue(
  value
) {
  if (Array.isArray(value)) {
    return value.map(
      stableValue
    );
  }

  if (
    value === null ||
    typeof value !==
      "object"
  ) {
    return value;
  }

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map(
        (key) => [
          key,
          stableValue(
            value[key]
          )
        ]
      )
  );
}

function stableJson(
  value
) {
  return JSON.stringify(
    stableValue(value)
  );
}

function sha256(
  value
) {
  return crypto
    .createHash("sha256")
    .update(
      stableJson(value),
      "utf8"
    )
    .digest("hex");
}

async function cleanup(
  databaseUrl,
  userId
) {
  if (!userId) {
    return;
  }

  await withClient(
    databaseUrl,
    async (client) => {
      await client.query(
        `
        DELETE FROM
          product_commercial_records
        WHERE user_id = $1
        `,
        [userId]
      );

      await client.query(
        `
        DELETE FROM
          product_account_events
        WHERE user_id = $1
        `,
        [userId]
      );

      await client.query(
        `
        DELETE FROM
          product_auth_challenges
        WHERE user_id = $1
        `,
        [userId]
      ).catch(() => {});

      await client.query(
        `
        DELETE FROM
          product_auth_sessions
        WHERE user_id = $1
        `,
        [userId]
      ).catch(() => {});

      await client.query(
        `
        DELETE FROM
          product_account_closure_requests
        WHERE user_id = $1
        `,
        [userId]
      ).catch(() => {});

      await client.query(
        `
        DELETE FROM
          product_accounts
        WHERE user_id = $1
        `,
        [userId]
      );

      await client.query(
        `
        DELETE FROM
          beta_product_records
        WHERE
          subject_user_id = $1
          OR actor_user_id = $1
        `,
        [userId]
      );

      await client.query(
        `
        DELETE FROM
          beta_accounts
        WHERE user_id = $1
        `,
        [userId]
      ).catch(() => {});
    }
  );
}

async function commercialEnvironment(
  root,
  baseEnvironment,
  baseUrl
) {
  const source =
    await fs.readFile(
      path.join(
        root,
        "src",
        "api",
        "product_commercial_service.ts"
      ),
      "utf8"
    );

  const names =
    new Set([
      ...[
        ...source.matchAll(
          /["'`]([A-Z][A-Z0-9_]{4,})["'`]/gu
        )
      ].map(
        (match) =>
          match[1]
      ),
      ...[
        ...source.matchAll(
          /process\.env\.([A-Z][A-Z0-9_]{4,})/gu
        )
      ].map(
        (match) =>
          match[1]
      ),
      ...[
        ...source.matchAll(
          /process\.env\[\s*["'`]([A-Z][A-Z0-9_]{4,})["'`]\s*\]/gu
        )
      ].map(
        (match) =>
          match[1]
      )
    ]);

  for (const candidate of [
    "KOLOSSEUM_COMMERCIAL_PLAN_ID",
    "KOLOSSEUM_COACH_PLAN_ID",
    "V1_COACH_PLAN_ID",
    "PRODUCT_COACH_PLAN_ID",
    "KOLOSSEUM_COMMERCIAL_PRICE_ID",
    "KOLOSSEUM_COACH_PRICE_ID",
    "V1_COACH_PRICE_ID",
    "STRIPE_PRICE_ID",
    "KOLOSSEUM_COMMERCIAL_SEAT_LIMIT",
    "KOLOSSEUM_COACH_SEAT_LIMIT",
    "V1_COACH_SEAT_LIMIT",
    "KOLOSSEUM_APPLICATION_URL",
    "KOLOSSEUM_APP_URL",
    "APPLICATION_URL",
    "APP_URL",
    "KOLOSSEUM_CHECKOUT_URL",
    "COMMERCIAL_CHECKOUT_URL",
    "STRIPE_CHECKOUT_URL",
    "KOLOSSEUM_BILLING_PORTAL_URL",
    "COMMERCIAL_PORTAL_URL",
    "STRIPE_PORTAL_URL",
    "KOLOSSEUM_PAYMENT_PROVIDER",
    "KOLOSSEUM_PORTAL_PROVIDER"
  ]) {
    names.add(candidate);
  }

  const environment = {
    ...baseEnvironment,
    KOLOSSEUM_CONTROLLED_LAUNCH_PLAN_ID:
      "controlled_launch_coach",
    KOLOSSEUM_CONTROLLED_LAUNCH_PRICE_ID:
      "price_controlled_launch_coach",
    KOLOSSEUM_CONTROLLED_LAUNCH_SEAT_LIMIT:
      "2"
  };

  for (const name of names) {
    if (
      !/(COMMERCIAL|CHECKOUT|BILLING|PORTAL|PAYMENT|STRIPE|COACH.*(?:PLAN|PRICE|SEAT)|URL|URI)/u
        .test(name)
    ) {
      continue;
    }

    if (
      /PORTAL.*PROVIDER/u
        .test(name)
    ) {
      environment[name] =
        "stripe_customer_portal";
    }
    else if (
      /PROVIDER/u.test(name)
    ) {
      environment[name] =
        "stripe_checkout";
    }
    else if (
      /SEAT/u.test(name)
    ) {
      environment[name] =
        "2";
    }
    else if (
      /PRICE/u.test(name)
    ) {
      environment[name] =
        "price_controlled_launch";
    }
    else if (
      /PLAN/u.test(name)
    ) {
      environment[name] =
        "coach_16";
    }
    else if (
      /ENABLE|ENABLED/u
        .test(name)
    ) {
      environment[name] =
        "true";
    }
    else if (
      /PORTAL/u
        .test(name)
    ) {
      environment[name] =
        "https://portal.example.test/customer";
    }
    else if (
      /CHECKOUT.*(?:URL|URI)|(?:URL|URI).*CHECKOUT/u
        .test(name)
    ) {
      environment[name] =
        "https://checkout.example.test/session";
    }
    else if (
      /(?:APPLICATION|APP|RETURN|PUBLIC|BASE).*(?:URL|URI)|(?:URL|URI).*(?:APPLICATION|APP|RETURN|PUBLIC|BASE)/u
        .test(name)
    ) {
      environment[name] =
        `${baseUrl}/app/`;
    }
    else if (
      /URL|URI/u
        .test(name)
    ) {
      environment[name] =
        `${baseUrl}/app/`;
    }
    else if (
      /SECRET|API_KEY|TOKEN/u
        .test(name)
    ) {
      environment[name] =
        "test_inert_provider_secret";
    }
  }

  return environment;
}

async function seedTrustedProviderState(
  databaseUrl,
  userId,
  planId,
  seatLimit,
  occupiedSeatCount
) {
  const effectiveAt =
    new Date(
      Date.now() + 2000
    ).toISOString();

  const billingRecordBase = {
    contract_version:
      "S-V1-P-01",
    actor_type: "coach",
    actor_id: userId,
    subject_id: userId,
    provider:
      "stripe_checkout",
    plan_id: planId,
    seat_limit:
      seatLimit,
    billing_access_state:
      "access_active",
    billing_status:
      "payment_confirmed",
    provider_session_id:
      "provider_session_confirmed",
    trusted_provider_confirmation:
      true,
    product_access_only:
      true,
    engine_visible: false
  };

  const billingRecord = {
    ...billingRecordBase,
    record_hash:
      sha256(
        billingRecordBase
      )
  };

  const payload = {
    contract_version:
      "FULL-UI-04C",
    status:
      "trusted_provider_confirmation_recorded",
    billing_access_record:
      billingRecord,
    ...billingRecord,
    occupied_seat_count:
      occupiedSeatCount,
    provider_call_performed:
      false,
    calls_engine: false,
    engine_visible: false,
    engine_decision: false,
    engine_legality:
      "not_mutated",
    compile_output:
      "not_mutated",
    substitution_selection:
      "not_mutated",
    replay_record:
      "not_mutated",
    proof_record:
      "not_mutated",
    factual_history_record:
      "not_mutated",
    coach_athlete_relationship_truth:
      "not_read_not_written_not_inferred",
    relationship_truth_mutation:
      "not_performed"
  };

  const payloadHash =
    sha256(payload);

  await withClient(
    databaseUrl,
    async (client) => {
      await client.query(
        `
        INSERT INTO
          product_commercial_records (
            commercial_record_id,
            user_id,
            request_id,
            record_type,
            effective_at,
            record_payload,
            record_sha256
          )
        VALUES (
          $1,
          $2,
          $3,
          'commercial_billing_access_updated',
          $4::timestamptz,
          $5::jsonb,
          $6
        )
        ON CONFLICT (
          user_id,
          request_id
        )
        DO NOTHING
        `,
        [
          `commercial_${payloadHash.slice(0, 24)}`,
          userId,
          "full_ui_04c_trusted_provider_confirmation",
          effectiveAt,
          JSON.stringify(payload),
          payloadHash
        ]
      );
    }
  );
}

async function compileFixture(
  baseUrl,
  fixture
) {
  const result =
    await requestJson(
      baseUrl,
      "POST",
      "/blocks/compile",
      {
        body: {
          phase1_input:
            fixture
        }
      }
    );

  assert.ok(
    result.response.status === 200 ||
    result.response.status === 201,
    `deterministic compile: expected 200 or 201, received ${result.response.status}. raw=${result.text}`
  );

  const body =
    result.json;

  assert.ok(
    body &&
    typeof body === "object",
    "Compile response must contain a JSON object."
  );

  // block_id is a generated persistence identifier.
  // Compare only the canonical deterministic engine payload.
  return {
    engine_version:
      body.engine_version,
    canonical_hash:
      body.canonical_hash,
    planned_session:
      body.planned_session,
    runtime_trace:
      body.runtime_trace
  };
}

test(
  "FULL-UI-04C coach onboarding commercial records restart and engine isolation are persistent",
  {
    timeout: 180000
  },
  async (
    testContext
  ) => {
    const root =
      repoRoot();

    const databaseUrl =
      process.env.DATABASE_URL;

    assert.ok(
      typeof databaseUrl ===
        "string" &&
      databaseUrl.trim()
        .length > 0,
      "FULL-UI-04C integration proof requires DATABASE_URL"
    );

    const port =
      await freePort();

    const baseUrl =
      `http://127.0.0.1:${port}`;

    const environment =
      await commercialEnvironment(
        root,
        {
          ...process.env,
          DATABASE_URL:
            databaseUrl,
          NODE_ENV: "test"
        },
        baseUrl
      );

    delete environment.SMOKE_NO_DB;

    const nonce =
      crypto.randomUUID()
        .replaceAll("-", "");

    const originalEmail =
      `coach-${nonce}@example.test`;

    const updatedEmail =
      `coach-updated-${nonce}@example.test`;

    const password =
      "Coach-commercial-proof-2026";

    let userId = "";

    let server =
      await startServer(
        root,
        environment,
        port
      );

    testContext.after(
      async () => {
        await stopServer(
          server
        );

        await cleanup(
          databaseUrl,
          userId
        );
      }
    );

    const registration =
      await requestJson(
        server.baseUrl,
        "POST",
        "/account/register",
        {
          body: {
            actor_type:
              "coach",
            display_name:
              "Initial Proof Coach",
            email:
              originalEmail,
            password,
            accepted_terms:
              true,
            accepted_consent:
              true,
            accepted_terms_version:
              "terms_v1",
            accepted_consent_version:
              "consent_v1"
          }
        }
      );

    assertStatus(
      registration,
      201,
      "register coach"
    );

    userId =
      registration.json
        ?.account
        ?.user_id ?? "";

    assert.ok(userId);

    let cookie =
      sessionCookie(
        registration,
        "register coach"
      );

    let csrf =
      registration.json
        ?.csrf_token;

    assert.ok(csrf);

    const initialOnboarding =
      await requestJson(
        server.baseUrl,
        "GET",
        "/account/coach-onboarding/",
        {
          cookie
        }
      );

    assertStatus(
      initialOnboarding,
      200,
      "initial coach onboarding"
    );

    assert.equal(
      initialOnboarding.json
        .onboarding_status,
      "incomplete"
    );

    assert.equal(
      initialOnboarding.json
        .current_stage,
      "profile"
    );

    const invalidTerms =
      await requestJson(
        server.baseUrl,
        "POST",
        "/account/coach-onboarding/terms",
        {
          cookie,
          csrf,
          body: {
            accepted: true,
            terms_version:
              "terms_v1"
          }
        }
      );

    assertStatus(
      invalidTerms,
      422,
      "terms before profile"
    );

    const profile =
      await requestJson(
        server.baseUrl,
        "PATCH",
        "/account/coach-onboarding/profile",
        {
          cookie,
          csrf,
          body: {
            display_name:
              "Persistent Proof Coach",
            email:
              updatedEmail
          }
        }
      );

    assertStatus(
      profile,
      200,
      "save coach profile"
    );

    assert.equal(
      profile.json
        .profile_saved,
      true
    );

    assert.equal(
      profile.json
        .current_stage,
      "terms"
    );

    assert.equal(
      profile.json
        .profile
        .display_name,
      "Persistent Proof Coach"
    );

    assert.equal(
      profile.json
        .profile
        .email,
      updatedEmail
    );

    const terms =
      await requestJson(
        server.baseUrl,
        "POST",
        "/account/coach-onboarding/terms",
        {
          cookie,
          csrf,
          body: {
            accepted: true,
            terms_version:
              "terms_v1"
          }
        }
      );

    assertStatus(
      terms,
      200,
      "accept coach terms"
    );

    assert.equal(
      terms.json
        .terms_accepted,
      true
    );

    assert.equal(
      terms.json
        .current_stage,
      "review"
    );

    const completion =
      await requestJson(
        server.baseUrl,
        "POST",
        "/account/coach-onboarding/complete",
        {
          cookie,
          csrf,
          body: {
            completion_confirmed:
              true
          }
        }
      );

    assertStatus(
      completion,
      200,
      "complete coach onboarding"
    );

    assert.equal(
      completion.json
        .onboarding_status,
      "completed"
    );

    assert.equal(
      completion.json
        .completion_persisted,
      true
    );

    assert.equal(
      completion.json
        .workspace_route,
      "#/coach/overview"
    );

    const fixture =
      JSON.parse(
        await fs.readFile(
          path.join(
            root,
            "test",
            "fixtures",
            "golden",
            "inputs",
            "vanilla_minimal.json"
          ),
          "utf8"
        )
      );

    const compileBefore =
      await compileFixture(
        server.baseUrl,
        fixture
      );

    const initialCommercial =
      await requestJson(
        server.baseUrl,
        "GET",
        "/account/commercial/",
        {
          cookie
        }
      );

    assertStatus(
      initialCommercial,
      200,
      "initial commercial overview"
    );

    assert.notEqual(
      initialCommercial.json
        .commercial
        .configuration_state,
      "missing",
      `Commercial proof configuration was not resolved: ${JSON.stringify(initialCommercial.json)}`
    );

    assert.equal(
      initialCommercial.json
        .commercial
        .factual_state,
      "controlled_launch"
    );

    assert.equal(
      initialCommercial.json
        .commercial
        .occupied_seat_count,
      0
    );

    assert.equal(
      initialCommercial.json
        .commercial
        .available_seat_count,
      initialCommercial.json
        .commercial
        .seat_limit
    );

    const checkout =
      await requestJson(
        server.baseUrl,
        "POST",
        "/account/commercial/checkout",
        {
          cookie,
          csrf,
          body: {
            request_id:
              `checkout_${nonce}`
          }
        }
      );

    assertStatus(
      checkout,
      201,
      "checkout request"
    );

    assert.equal(
      checkout.json
        .provider_call_performed,
      false
    );

    const pendingCommercial =
      await requestJson(
        server.baseUrl,
        "GET",
        "/account/commercial/",
        {
          cookie
        }
      );

    assertStatus(
      pendingCommercial,
      200,
      "pending commercial overview"
    );

    assert.equal(
      pendingCommercial.json
        .commercial
        .factual_state,
      "payment_action_required"
    );

    const cancelledReturn =
      await requestJson(
        server.baseUrl,
        "POST",
        "/account/commercial/payment-return",
        {
          cookie,
          csrf,
          body: {
            request_id:
              `cancelled_${nonce}`,
            outcome:
              "cancelled",
            provider_session_id:
              null
          }
        }
      );

    assertStatus(
      cancelledReturn,
      201,
      "cancelled payment return"
    );

    const cancelledCommercial =
      await requestJson(
        server.baseUrl,
        "GET",
        "/account/commercial/",
        {
          cookie
        }
      );

    assertStatus(
      cancelledCommercial,
      200,
      "cancelled commercial overview"
    );

    assert.equal(
      cancelledCommercial.json
        .commercial
        .factual_state,
      "cancelled"
    );

    const successReturn =
      await requestJson(
        server.baseUrl,
        "POST",
        "/account/commercial/payment-return",
        {
          cookie,
          csrf,
          body: {
            request_id:
              `success_${nonce}`,
            outcome:
              "success",
            provider_session_id:
              "provider_session_browser_return"
          }
        }
      );

    assertStatus(
      successReturn,
      201,
      "successful browser payment return"
    );

    assert.equal(
      successReturn.json
        .trusted_provider_confirmation,
      false
    );

    const planId =
      initialCommercial.json
        .commercial
        .plan_id;

    const seatLimit =
      initialCommercial.json
        .commercial
        .seat_limit;

    assert.equal(
      Number.isInteger(
        seatLimit
      ),
      true
    );

    await seedTrustedProviderState(
      databaseUrl,
      userId,
      planId,
      seatLimit,
      seatLimit
    );

    const activeCommercial =
      await requestJson(
        server.baseUrl,
        "GET",
        "/account/commercial/",
        {
          cookie
        }
      );

    assertStatus(
      activeCommercial,
      200,
      "active commercial overview"
    );

    assert.equal(
      activeCommercial.json
        .commercial
        .subscription_state,
      "active"
    );

    assert.equal(
      activeCommercial.json
        .commercial
        .occupied_seat_count,
      seatLimit
    );

    assert.equal(
      activeCommercial.json
        .commercial
        .available_seat_count,
      0
    );

    assert.equal(
      activeCommercial.json
        .commercial
        .factual_state,
      "seat_limit_reached"
    );

    assert.equal(
      activeCommercial.json
        .commercial
        .entitlement_error
        .code,
      "commercial_seat_limit_reached"
    );

    const portal =
      await requestJson(
        server.baseUrl,
        "POST",
        "/account/commercial/portal",
        {
          cookie,
          csrf,
          body: {
            request_id:
              `portal_${nonce}`
          }
        }
      );

    assertStatus(
      portal,
      201,
      "billing portal request"
    );

    assert.equal(
      portal.json
        .provider_call_performed,
      false
    );

    const compileAfter =
      await compileFixture(
        server.baseUrl,
        fixture
      );

    assert.deepEqual(
      compileAfter,
      compileBefore,
      "Commercial mutations altered deterministic compile output."
    );

    const storedCounts =
      await withClient(
        databaseUrl,
        async (client) => {
          const result =
            await client.query(
              `
              SELECT
                record_type,
                count(*)::integer
                  AS record_count
              FROM
                product_commercial_records
              WHERE user_id = $1
              GROUP BY record_type
              ORDER BY record_type
              `,
              [userId]
            );

          return Object.fromEntries(
            result.rows.map(
              (row) => [
                row.record_type,
                Number(
                  row.record_count
                )
              ]
            )
          );
        }
      );

    assert.ok(
      storedCounts
        .commercial_checkout_requested >=
        1
    );

    assert.ok(
      storedCounts
        .commercial_payment_return_recorded >=
        2
    );

    assert.ok(
      storedCounts
        .commercial_billing_access_updated >=
        1
    );

    assert.ok(
      storedCounts
        .commercial_portal_requested >=
        1
    );

    await stopServer(
      server
    );

    server =
      await startServer(
        root,
        environment,
        port
      );

    const signIn =
      await requestJson(
        server.baseUrl,
        "POST",
        "/account/sign-in",
        {
          body: {
            email:
              updatedEmail,
            password
          }
        }
      );

    assertStatus(
      signIn,
      200,
      "sign in after restart"
    );

    cookie =
      sessionCookie(
        signIn,
        "sign in after restart"
      );

    csrf =
      signIn.json
        ?.csrf_token;

    assert.ok(csrf);

    const restartedOnboarding =
      await requestJson(
        server.baseUrl,
        "GET",
        "/account/coach-onboarding/",
        {
          cookie
        }
      );

    assertStatus(
      restartedOnboarding,
      200,
      "coach onboarding after restart"
    );

    assert.equal(
      restartedOnboarding.json
        .onboarding_status,
      "completed"
    );

    assert.equal(
      restartedOnboarding.json
        .profile
        .display_name,
      "Persistent Proof Coach"
    );

    assert.equal(
      restartedOnboarding.json
        .profile
        .email,
      updatedEmail
    );

    const restartedCommercial =
      await requestJson(
        server.baseUrl,
        "GET",
        "/account/commercial/",
        {
          cookie
        }
      );

    assertStatus(
      restartedCommercial,
      200,
      "commercial overview after restart"
    );

    assert.equal(
      restartedCommercial.json
        .commercial
        .factual_state,
      "seat_limit_reached"
    );

    const updatedProfile =
      await requestJson(
        server.baseUrl,
        "PATCH",
        "/account/coach-onboarding/profile",
        {
          cookie,
          csrf,
          body: {
            display_name:
              "Updated Persistent Coach",
            email:
              updatedEmail
          }
        }
      );

    assertStatus(
      updatedProfile,
      200,
      "update completed coach profile"
    );

    assert.equal(
      updatedProfile.json
        .onboarding_status,
      "completed"
    );

    assert.equal(
      updatedProfile.json
        .profile
        .display_name,
      "Updated Persistent Coach"
    );

    const finalCompile =
      await compileFixture(
        server.baseUrl,
        fixture
      );

    assert.deepEqual(
      finalCompile,
      compileBefore,
      "Persistent commercial or coach account state altered deterministic compile output."
    );
  }
);