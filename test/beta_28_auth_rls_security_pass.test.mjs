// DEV NOTE: BETA-28 auth, RLS and protected-route security proof.

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  BETA28_AUDIT_EVENT_TYPES,
  BETA28_FAILURE_TOKENS,
  BETA28_RELATIONSHIP_STATUSES,
  BETA28_RESOURCE_TYPES,
  beta28AuthRlsSecurityContract,
  buildBeta28AuthRlsSecurityManifest,
  createBeta28AuthRlsSecurityService,
  verifyBeta28AuthRlsSecurityManifest
} from "../replay/runtime/beta28AuthRlsSecurity.mjs";

import {
  createBeta28ProtectedResourceApi
} from "../src/api/beta28ProtectedResourceApi.mjs";

function readText(path) {
  return fs.readFileSync(
    path,
    "utf8"
  );
}

function readJson(path) {
  return JSON.parse(
    readText(path)
  );
}

function principal(
  userId,
  actorType =
    "individual_user",
  accountState =
    "active",
  authenticated =
    true
) {
  return {
    authenticated,
    user_id:
      userId,
    actor_type:
      actorType,
    account_state:
      accountState
  };
}

function resource(
  resourceType,
  ownerUserId =
    "individual_user_001",
  sealed =
    false,
  resourceId =
    `${resourceType}_001`
) {
  return {
    resource_id:
      resourceId,
    resource_type:
      resourceType,
    owner_user_id:
      ownerUserId,
    sealed
  };
}

function relationship(
  status =
    "active",
  options = {}
) {
  return {
    relationship_id:
      "relationship_001",
    coach_user_id:
      options.coach_user_id ??
      "coach_001",
    individual_user_id:
      options.individual_user_id ??
      "individual_user_001",
    status,
    permitted_resource_types:
      options
        .permitted_resource_types ??
      [
        ...BETA28_RESOURCE_TYPES
      ],
    permitted_actions:
      options
        .permitted_actions ??
      [
        "read",
        "write",
        "export"
      ]
  };
}

function request(
  principalValue,
  resourceValue,
  action,
  relationshipValue =
    null
) {
  return {
    principal:
      principalValue,
    relationship:
      relationshipValue,
    resource:
      resourceValue,
    action
  };
}

function expectFailure(
  result,
  token
) {
  assert.equal(
    result.ok,
    false
  );

  assert.equal(
    result.failure_token,
    token
  );
}

function manifestFileTexts() {
  return {
    contract:
      readText(
        "replay/contracts/beta28_auth_rls_security_contract.json"
      ),
    failure_tokens:
      readText(
        "replay/contracts/beta28_auth_rls_security_failure_tokens.json"
      ),
    runtime_security:
      readText(
        "replay/runtime/beta28AuthRlsSecurity.mjs"
      ),
    api_adapter:
      readText(
        "src/api/beta28ProtectedResourceApi.mjs"
      ),
    rls_migration:
      readText(
        "migrations/20260714_beta28_auth_rls_security.sql"
      ),
    session_readback:
      readText(
        "src/sessionStateEventsReadback.mjs"
      ),
    relationship_guard:
      readText(
        "src/relationshipPermissionGuards.mjs"
      ),
    coach_managed_service:
      readText(
        "src/api/beta17_coach_managed_service.ts"
      ),
    beta26_runtime:
      readText(
        "replay/runtime/beta26EvidenceImmutableStore.mjs"
      ),
    beta27_runtime:
      readText(
        "replay/runtime/beta27ProjectionEvidenceExport.mjs"
      ),
    secret_scan:
      readText(
        "ci/scripts/run_beta_28_secret_scan.mjs"
      ),
    dependency_audit:
      readText(
        "ci/scripts/run_beta_28_dependency_audit.mjs"
      )
  };
}

test(
  "BETA-28 contract closes owner relationship suspension and sealed-mutation boundaries",
  () => {
    assert.deepEqual(
      readJson(
        "replay/contracts/beta28_auth_rls_security_contract.json"
      ),
      beta28AuthRlsSecurityContract
    );

    assert.deepEqual(
      readJson(
        "replay/contracts/beta28_auth_rls_security_failure_tokens.json"
      ).tokens,
      BETA28_FAILURE_TOKENS
    );

    assert.deepEqual(
      beta28AuthRlsSecurityContract
        .resource_types,
      BETA28_RESOURCE_TYPES
    );

    assert.deepEqual(
      beta28AuthRlsSecurityContract
        .relationship_statuses,
      BETA28_RELATIONSHIP_STATUSES
    );

    assert.equal(
      beta28AuthRlsSecurityContract
        .owner_only_session_access,
      true
    );

    assert.equal(
      beta28AuthRlsSecurityContract
        .revoked_coach_lockout,
      true
    );

    assert.equal(
      beta28AuthRlsSecurityContract
        .suspended_account_lockout,
      true
    );

    assert.equal(
      beta28AuthRlsSecurityContract
        .sealed_artifact_mutation_allowed,
      false
    );

    assert.equal(
      beta28AuthRlsSecurityContract
        .resource_owner_from_client,
      false
    );
  }
);

