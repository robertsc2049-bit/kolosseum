// DEV NOTE: FULL-UI-02C persistent identity and account HTTP proof.
// Product actions cross public HTTP routes. Direct database access is limited
// to isolated fixture-state setup and test cleanup.

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import test from "node:test";
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
      fileURLToPath(import.meta.url)
    ),
    ".."
  );
}

function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function getFreePort() {
  return await new Promise(
    (resolve, reject) => {
      const server = net.createServer();

      server.once("error", reject);

      server.listen(
        0,
        "127.0.0.1",
        () => {
          const address = server.address();

          assert.ok(
            address &&
            typeof address === "object",
            "Expected allocated TCP address"
          );

          server.close((error) => {
            if (error) {
              reject(error);
              return;
            }

            resolve(address.port);
          });
        }
      );
    }
  );
}

function spawnNode(
  argumentsList,
  options
) {
  const child = spawn(
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
      stdout += chunk.toString("utf8");
    }
  );

  child.stderr.on(
    "data",
    (chunk) => {
      stderr += chunk.toString("utf8");
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

async function waitForExit(child) {
  if (child.exitCode !== null) {
    return {
      code: child.exitCode,
      signal: child.signalCode ?? null
    };
  }

  return await new Promise((resolve) => {
    child.once(
      "exit",
      (code, signal) => {
        resolve({
          code,
          signal: signal ?? null
        });
      }
    );
  });
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

  while (Date.now() < deadline) {
    if (
      processRecord.child.exitCode !==
      null
    ) {
      const exit =
        await waitForExit(
          processRecord.child
        );

      throw new Error(
        [
          "Server exited before health became ready.",
          `exit_code=${String(exit.code)}`,
          `signal=${String(exit.signal)}`,
          "stdout:",
          processRecord.stdout || "<empty>",
          "stderr:",
          processRecord.stderr || "<empty>"
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
      processRecord.stdout || "<empty>",
      "stderr:",
      processRecord.stderr || "<empty>"
    ].join("\n")
  );
}

async function startServer(
  root,
  environment
) {
  const mainModule =
    path.join(
      root,
      "dist",
      "src",
      "main.js"
    );

  await fs.access(mainModule);

  const port =
    await getFreePort();

  const baseUrl =
    `http://127.0.0.1:${port}`;

  const processRecord =
    spawnNode(
      [mainModule],
      {
        cwd: root,
        env: {
          ...environment,
          PORT: String(port)
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

async function stopServer(server) {
  if (
    !server?.child ||
    server.child.exitCode !== null
  ) {
    return;
  }

  if (process.platform === "win32") {
    server.child.kill();
  }
  else {
    server.child.kill("SIGTERM");
  }

  await Promise.race([
    waitForExit(server.child),
    delay(3000)
  ]);

  if (server.child.exitCode === null) {
    server.child.kill("SIGKILL");

    await Promise.race([
      waitForExit(server.child),
      delay(2000)
    ]);
  }
}

async function restartServer(
  server,
  root,
  environment
) {
  await stopServer(server);

  return await startServer(
    root,
    environment
  );
}

async function requestJson(
  baseUrl,
  method,
  route,
  options = {}
) {
  const headers = {};

  if (
    typeof options.body !==
    "undefined"
  ) {
    headers["content-type"] =
      "application/json";
  }

  if (options.cookie) {
    headers.cookie =
      options.cookie;
  }

  if (options.csrf) {
    headers["x-kolosseum-csrf"] =
      options.csrf;
  }

  const response =
    await fetch(
      `${baseUrl}${route}`,
      {
        method,
        headers,
        redirect: "manual",
        body:
          typeof options.body ===
          "undefined"
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
      text.length > 0
        ? JSON.parse(text)
        : null;
  }
  catch {
    // Raw text remains available in assertion messages.
  }

  return {
    response,
    text,
    json
  };
}

function assertStatus(
  result,
  expectedStatus,
  label
) {
  assert.equal(
    result.response.status,
    expectedStatus,
    `${label}: expected ${expectedStatus}, received ${result.response.status}. raw=${result.text}`
  );
}

function sessionCookie(
  result,
  label
) {
  const values =
    typeof result.response.headers
      .getSetCookie === "function"
      ? result.response.headers
          .getSetCookie()
      : [
          result.response.headers
            .get("set-cookie")
        ].filter(Boolean);

  const session =
    values.find((value) =>
      String(value).startsWith(
        "kolosseum_session="
      )
    );

  assert.ok(
    session,
    `${label}: expected session cookie`
  );

  return String(session).split(";")[0];
}

async function withClient(
  databaseUrl,
  operation
) {
  const client =
    new Client({
      connectionString: databaseUrl
    });

  await client.connect();

  try {
    return await operation(client);
  }
  finally {
    await client.end();
  }
}

async function setAccountState(
  databaseUrl,
  userId,
  accountState
) {
  await withClient(
    databaseUrl,
    async (client) => {
      const result =
        await client.query(
          `
          UPDATE product_accounts
          SET
            account_state = $2,
            updated_at = now()
          WHERE user_id = $1
          RETURNING user_id
          `,
          [
            userId,
            accountState
          ]
        );

      assert.equal(
        result.rowCount,
        1,
        `Expected account fixture ${userId}`
      );

      if (accountState === "suspended") {
        await client.query(
          `
          UPDATE beta_accounts
          SET account_state = 'suspended'
          WHERE user_id = $1
          `,
          [userId]
        );
      }
    }
  );
}

async function cleanupAccounts(
  databaseUrl,
  userIds
) {
  if (userIds.length === 0) {
    return;
  }

  await withClient(
    databaseUrl,
    async (client) => {
      await client.query(
        `
        DELETE FROM product_accounts
        WHERE user_id = ANY($1::text[])
        `,
        [userIds]
      );

      await client.query(
        `
        DELETE FROM beta_product_records
        WHERE subject_user_id =
          ANY($1::text[])
        `,
        [userIds]
      );

      await client.query(
        `
        DELETE FROM beta_accounts
        WHERE user_id = ANY($1::text[])
        `,
        [userIds]
      );
    }
  );
}

function accountInput(
  email,
  displayName,
  password,
  actorType = "athlete"
) {
  return {
    actor_type: actorType,
    display_name: displayName,
    email,
    password,
    activity_id:
      actorType === "athlete"
        ? "powerlifting"
        : null,
    accepted_terms: true,
    accepted_consent: true,
    accepted_terms_version:
      "terms_v1",
    accepted_consent_version:
      "consent_v1"
  };
}

test(
  "FULL-UI-02C identity and account state survives fresh processes and revokes sessions",
  {
    timeout: 180000
  },
  async (testContext) => {
    const root = repoRoot();

    const databaseUrl =
      process.env.DATABASE_URL;

    assert.ok(
      typeof databaseUrl === "string" &&
      databaseUrl.trim().length > 0,
      "FULL-UI-02C integration proof requires DATABASE_URL"
    );

    const environment = {
      ...process.env,
      DATABASE_URL: databaseUrl,
      NODE_ENV: "test"
    };

    delete environment.SMOKE_NO_DB;

    const nonce =
      crypto
        .randomUUID()
        .replaceAll("-", "");

    const userIds = [];

    const athleteEmail =
      `identity-athlete-${nonce}@example.test`;

    const athleteUpdatedEmail =
      `identity-athlete-updated-${nonce}@example.test`;

    const coachEmail =
      `identity-coach-${nonce}@example.test`;

    const suspendedEmail =
      `identity-suspended-${nonce}@example.test`;

    const deletedEmail =
      `identity-deleted-${nonce}@example.test`;

    const originalPassword =
      `Original-${nonce}-Password`;

    const changedPassword =
      `Changed-${nonce}-Password`;

    const resetPassword =
      `Reset-${nonce}-Password`;

    let server =
      await startServer(
        root,
        environment
      );

    testContext.after(
      async () => {
        await stopServer(server);

        await cleanupAccounts(
          databaseUrl,
          userIds
        );
      }
    );

    const terms =
      await requestJson(
        server.baseUrl,
        "GET",
        "/account/terms"
      );

    assertStatus(
      terms,
      200,
      "current terms"
    );

    assert.deepEqual(
      {
        terms:
          terms.json
            ?.current_terms_version,
        consent:
          terms.json
            ?.current_consent_version,
        source:
          terms.json?.source
      },
      {
        terms: "terms_v1",
        consent: "consent_v1",
        source:
          "server_authoritative_product_configuration"
      }
    );

    const staleAcceptance =
      await requestJson(
        server.baseUrl,
        "POST",
        "/account/register",
        {
          body: {
            ...accountInput(
              `identity-stale-${nonce}@example.test`,
              "Stale Version",
              originalPassword
            ),
            accepted_terms_version:
              "terms_stale"
          }
        }
      );

    assertStatus(
      staleAcceptance,
      409,
      "stale acceptance"
    );

    assert.equal(
      staleAcceptance.json?.error,
      "account_acceptance_version_mismatch"
    );

    const athleteRegistration =
      await requestJson(
        server.baseUrl,
        "POST",
        "/account/register",
        {
          body: accountInput(
            athleteEmail,
            "Identity Athlete",
            originalPassword
          )
        }
      );

    assertStatus(
      athleteRegistration,
      201,
      "athlete registration"
    );

    const athleteUserId =
      String(
        athleteRegistration
          .json?.account?.user_id ??
        ""
      );

    assert.ok(athleteUserId);
    userIds.push(athleteUserId);

    assert.equal(
      athleteRegistration
        .json?.account?.actor_type,
      "athlete"
    );

    assert.equal(
      athleteRegistration
        .json?.account?.account_state,
      "active"
    );

    assert.equal(
      athleteRegistration
        .json?.account?.actor_home_route,
      "#/athlete/today"
    );

    assert.equal(
      athleteRegistration
        .json?.account
        ?.accepted_terms_version,
      "terms_v1"
    );

    assert.equal(
      athleteRegistration
        .json?.account
        ?.accepted_consent_version,
      "consent_v1"
    );

    const athleteCookie =
      sessionCookie(
        athleteRegistration,
        "athlete registration"
      );

    const athleteCsrf =
      String(
        athleteRegistration
          .json?.csrf_token ??
        ""
      );

    assert.ok(athleteCsrf);

    const initialSession =
      await requestJson(
        server.baseUrl,
        "GET",
        "/account/session",
        {
          cookie: athleteCookie
        }
      );

    assertStatus(
      initialSession,
      200,
      "initial athlete session"
    );

    assert.equal(
      initialSession
        .json?.account?.actor_type,
      "athlete"
    );

    const initialDetail =
      await requestJson(
        server.baseUrl,
        "GET",
        "/account/detail",
        {
          cookie: athleteCookie
        }
      );

    assertStatus(
      initialDetail,
      200,
      "initial account detail"
    );

    assert.equal(
      initialDetail
        .json?.terms
        ?.current_terms_version,
      "terms_v1"
    );

    assert.ok(
      initialDetail
        .json?.consent_history
        ?.some(
          (entry) =>
            entry.event_type ===
            "terms_and_consent_accepted" &&
            entry.event_payload
              ?.terms_version ===
              "terms_v1" &&
            entry.event_payload
              ?.consent_version ===
              "consent_v1"
        ),
      "Expected versioned consent history"
    );

    const firstProcessId =
      server.child.pid;

    server =
      await restartServer(
        server,
        root,
        environment
      );

    assert.notEqual(
      server.child.pid,
      firstProcessId,
      "Expected a fresh server process"
    );

    const restoredSession =
      await requestJson(
        server.baseUrl,
        "GET",
        "/account/session",
        {
          cookie: athleteCookie
        }
      );

    assertStatus(
      restoredSession,
      200,
      "restored athlete session"
    );

    assert.equal(
      restoredSession
        .json?.account?.user_id,
      athleteUserId
    );

    assert.equal(
      restoredSession
        .json?.account
        ?.actor_home_route,
      "#/athlete/today"
    );

    const verificationRequest =
      await requestJson(
        server.baseUrl,
        "POST",
        "/account/email-verification/request",
        {
          cookie: athleteCookie,
          csrf: athleteCsrf,
          body: {}
        }
      );

    assertStatus(
      verificationRequest,
      202,
      "verification request"
    );

    const verificationCode =
      String(
        verificationRequest
          .json?.development_code ??
        ""
      );

    assert.match(
      verificationCode,
      /^\d{6}$/u
    );

    const verificationComplete =
      await requestJson(
        server.baseUrl,
        "POST",
        "/account/email-verification/complete",
        {
          cookie: athleteCookie,
          csrf: athleteCsrf,
          body: {
            code: verificationCode
          }
        }
      );

    assertStatus(
      verificationComplete,
      200,
      "verification complete"
    );

    assert.equal(
      verificationComplete
        .json?.account?.email_verified,
      true
    );

    const profileUpdate =
      await requestJson(
        server.baseUrl,
        "PATCH",
        "/account/profile",
        {
          cookie: athleteCookie,
          csrf: athleteCsrf,
          body: {
            display_name:
              "Identity Athlete Updated",
            email:
              athleteUpdatedEmail
          }
        }
      );

    assertStatus(
      profileUpdate,
      200,
      "profile update"
    );

    assert.equal(
      profileUpdate
        .json?.account?.display_name,
      "Identity Athlete Updated"
    );

    assert.equal(
      profileUpdate
        .json?.account?.email,
      athleteUpdatedEmail
    );

    assert.equal(
      profileUpdate
        .json?.account?.email_verified,
      false
    );

    const profileVerificationCode =
      String(
        profileUpdate
          .json?.verification
          ?.development_code ??
        ""
      );

    assert.match(
      profileVerificationCode,
      /^\d{6}$/u
    );

    const profileVerification =
      await requestJson(
        server.baseUrl,
        "POST",
        "/account/email-verification/complete",
        {
          cookie: athleteCookie,
          csrf: athleteCsrf,
          body: {
            code:
              profileVerificationCode
          }
        }
      );

    assertStatus(
      profileVerification,
      200,
      "updated email verification"
    );

    const secondSession =
      await requestJson(
        server.baseUrl,
        "POST",
        "/account/sign-in",
        {
          body: {
            email:
              athleteUpdatedEmail,
            password:
              originalPassword
          }
        }
      );

    assertStatus(
      secondSession,
      200,
      "second session"
    );

    const secondCookie =
      sessionCookie(
        secondSession,
        "second session"
      );

    const passwordChange =
      await requestJson(
        server.baseUrl,
        "POST",
        "/account/password/change",
        {
          cookie: athleteCookie,
          csrf: athleteCsrf,
          body: {
            current_password:
              originalPassword,
            new_password:
              changedPassword
          }
        }
      );

    assertStatus(
      passwordChange,
      204,
      "password change"
    );

    server =
      await restartServer(
        server,
        root,
        environment
      );

    const originalSessionAfterPasswordChange =
      await requestJson(
        server.baseUrl,
        "GET",
        "/account/session",
        {
          cookie: athleteCookie
        }
      );

    assertStatus(
      originalSessionAfterPasswordChange,
      200,
      "current session after password change"
    );

    const secondSessionAfterPasswordChange =
      await requestJson(
        server.baseUrl,
        "GET",
        "/account/session",
        {
          cookie: secondCookie
        }
      );

    assertStatus(
      secondSessionAfterPasswordChange,
      401,
      "other session revoked by password change"
    );

    const signOut =
      await requestJson(
        server.baseUrl,
        "POST",
        "/account/sign-out",
        {
          cookie: athleteCookie,
          csrf: athleteCsrf,
          body: {}
        }
      );

    assertStatus(
      signOut,
      204,
      "sign out"
    );

    server =
      await restartServer(
        server,
        root,
        environment
      );

    const signedOutSession =
      await requestJson(
        server.baseUrl,
        "GET",
        "/account/session",
        {
          cookie: athleteCookie
        }
      );

    assertStatus(
      signedOutSession,
      401,
      "signed-out session remains revoked"
    );

    const changedPasswordSignIn =
      await requestJson(
        server.baseUrl,
        "POST",
        "/account/sign-in",
        {
          body: {
            email:
              athleteUpdatedEmail,
            password:
              changedPassword
          }
        }
      );

    assertStatus(
      changedPasswordSignIn,
      200,
      "sign in after password change"
    );

    const changedPasswordCookie =
      sessionCookie(
        changedPasswordSignIn,
        "changed-password sign in"
      );

    const passwordResetRequest =
      await requestJson(
        server.baseUrl,
        "POST",
        "/account/password/reset/request",
        {
          body: {
            email:
              athleteUpdatedEmail
          }
        }
      );

    assertStatus(
      passwordResetRequest,
      202,
      "password reset request"
    );

    const resetCode =
      String(
        passwordResetRequest
          .json?.development_code ??
        ""
      );

    assert.match(
      resetCode,
      /^\d{6}$/u
    );

    const passwordResetComplete =
      await requestJson(
        server.baseUrl,
        "POST",
        "/account/password/reset/complete",
        {
          body: {
            email:
              athleteUpdatedEmail,
            code:
              resetCode,
            new_password:
              resetPassword
          }
        }
      );

    assertStatus(
      passwordResetComplete,
      204,
      "password reset complete"
    );

    server =
      await restartServer(
        server,
        root,
        environment
      );

    const preResetSession =
      await requestJson(
        server.baseUrl,
        "GET",
        "/account/session",
        {
          cookie:
            changedPasswordCookie
        }
      );

    assertStatus(
      preResetSession,
      401,
      "password reset revokes active sessions"
    );

    const resetPasswordSignIn =
      await requestJson(
        server.baseUrl,
        "POST",
        "/account/sign-in",
        {
          body: {
            email:
              athleteUpdatedEmail,
            password:
              resetPassword
          }
        }
      );

    assertStatus(
      resetPasswordSignIn,
      200,
      "sign in after password reset"
    );

    const resetPasswordCookie =
      sessionCookie(
        resetPasswordSignIn,
        "reset-password sign in"
      );

    const resetPasswordCsrf =
      String(
        resetPasswordSignIn
          .json?.csrf_token ??
        ""
      );

    const closure =
      await requestJson(
        server.baseUrl,
        "POST",
        "/account/closure",
        {
          cookie:
            resetPasswordCookie,
          csrf:
            resetPasswordCsrf,
          body: {
            confirmation: "CLOSE"
          }
        }
      );

    assertStatus(
      closure,
      202,
      "account closure"
    );

    server =
      await restartServer(
        server,
        root,
        environment
      );

    const closedSignIn =
      await requestJson(
        server.baseUrl,
        "POST",
        "/account/sign-in",
        {
          body: {
            email:
              athleteUpdatedEmail,
            password:
              resetPassword
          }
        }
      );

    assertStatus(
      closedSignIn,
      423,
      "closed account sign in"
    );

    assert.equal(
      closedSignIn
        .json?.account_state,
      "closed"
    );

    const coachRegistration =
      await requestJson(
        server.baseUrl,
        "POST",
        "/account/register",
        {
          body: accountInput(
            coachEmail,
            "Identity Coach",
            originalPassword,
            "coach"
          )
        }
      );

    assertStatus(
      coachRegistration,
      201,
      "coach registration"
    );

    const coachUserId =
      String(
        coachRegistration
          .json?.account?.user_id ??
        ""
      );

    assert.ok(coachUserId);
    userIds.push(coachUserId);

    assert.equal(
      coachRegistration
        .json?.account?.actor_type,
      "coach"
    );

    assert.equal(
      coachRegistration
        .json?.account
        ?.actor_home_route,
      "#/coach/overview"
    );

    const coachCookie =
      sessionCookie(
        coachRegistration,
        "coach registration"
      );

    server =
      await restartServer(
        server,
        root,
        environment
      );

    const coachSession =
      await requestJson(
        server.baseUrl,
        "GET",
        "/account/session",
        {
          cookie: coachCookie
        }
      );

    assertStatus(
      coachSession,
      200,
      "coach session after restart"
    );

    assert.equal(
      coachSession
        .json?.account?.actor_type,
      "coach"
    );

    assert.equal(
      coachSession
        .json?.account
        ?.actor_home_route,
      "#/coach/overview"
    );

    const suspendedRegistration =
      await requestJson(
        server.baseUrl,
        "POST",
        "/account/register",
        {
          body: accountInput(
            suspendedEmail,
            "Suspended Account",
            originalPassword
          )
        }
      );

    assertStatus(
      suspendedRegistration,
      201,
      "suspended fixture registration"
    );

    const suspendedUserId =
      String(
        suspendedRegistration
          .json?.account?.user_id ??
        ""
      );

    assert.ok(suspendedUserId);
    userIds.push(suspendedUserId);

    const deletedRegistration =
      await requestJson(
        server.baseUrl,
        "POST",
        "/account/register",
        {
          body: accountInput(
            deletedEmail,
            "Deleted Account",
            originalPassword
          )
        }
      );

    assertStatus(
      deletedRegistration,
      201,
      "deleted fixture registration"
    );

    const deletedUserId =
      String(
        deletedRegistration
          .json?.account?.user_id ??
        ""
      );

    assert.ok(deletedUserId);
    userIds.push(deletedUserId);

    await setAccountState(
      databaseUrl,
      suspendedUserId,
      "suspended"
    );

    await setAccountState(
      databaseUrl,
      deletedUserId,
      "deleted"
    );

    server =
      await restartServer(
        server,
        root,
        environment
      );

    const suspendedSignIn =
      await requestJson(
        server.baseUrl,
        "POST",
        "/account/sign-in",
        {
          body: {
            email:
              suspendedEmail,
            password:
              originalPassword
          }
        }
      );

    assertStatus(
      suspendedSignIn,
      423,
      "suspended account sign in"
    );

    assert.equal(
      suspendedSignIn
        .json?.account_state,
      "suspended"
    );

    const deletedSignIn =
      await requestJson(
        server.baseUrl,
        "POST",
        "/account/sign-in",
        {
          body: {
            email:
              deletedEmail,
            password:
              originalPassword
          }
        }
      );

    assertStatus(
      deletedSignIn,
      423,
      "deleted account sign in"
    );

    assert.equal(
      deletedSignIn
        .json?.account_state,
      "deleted"
    );

    const finalTerms =
      await requestJson(
        server.baseUrl,
        "GET",
        "/account/terms"
      );

    assertStatus(
      finalTerms,
      200,
      "terms after fresh process"
    );

    assert.deepEqual(
      finalTerms.json,
      terms.json,
      "Current terms changed across fresh processes"
    );
  }
);
