import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

const manifest = JSON.parse(
  fs.readFileSync(
    path.join(root, "product", "ui", "function_manifest.json"),
    "utf8"
  )
);

const targets = [
  {
    "area": "assignments",
    "id": "assignment_replace",
    "source": [
      {
        "path": "public/app-src/api/coachWorkspaceClient.ts",
        "all": [
          "function replaceAthleteAssignment("
        ]
      },
      {
        "path": "src/api/product_assignment.routes.ts",
        "all": [
          "assignment_replaced"
        ]
      }
    ],
    "prior": [
      {
        "path": "test/full_ui_06_assignment_management.test.mjs",
        "all": [
          "FULL-UI-06 creates replace and cancel routes",
          "FULL-UI-06 appends factual replacement and cancellation records"
        ]
      }
    ]
  },
  {
    "area": "assignments",
    "id": "assignment_cancel",
    "source": [
      {
        "path": "public/app/index.html",
        "all": [
          "athlete-profile-assignment-root"
        ]
      },
      {
        "path": "public/app-src/screens/coach/AthleteProfileAssignmentPanel.tsx",
        "all": [
          "Cancel future assignment"
        ]
      },
      {
        "path": "src/api/product_assignment.routes.ts",
        "all": [
          "assignment_cancelled"
        ]
      }
    ],
    "prior": [
      {
        "path": "test/full_ui_06_assignment_management.test.mjs",
        "all": [
          "FULL-UI-06 creates replace and cancel routes",
          "FULL-UI-06 preserves existing sessions and only blocks future creation"
        ]
      }
    ]
  },
  {
    "area": "assignments",
    "id": "assignment_history",
    "source": [
      {
        "path": "public/app/app.js",
        "all": [
          "assignment_history"
        ]
      },
      {
        "path": "public/app/index.html",
        "all": [
          "athlete-profile-assignment-root"
        ]
      },
      {
        "path": "public/app-src/screens/coach/AthleteProfileAssignmentPanel.tsx",
        "all": [
          "athlete-assignment-history"
        ]
      }
    ],
    "prior": [
      {
        "path": "test/full_ui_06_assignment_management.test.mjs",
        "all": [
          "FULL-UI-06 exposes current assignment and immutable history controls"
        ]
      }
    ]
  },
  {
    "area": "athlete_directory",
    "id": "athlete_search_filter",
    "source": [
      {
        "path": "public/app/index.html",
        "all": [
          "athlete-directory-root"
        ]
      },
      {
        "path": "public/app-src/screens/coach/AthleteDirectoryPanel.tsx",
        "all": [
          "Search athletes",
          "Relationship state"
        ]
      }
    ],
    "prior": [
      {
        "path": "test/full_ui_04a_coach_athlete_directory.test.mjs",
        "all": [
          "FULL-UI-04A provides search filters counts and audit facts"
        ]
      }
    ]
  },
  {
    "area": "athlete_directory",
    "id": "athlete_assignment_history",
    "source": [
      {
        "path": "public/app-src/screens/coach/AthleteHistoryPanels.tsx",
        "all": [
          "AthleteAssignmentHistoryList"
        ]
      },
      {
        "path": "src/api/beta19_coach_workspace_service.ts",
        "all": [
          "assignment_history"
        ]
      }
    ],
    "prior": [
      {
        "path": "test/full_ui_04b_coach_athlete_detail.test.mjs",
        "all": [
          "FULL-UI-04B returns factual programme profile event session and note history"
        ]
      }
    ]
  },
  {
    "area": "athlete_directory",
    "id": "athlete_bodyweight_history",
    "source": [
      {
        "path": "public/app-src/screens/coach/AthleteHistoryPanels.tsx",
        "all": [
          "AthleteBodyweightHistoryList"
        ]
      },
      {
        "path": "src/api/beta19_coach_workspace_service.ts",
        "all": [
          "bodyweight_history"
        ]
      }
    ],
    "prior": [
      {
        "path": "test/full_ui_04b_coach_athlete_detail.test.mjs",
        "all": [
          "FULL-UI-04B returns factual programme profile event session and note history"
        ]
      }
    ]
  },
  {
    "area": "athlete_directory",
    "id": "athlete_notes_list",
    "source": [
      {
        "path": "schema.sql",
        "all": [
          "product_coach_notes"
        ]
      },
      {
        "path": "src/api/beta19_coach_workspace_service.ts",
        "any": [
          "note_history",
          "notes_history",
          "coach_notes"
        ]
      }
    ],
    "prior": [
      {
        "path": "test/full_ui_04b_coach_athlete_detail.test.mjs",
        "all": [
          "FULL-UI-04B returns factual programme profile event session and note history",
          "FULL-UI-04B persists non-binding notes separately from artefacts"
        ]
      }
    ]
  },
  {
    "area": "coach_commercial",
    "id": "subscription_state",
    "source": [
      {
        "path": "public/app-src/screens/account/CommercialPanel.tsx",
        "all": [
          "commercial.subscription_state"
        ]
      },
      {
        "path": "src/api/product_commercial_service.ts",
        "all": [
          "function subscriptionState("
        ]
      }
    ],
    "prior": [
      {
        "path": "public/app-src/__tests__/CommercialPanel.test.tsx",
        "all": [
          "loads and displays factual subscription, access, billing and seat state"
        ]
      }
    ]
  },
  {
    "area": "coach_commercial",
    "id": "seat_allowance",
    "source": [
      {
        "path": "public/app-src/screens/account/CommercialPanel.tsx",
        "all": [
          "commercial.seat_limit",
          "commercial.occupied_seat_count"
        ]
      }
    ],
    "prior": [
      {
        "path": "public/app-src/__tests__/CommercialPanel.test.tsx",
        "all": [
          "loads and displays factual subscription, access, billing and seat state"
        ]
      }
    ]
  },
  {
    "area": "coach_commercial",
    "id": "checkout_entry",
    "source": [
      {
        "path": "public/app-src/screens/account/CommercialPanel.tsx",
        "all": [
          "openCheckout"
        ]
      },
      {
        "path": "src/api/product_commercial_service.ts",
        "all": [
          "commercial_checkout_requested"
        ]
      }
    ],
    "prior": [
      {
        "path": "public/app-src/__tests__/CommercialPanel.test.tsx",
        "all": [
          "requesting checkout with no checkout_url shows the provider-inert result message"
        ]
      }
    ]
  },
  {
    "area": "coach_commercial",
    "id": "payment_return",
    "source": [
      {
        "path": "public/app-src/api/commercialClient.ts",
        "all": [
          "recordCommercialPaymentReturn",
          "/account/commercial/payment-return"
        ]
      },
      {
        "path": "schema.sql",
        "all": [
          "commercial_payment_return_recorded"
        ]
      }
    ],
    "prior": [
      {
        "path": "public/app-src/__tests__/CommercialPanel.test.tsx",
        "all": [
          "a payment return in the URL records the outcome, shows the confirmation-pending notice, and strips the query params"
        ]
      }
    ]
  },
  {
    "area": "coach_commercial",
    "id": "billing_portal",
    "source": [
      {
        "path": "public/app-src/api/commercialClient.ts",
        "all": [
          "requestCommercialBillingPortal"
        ]
      },
      {
        "path": "public/app-src/screens/account/CommercialPanel.tsx",
        "all": [
          "openBillingPortal"
        ]
      }
    ],
    "prior": [
      {
        "path": "public/app-src/__tests__/CommercialPanel.test.tsx",
        "all": [
          "the billing portal button is disabled until the server marks the portal as available"
        ]
      }
    ]
  },
  {
    "area": "coach_commercial",
    "id": "entitlement_error",
    "source": [
      {
        "path": "public/app-src/screens/account/CommercialPanel.tsx",
        "all": [
          "commercial-entitlement-error"
        ]
      },
      {
        "path": "public/app-src/screens/account/useCommercialAccount.ts",
        "all": [
          "entitlement_error"
        ]
      }
    ],
    "prior": [
      {
        "path": "public/app-src/__tests__/CommercialPanel.test.tsx",
        "all": [
          "an entitlement error is shown as a factual notice, distinct from the general result message"
        ]
      }
    ]
  },
  {
    "area": "coach_overview",
    "id": "overview_assignment_queue",
    "source": [
      {
        "path": "public/app/index.html",
        "any": [
          "coach-overview-assignments-root",
          "Action queue"
        ]
      }
    ],
    "prior": [
      {
        "path": "test/full_ui_03_coach_dashboard.test.mjs",
        "all": [
          "FULL-UI-03 exposes the complete factual coach dashboard",
          "FULL-UI-03 retains every canonical coach-overview function",
          "overview_assignment_queue"
        ]
      }
    ]
  },
  {
    "area": "coach_overview",
    "id": "overview_open_sessions",
    "source": [
      {
        "path": "public/app/index.html",
        "all": [
          "Open sessions",
          "coach-overview-open-sessions-root"
        ]
      }
    ],
    "prior": [
      {
        "path": "test/full_ui_03_coach_dashboard.test.mjs",
        "all": [
          "FULL-UI-03 exposes the complete factual coach dashboard",
          "overview_open_sessions"
        ]
      }
    ]
  },
  {
    "area": "coach_overview",
    "id": "overview_completed_since_review",
    "source": [
      {
        "path": "public/app/index.html",
        "any": [
          "Completed since review",
          "Awaiting review",
          "coachAwaitingReviewCount"
        ]
      }
    ],
    "prior": [
      {
        "path": "test/full_ui_03_coach_dashboard.test.mjs",
        "all": [
          "FULL-UI-03 exposes the complete factual coach dashboard",
          "overview_completed_since_review"
        ]
      }
    ]
  },
  {
    "area": "coach_review",
    "id": "review_open_sessions",
    "source": [
      {
        "path": "public/app-src/screens/coach/CoachReviewPanel.tsx",
        "any": [
          "open read-only sessions"
        ]
      },
      {
        "path": "src/api/product_review.routes.ts",
        "all": [
          "Open sessions cannot be marked reviewed"
        ]
      },
      {
        "path": "public/app-src/screens/coach/CoachOverviewSessionReviewPanel.tsx",
        "all": [
          "CoachOverviewOpenSessionsPanel"
        ]
      }
    ],
    "prior": [
      {
        "path": "test/full_ui_07_review_queue.test.mjs",
        "all": [
          "FULL-UI-07 exposes searchable review queue controls and factual detail",
          "Open sessions cannot be marked reviewed"
        ]
      }
    ]
  },
  {
    "area": "coach_review",
    "id": "review_note_list",
    "source": [
      {
        "path": "public/app-src/screens/coach/CoachReviewPanel.tsx",
        "all": [
          "review-note-list"
        ]
      }
    ],
    "prior": [
      {
        "path": "test/full_ui_07_review_queue.test.mjs",
        "all": [
          "FULL-UI-07 displays provenance live status and note visibility"
        ]
      }
    ]
  },
  {
    "area": "coach_review",
    "id": "review_state",
    "source": [
      {
        "path": "schema.sql",
        "all": [
          "product_session_reviews"
        ]
      },
      {
        "path": "public/app-src/screens/coach/useCoachOverviewSessionReview.ts",
        "all": [
          "review_status",
          "awaiting_review"
        ]
      }
    ],
    "prior": [
      {
        "path": "test/full_ui_07_review_queue.test.mjs",
        "all": [
          "FULL-UI-07 stores immutable reviewed and unreviewed product state",
          "FULL-UI-07 mounts factual read and review-state routes"
        ]
      }
    ]
  },
  {
    "area": "identity_account",
    "id": "account_sign_in",
    "source": [
      {
        "path": "public/app/account_ui.js",
        "all": [
          "signInAccount",
          "/account/sign-in"
        ]
      }
    ],
    "prior": [
      {
        "path": "test/full_ui_02_account_ui.test.mjs",
        "all": [
          "FULL-UI-02 exposes every account function through normal UI controls"
        ]
      },
      {
        "path": "test/full_ui_02_account_routes.test.mjs",
        "all": [
          "FULL-UI-02 exposes the complete account HTTP surface"
        ]
      }
    ]
  },
  {
    "area": "identity_account",
    "id": "authenticated_session",
    "source": [
      {
        "path": "src/api/product_account.routes.ts",
        "all": [
          "PRODUCT_SESSION_COOKIE",
          "setSessionCookie"
        ]
      }
    ],
    "prior": [
      {
        "path": "test/full_ui_02_account_bootstrap.test.mjs",
        "all": [
          "FULL-UI-02 returns product bootstrap records with every session"
        ]
      },
      {
        "path": "test/full_ui_08_account_commercial.test.mjs",
        "all": [
          "FULL-UI-08 mounts authenticated commercial account routes"
        ]
      }
    ]
  },
  {
    "area": "identity_account",
    "id": "email_verification",
    "source": [
      {
        "path": "public/app/account_ui.js",
        "all": [
          "requestEmailVerification",
          "completeEmailVerification",
          "/account/email-verification/request"
        ]
      }
    ],
    "prior": [
      {
        "path": "test/full_ui_02_account_routes.test.mjs",
        "all": [
          "FULL-UI-02 exposes the complete account HTTP surface"
        ]
      },
      {
        "path": "test/full_ui_02_account_ui.test.mjs",
        "all": [
          "FULL-UI-02 exposes every account function through normal UI controls"
        ]
      }
    ]
  },
  {
    "area": "identity_account",
    "id": "password_reset",
    "source": [
      {
        "path": "public/app/account_ui.js",
        "all": [
          "requestPasswordReset",
          "completePasswordReset"
        ]
      }
    ],
    "prior": [
      {
        "path": "test/full_ui_02_account_routes.test.mjs",
        "all": [
          "FULL-UI-02 exposes the complete account HTTP surface"
        ]
      },
      {
        "path": "test/full_ui_02_account_ui.test.mjs",
        "all": [
          "FULL-UI-02 exposes every account function through normal UI controls"
        ]
      }
    ]
  },
  {
    "area": "identity_account",
    "id": "account_state_message",
    "source": [
      {
        "path": "src/api/product_account_service.ts",
        "any": [
          "account_state",
          "closure_requested",
          "suspended",
          "closed",
          "deleted"
        ]
      }
    ],
    "prior": [
      {
        "path": "test/full_ui_02_account_ui.test.mjs",
        "all": [
          "FULL-UI-02 exposes every account function through normal UI controls"
        ]
      }
    ]
  },
  {
    "area": "identity_account",
    "id": "consent_history",
    "source": [
      {
        "path": "public/app-src/screens/account/useAccountDetail.ts",
        "all": [
          "consent_history"
        ]
      }
    ],
    "prior": [
      {
        "path": "test/full_ui_02_account_ui.test.mjs",
        "all": [
          "FULL-UI-02 exposes every account function through normal UI controls"
        ]
      }
    ]
  },
  {
    "area": "identity_account",
    "id": "profile_update",
    "source": [
      {
        "path": "src/api/product_account_service.ts",
        "any": [
          "updateProductAccountProfile",
          "profile_updated",
          "account_profile_update_failed"
        ]
      },
      {
        "path": "public/app-src/screens/account/ProfileForm.tsx",
        "all": [
          "Profile updated."
        ]
      }
    ],
    "prior": [
      {
        "path": "test/full_ui_08_account_commercial.test.mjs",
        "all": [
          "FULL-UI-08 preserves existing account controls"
        ]
      }
    ]
  },
  {
    "area": "identity_account",
    "id": "password_change",
    "source": [
      {
        "path": "src/api/product_account_service.ts",
        "any": [
          "changeProductAccountPassword",
          "password_changed",
          "account_password_change_failed"
        ]
      },
      {
        "path": "public/app/account_ui.js",
        "any": [
          "changePassword",
          "updatePassword",
          "/account/password"
        ]
      }
    ],
    "prior": [
      {
        "path": "test/full_ui_08_account_commercial.test.mjs",
        "all": [
          "FULL-UI-08 preserves existing account controls"
        ]
      }
    ]
  },
  {
    "area": "identity_account",
    "id": "account_close_request",
    "source": [
      {
        "path": "public/app/account_ui.js",
        "all": [
          "requestAccountClosure"
        ]
      },
      {
        "path": "schema.sql",
        "all": [
          "product_account_closure_requests"
        ]
      }
    ],
    "prior": [
      {
        "path": "test/full_ui_02_account_routes.test.mjs",
        "all": [
          "FULL-UI-02 retains persistent account and session law"
        ]
      },
      {
        "path": "test/full_ui_02_account_ui.test.mjs",
        "all": [
          "FULL-UI-02 exposes every account function through normal UI controls"
        ]
      }
    ]
  },
  {
    "area": "programme_builder",
    "id": "builder_unsaved_warning",
    "source": [
      {
        "path": "public/app/app.js",
        "all": [
          "This programme has unsaved changes.",
          "globalThis.addEventListener(\"beforeunload\""
        ]
      }
    ],
    "prior": [
      {
        "path": "test/full_ui_05b_programme_builder.test.mjs",
        "all": [
          "FULL-UI-05B warns before discarding unsaved changes"
        ]
      }
    ]
  },
  {
    "area": "programme_builder",
    "id": "builder_validation_links",
    "source": [
      {
        "path": "public/app/app.js",
        "all": [
          "template-validation-link"
        ]
      },
      {
        "path": "public/app/styles.css",
        "all": [
          ".template-validation-link:focus-visible"
        ]
      }
    ],
    "prior": [
      {
        "path": "test/full_ui_05b_programme_builder.test.mjs",
        "all": [
          "validation links and keyboard support"
        ]
      }
    ]
  },
  {
    "area": "programme_library",
    "id": "programme_search_filter",
    "source": [
      {
        "path": "public/app-src/screens/coach/useCoachProgrammeLibrary.ts",
        "all": [
          "function programmeSearchText(",
          "function filteredProgrammeTemplates("
        ]
      },
      {
        "path": "public/app-src/screens/coach/CoachProgrammeLibraryPanel.tsx",
        "all": [
          "Search programmes"
        ]
      }
    ],
    "prior": [
      {
        "path": "test/full_ui_05a_programme_library.test.mjs",
        "all": [
          "FULL-UI-05A exposes programme search filter sort and factual state counts"
        ]
      }
    ]
  },
  {
    "area": "programme_library",
    "id": "programme_version_metadata",
    "source": [
      {
        "path": "public/app/app.js",
        "all": [
          "function programmeVersionFamilyHtml("
        ]
      },
      {
        "path": "public/app/index.html",
        "all": [
          "templateDetailVersionFamily",
          "Version metadata"
        ]
      }
    ],
    "prior": [
      {
        "path": "test/full_ui_05a_programme_library.test.mjs",
        "all": [
          "FULL-UI-05A derives factual version families and superseded states"
        ]
      }
    ]
  },
  {
    "area": "programme_library",
    "id": "programme_assignment_usage",
    "source": [
      {
        "path": "public/app/app.js",
        "all": [
          "function programmeAssignmentUsage("
        ]
      },
      {
        "path": "public/app/index.html",
        "all": [
          "Assignment usage"
        ]
      }
    ],
    "prior": [
      {
        "path": "test/full_ui_05a_programme_library.test.mjs",
        "all": [
          "FULL-UI-05A displays assignment usage before archive"
        ]
      }
    ]
  }
];