test(
  "BETA-28 unauthenticated access fails closed",
  () => {
    const service =
      createBeta28AuthRlsSecurityService();

    expectFailure(
      service.authorize(
        request(
          null,
          resource("session"),
          "read"
        )
      ),
      "beta28_unauthenticated"
    );
  }
);

test(
  "BETA-28 individual session access is owner-only",
  () => {
    const service =
      createBeta28AuthRlsSecurityService();

    assert.equal(
      service.authorize(
        request(
          principal(
            "individual_user_001"
          ),
          resource("session"),
          "read"
        )
      ).ok,
      true
    );

    expectFailure(
      service.authorize(
        request(
          principal(
            "individual_user_999"
          ),
          resource("session"),
          "read"
        )
      ),
      "beta28_owner_scope_denied"
    );
  }
);

test(
  "BETA-28 suspended individual and coach accounts are locked out",
  () => {
    for (
      const actorType
      of [
        "individual_user",
        "coach"
      ]
    ) {
      const service =
        createBeta28AuthRlsSecurityService();

      expectFailure(
        service.authorize(
          request(
            principal(
              actorType === "coach"
                ? "coach_001"
                : "individual_user_001",
              actorType,
              "suspended"
            ),
            resource("evidence", undefined, true),
            "read",
            actorType === "coach"
              ? relationship("active")
              : null
          )
        ),
        "beta28_account_suspended"
      );
    }
  }
);

test(
  "BETA-28 revoked coach is blocked from sessions evidence exports and notes",
  () => {
    for (
      const [
        resourceType,
        action,
        sealed
      ]
      of [
        [
          "session",
          "read",
          false
        ],
        [
          "evidence",
          "read",
          true
        ],
        [
          "export",
          "export",
          true
        ],
        [
          "coach_note",
          "write",
          false
        ]
      ]
    ) {
      const service =
        createBeta28AuthRlsSecurityService();

      expectFailure(
        service.authorize(
          request(
            principal(
              "coach_001",
              "coach"
            ),
            resource(
              resourceType,
              undefined,
              sealed
            ),
            action,
            relationship("revoked")
          )
        ),
        "beta28_revoked_coach_denied"
      );
    }
  }
);

test(
  "BETA-28 active coach is relationship and policy scoped",
  () => {
    const service =
      createBeta28AuthRlsSecurityService();

    assert.equal(
      service.authorize(
        request(
          principal(
            "coach_001",
            "coach"
          ),
          resource("session"),
          "write",
          relationship("active")
        )
      ).ok,
      true
    );

    expectFailure(
      service.authorize(
        request(
          principal(
            "coach_001",
            "coach"
          ),
          resource("evidence", undefined, true),
          "read",
          relationship(
            "active",
            {
              permitted_resource_types: [
                "projection"
              ]
            }
          )
        )
      ),
      "beta28_policy_scope_denied"
    );

    expectFailure(
      service.authorize(
        request(
          principal(
            "coach_999",
            "coach"
          ),
          resource("session"),
          "read",
          relationship("active")
        )
      ),
      "beta28_relationship_denied"
    );
  }
);

test(
  "BETA-28 archived coach may read historical artefacts and export but not write sessions or notes",
  () => {
    const service =
      createBeta28AuthRlsSecurityService();

    for (
      const resourceType
      of [
        "projection",
        "replay_verdict",
        "evidence"
      ]
    ) {
      assert.equal(
        service.authorize(
          request(
            principal(
              "coach_001",
              "coach"
            ),
            resource(
              resourceType,
              undefined,
              true
            ),
            "read",
            relationship("archived")
          )
        ).ok,
        true
      );
    }

    assert.equal(
      service.authorize(
        request(
          principal(
            "coach_001",
            "coach"
          ),
          resource("export", undefined, true),
          "export",
          relationship("archived")
        )
      ).ok,
      true
    );

    expectFailure(
      service.authorize(
        request(
          principal(
            "coach_001",
            "coach"
          ),
          resource("session"),
          "write",
          relationship("archived")
        )
      ),
      "beta28_relationship_denied"
    );

    expectFailure(
      service.authorize(
        request(
          principal(
            "coach_001",
            "coach"
          ),
          resource("coach_note"),
          "write",
          relationship("archived")
        )
      ),
      "beta28_relationship_denied"
    );
  }
);