function read(relativePath) {
  return fs
    .readFileSync(path.join(root, relativePath), "utf8")
    .replace(/\r\n?/gu, "\n");
}

function verifyRule(rule, functionId) {
  const source = read(rule.path);

  for (const needle of rule.all ?? []) {
    assert.ok(
      source.includes(needle),
      functionId + ":" + rule.path + ":" + needle
    );
  }

  if (Array.isArray(rule.any) && rule.any.length > 0) {
    assert.equal(
      rule.any.some((needle) => source.includes(needle)),
      true,
      functionId + ":" + rule.path + ":any"
    );
  }
}

test(
  "FULL-UI-09 reconciles completed FULL-UI-02 to FULL-UI-08 functions",
  () => {
    const byId = new Map(
      manifest.product_areas
        .flatMap((area) =>
          area.functions.map((entry) => ({
            area_id: area.area_id,
            entry
          }))
        )
        .map((item) => [
          item.entry.function_id,
          item
        ])
    );

    assert.equal(targets.length, 33);

    // FULL-UI-25 corrected the persistence classification of these two
    // client-only builder behaviours from a stale "server_authoritative_records"
    // bookkeeping value to "navigation_cache" (they hold no server record of
    // their own - matching the sibling quality_* client-only functions).
    const RECLASSIFIED_NAVIGATION_CACHE = new Set([
      "builder_unsaved_warning",
      "builder_validation_links"
    ]);

    for (const target of targets) {
      const item = byId.get(target.id);

      assert.ok(item, target.id);
      assert.equal(item.area_id, target.area, target.id);
      assert.equal(item.entry.state, "implemented", target.id);

      if (RECLASSIFIED_NAVIGATION_CACHE.has(target.id)) {
        assert.equal(item.entry.persistence, "navigation_cache", target.id);
      }
      else {
        assert.equal(
          item.entry.persistence,
          "server_authoritative_records",
          target.id
        );
      }

      // identity_account owns its own, more specific direct_test
      // (test/full_ui_02_account_ui.test.mjs, enforced by that area's own
      // "FULL-UI-02C identity manifest is implemented and persistently
      // proven" test) - this generic cross-area reconciliation pass defers
      // to it rather than re-stamping a competing pointer. coach_commercial's
      // billing functions (subscription_state/seat_allowance/checkout_entry/
      // payment_return/billing_portal/entitlement_error) migrated to React
      // and now point at CommercialPanel.test.tsx instead - coach_terms/
      // coach_profile_setup/webhook_confirmation in the same area are
      // unaffected and keep pointing at their own dedicated test files.
      if (target.area === "identity_account" || target.area === "coach_commercial") {
        assert.ok(item.entry.direct_test, target.id);
      }
      else {
        assert.equal(
          item.entry.direct_test,
          "test/full_ui_09_manifest_reconciliation.test.mjs",
          target.id
        );
      }

      for (const rule of target.source) {
        verifyRule(rule, target.id);
      }

      for (const rule of target.prior) {
        verifyRule(rule, target.id);
      }
    }
  }
);