test(
  "BETA-28 projection replay verdict evidence and export are protected",
  () => {
    const service =
      createBeta28AuthRlsSecurityService();

    for (
      const [
        resourceType,
        action
      ]
      of [
        [
          "projection",
          "read"
        ],
        [
          "replay_verdict",
          "read"
        ],
        [
          "evidence",
          "read"
        ],
        [
          "export",
          "export"
        ]
      ]
    ) {
      assert.equal(
        service.authorize(
          request(
            principal(
              "individual_user_001"
            ),
            resource(
              resourceType,
              undefined,
              true
            ),
            action
          )
        ).ok,
        true
      );

      expectFailure(
        service.authorize(
          request(
            principal(
              "individual_user_999"
            ),
            resource(
              resourceType,
              undefined,
              true
            ),
            action
          )
        ),
        "beta28_owner_scope_denied"
      );
    }
  }
);

test(
  "BETA-28 sealed artefact mutation is denied before operation execution",
  async () => {
    const service =
      createBeta28AuthRlsSecurityService();

    let operationCalls = 0;

    const result =
      await service.protectOperation(
        request(
          principal(
            "individual_user_001"
          ),
          resource(
            "evidence",
            undefined,
            true
          ),
          "mutate"
        ),
        async () => {
          operationCalls += 1;
          return "should-not-run";
        }
      );

    expectFailure(
      result,
      "beta28_sealed_artifact_mutation_denied"
    );

    assert.equal(
      operationCalls,
      0
    );
  }
);

test(
  "BETA-28 protected export adapter returns exact successful response without mutation",
  async () => {
    const service =
      createBeta28AuthRlsSecurityService();

    const exactResponse =
      Object.freeze({
        statusCode: 200,
        headers:
          Object.freeze({
            "content-type":
              "application/json"
          }),
        body:
          '{"evidence_envelope_id":"evidence_001"}'
      });

    let operationCalls = 0;

    const api =
      createBeta28ProtectedResourceApi({
        security_service:
          service,
        resolve_resource:
          async ({
            resource_type,
            resource_id
          }) => ({
            resource_id,
            resource_type,
            owner_user_id:
              "individual_user_001",
            sealed: true
          }),
        execute:
          async () => {
            operationCalls += 1;
            return exactResponse;
          }
      });

    const response =
      await api.handle({
        body: {
          principal:
            principal(
              "individual_user_001"
            ),
          relationship: null,
          resource_type:
            "evidence",
          resource_id:
            "evidence_001",
          action:
            "export",
          payload: null
        }
      });

    assert.equal(
      response,
      exactResponse
    );

    assert.equal(
      response.body,
      exactResponse.body
    );

    assert.equal(
      operationCalls,
      1
    );
  }
);

test(
  "BETA-28 protected route blocks unauthenticated wrong-user and revoked-coach requests",
  async () => {
    const service =
      createBeta28AuthRlsSecurityService();

    let operationCalls = 0;

    const api =
      createBeta28ProtectedResourceApi({
        security_service:
          service,
        resolve_resource:
          async ({
            resource_type,
            resource_id
          }) => ({
            resource_id,
            resource_type,
            owner_user_id:
              "individual_user_001",
            sealed: true
          }),
        execute:
          async () => {
            operationCalls += 1;
            return {
              statusCode: 200,
              headers: {},
              body: "{}"
            };
          }
      });

    const base = {
      resource_type:
        "evidence",
      resource_id:
        "evidence_001",
      action:
        "read",
      payload: null
    };

    const unauthenticated =
      await api.handle({
        body: {
          ...base,
          principal: null,
          relationship: null
        }
      });

    assert.equal(
      unauthenticated.statusCode,
      401
    );

    const wrongUser =
      await api.handle({
        body: {
          ...base,
          principal:
            principal(
              "individual_user_999"
            ),
          relationship: null
        }
      });

    assert.equal(
      wrongUser.statusCode,
      403
    );

    const revokedCoach =
      await api.handle({
        body: {
          ...base,
          principal:
            principal(
              "coach_001",
              "coach"
            ),
          relationship:
            relationship("revoked")
        }
      });

    assert.equal(
      revokedCoach.statusCode,
      403
    );

    assert.equal(
      operationCalls,
      0
    );
  }
);

test(
  "BETA-28 audit log records sensitive requests grants denials and sealed mutation denials",
  async () => {
    const service =
      createBeta28AuthRlsSecurityService();

    service.authorize(
      request(
        principal(
          "individual_user_001"
        ),
        resource("session"),
        "read"
      )
    );

    service.authorize(
      request(
        principal(
          "individual_user_999"
        ),
        resource("session"),
        "read"
      )
    );

    await service.protectOperation(
      request(
        principal(
          "individual_user_001"
        ),
        resource(
          "evidence",
          undefined,
          true
        ),
        "mutate"
      ),
      async () => null
    );

    const audit =
      service.readAuditLog();

    const types =
      audit.map(
        (event) =>
          event.event_type
      );

    for (
      const eventType
      of BETA28_AUDIT_EVENT_TYPES
    ) {
      assert.equal(
        types.includes(eventType),
        true,
        eventType
      );
    }

    assert.equal(
      Object.isFrozen(audit),
      true
    );

    assert.equal(
      audit.every(
        (event) =>
          Object.isFrozen(event)
      ),
      true
    );
  }
);

test(
  "BETA-28 SQL migration defines account relationship session artefact note and audit RLS",
  () => {
    const sql =
      readText(
        "migrations/20260714_beta28_auth_rls_security.sql"
      );

    for (
      const token
      of [
        "ENABLE ROW LEVEL SECURITY",
        "app.user_id",
        "app.actor_type",
        "app.account_state",
        "beta28_sessions_owner_or_coach_read",
        "beta28_runtime_events_scoped_write",
        "beta28_artifacts_scoped_read_export",
        "beta28_artifacts_manual_insert_denied",
        "beta28_notes_active_coach_write",
        "beta28_audit_insert",
        "status IN (",
        "'active'",
        "'archived'",
        "beta28_deny_sealed_artifact_mutation",
        "BEFORE UPDATE OR DELETE",
        "beta_security_audit_events"
      ]
    ) {
      assert.equal(
        sql.includes(token),
        true,
        token
      );
    }

    assert.equal(
      sql.includes(
        "FOR INSERT\nWITH CHECK (FALSE)"
      ),
      true
    );
  }
);

test(
  "BETA-28 manifest binds security policy RLS and upstream protected surfaces",
  () => {
    const actual =
      readJson(
        "replay/suite/beta_phase1_8/auth_rls_security_manifest.json"
      );

    const expected =
      buildBeta28AuthRlsSecurityManifest(
        manifestFileTexts()
      );

    assert.deepEqual(
      actual,
      expected
    );

    assert.equal(
      verifyBeta28AuthRlsSecurityManifest(
        actual,
        manifestFileTexts()
      ).ok,
      true
    );
  }
);

test(
  "BETA-28 migration is an exact later-slice exception to the historical S18 guard",
  () => {
    const source =
      readText(
        "ci/guards/v1_boundary_guard_scaffolding_guard.mjs"
      );

    assert.equal(
      source.includes(
        "const explicitLaterSliceAllowedChangedPaths"
      ),
      true
    );

    assert.equal(
      source.split(
        `"${"migrations/20260714_beta28_auth_rls_security.sql"}"`
      ).length - 1,
      1
    );

    assert.equal(
      source.includes(
        "explicitLaterSliceAllowedChangedPaths\n      .has(normalised)"
      ),
      true
    );

    assert.equal(
      source.includes(
        "forbiddenChangedPathFragments"
      ),
      true
    );

    assert.equal(
      source.includes(
        '"migrations/"'
      ),
      true
    );

    assert.equal(
      source.includes(
        '"db/migrations/"'
      ),
      true
    );
  }
);

test(
  "BETA-28 v0 compatibility uses exact path exclusions",
  () => {
    const source =
      readText(
        "ci/scripts/kolosseum_v0_test_suite_core.mjs"
      );

    for (
      const exactPath
      of [
        "replay/runtime/beta28AuthRlsSecurity.mjs",
        "src/api/beta28ProtectedResourceApi.mjs",
        "replay/contracts/beta28_auth_rls_security_contract.json",
        "replay/contracts/beta28_auth_rls_security_failure_tokens.json",
        "replay/suite/beta_phase1_8/auth_rls_security_manifest.json",
        "migrations/20260714_beta28_auth_rls_security.sql"
      ]
    ) {
      assert.equal(
        source.split(
          `"${exactPath}"`
        ).length - 1,
        1,
        exactPath
      );
    }
  }
);