test(
  "FULL-UI-09/24/25 resolved the full relationship lifecycle backlog - none of it remains deliberately unresolved",
  () => {
    // Originally pinned "missing" by FULL-UI-09 pending later slices:
    // relationship_invite_create -> resolved by FULL-UI-24 (invite by email).
    // relationship_decline, athlete_relationship_revoke -> resolved by
    // FULL-UI-25 (athlete decline; athlete-initiated end-relationship).
    // relationship_invite_receive, relationship_cancel, relationship_revoke,
    // relationship_expiry -> resolved by FULL-UI-25 as bookkeeping fixes:
    // the coach-side "Revoke relationship"/"Cancel invitation" controls,
    // the expiry-aware relationship listing, and the coach's own
    // relationship_accepted/relationship_declined notifications were already
    // real and working, just never reflected in the manifest.
    const resolved = new Set([
      "relationship_invite_create",
      "relationship_invite_receive",
      "relationship_decline",
      "relationship_cancel",
      "relationship_revoke",
      "relationship_expiry",
      "athlete_relationship_revoke",
      "athlete_archive_inactive"
    ]);

    const byId = new Map(
      manifest.product_areas
        .flatMap((area) => area.functions)
        .map((entry) => [entry.function_id, entry])
    );

    for (const functionId of resolved) {
      const entry = byId.get(functionId);
      assert.ok(entry, functionId);
      assert.equal(entry.state, "implemented", functionId);
      assert.ok(entry.direct_test, functionId);
      assert.notEqual(entry.persistence, "not_implemented", functionId);
    }
  }
);
