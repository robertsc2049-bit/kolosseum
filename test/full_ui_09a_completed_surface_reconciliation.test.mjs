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
    "id": "assignment_confirmation",
    "evidence": [
      [
        "public/app/app.js",
        [
          "assignmentTemplateVersion(current)"
        ]
      ],
      [
        "test/full_ui_06_assignment_management.test.mjs",
        [
          "FULL-UI-06 confirms exact version and separates optional event state"
        ]
      ]
    ]
  },
  {
    "area": "assignments",
    "id": "assignment_current_detail",
    "evidence": [
      [
        "public/app/index.html",
        [
          "id=\"athleteAssignmentCurrent\"",
          "id=\"assignmentCurrentState\""
        ]
      ],
      [
        "test/full_ui_06_assignment_management.test.mjs",
        [
          "FULL-UI-06 exposes current assignment and immutable history controls"
        ]
      ]
    ]
  },
  {
    "area": "assignments",
    "id": "assignment_preserve_sessions",
    "evidence": [
      [
        "public/app/app.js",
        [
          "preserved_session_count"
        ]
      ],
      [
        "test/full_ui_06_assignment_management.test.mjs",
        [
          "FULL-UI-06 preserves existing sessions and only blocks future creation"
        ]
      ]
    ]
  },
  {
    "area": "assignments",
    "id": "assignment_separate_event",
    "evidence": [
      [
        "public/app/index.html",
        [
          "Event links are shown separately."
        ]
      ],
      [
        "test/full_ui_06_assignment_management.test.mjs",
        [
          "FULL-UI-06 confirms exact version and separates optional event state"
        ]
      ]
    ]
  },
  {
    "area": "athlete_directory",
    "id": "athlete_current_event",
    "evidence": [
      [
        "public/app/index.html",
        [
          "id=\"athleteDetailCurrentEvent\""
        ]
      ],
      [
        "src/api/beta19_coach_workspace_service.ts",
        [
          "current_event_link"
        ]
      ],
      [
        "test/full_ui_04b_coach_athlete_detail.test.mjs",
        [
          "\"current_event_link\""
        ]
      ]
    ]
  },
  {
    "area": "athlete_directory",
    "id": "athlete_current_programme",
    "evidence": [
      [
        "public/app/index.html",
        [
          "id=\"athleteDetailCurrentProgramme\""
        ]
      ],
      [
        "src/api/beta19_coach_workspace_service.ts",
        [
          "current_assignment"
        ]
      ],
      [
        "test/full_ui_04b_coach_athlete_detail.test.mjs",
        [
          "\"current_assignment\""
        ]
      ]
    ]
  },
  {
    "area": "athlete_directory",
    "id": "athlete_event_history",
    "evidence": [
      [
        "public/app/index.html",
        [
          "id=\"athleteDetailEventHistory\""
        ]
      ],
      [
        "src/api/beta19_coach_workspace_service.ts",
        [
          "event_link_history"
        ]
      ],
      [
        "test/full_ui_04b_coach_athlete_detail.test.mjs",
        [
          "\"event_link_history\""
        ]
      ]
    ]
  },
  {
    "area": "athlete_directory",
    "id": "athlete_session_history",
    "evidence": [
      [
        "src/api/beta19_coach_workspace_service.ts",
        [
          "session_history"
        ]
      ],
      [
        "public/app/index.html",
        [
          "id=\"athleteDetailSessionHistory\""
        ]
      ],
      [
        "test/full_ui_04b_coach_athlete_detail.test.mjs",
        [
          "\"session_history\""
        ]
      ]
    ]
  },
  {
    "area": "athlete_directory",
    "id": "athlete_strength_history",
    "evidence": [
      [
        "src/api/beta19_coach_workspace_service.ts",
        [
          "strength_profile_history"
        ]
      ],
      [
        "public/app/index.html",
        [
          "id=\"athleteDetailStrengthHistory\""
        ]
      ],
      [
        "test/full_ui_04b_coach_athlete_detail.test.mjs",
        [
          "\"strength_profile_history\""
        ]
      ]
    ]
  },
  {
    "area": "coach_overview",
    "id": "overview_direct_links",
    "evidence": [
      [
        "public/app/route_bootstrap.js",
        [
          "route_id: \"coach_athlete_detail\"",
          "route_id: \"coach_programme_detail\"",
          "route_id: \"coach_review\""
        ]
      ],
      [
        "test/full_ui_03_coach_dashboard.test.mjs",
        [
          "\"overview_direct_links\""
        ]
      ]
    ]
  },
  {
    "area": "coach_overview",
    "id": "overview_relationships",
    "evidence": [
      [
        "public/app/index.html",
        [
          "Connected athletes"
        ]
      ],
      [
        "test/full_ui_03_coach_dashboard.test.mjs",
        [
          "\"overview_relationships\""
        ]
      ]
    ]
  },
  {
    "area": "coach_overview",
    "id": "overview_upcoming_events",
    "evidence": [
      [
        "public/app/index.html",
        [
          "id=\"coachUpcomingEventCount\"",
          "Upcoming events"
        ]
      ],
      [
        "test/full_ui_03_coach_dashboard.test.mjs",
        [
          "\"overview_upcoming_events\""
        ]
      ]
    ]
  },
  {
    "area": "coach_review",
    "id": "review_athlete_search",
    "evidence": [
      [
        "public/app/index.html",
        [
          "id=\"reviewSearch\"",
          "placeholder=\"Athlete, session or programme\""
        ]
      ],
      [
        "public/app/app.js",
        [
          "function filteredCoachReviewRecords()",
          "elements.reviewSearch.addEventListener(\"input\""
        ]
      ],
      [
        "test/full_ui_07_review_queue.test.mjs",
        [
          "FULL-UI-07 exposes searchable review queue controls and factual detail",
          "\"reviewSearch\""
        ]
      ]
    ]
  },
  {
    "area": "coach_review",
    "id": "review_completed_queue",
    "evidence": [
      [
        "public/app/index.html",
        [
          "id=\"coachOverviewReviewQueue\"",
          "Awaiting review"
        ]
      ],
      [
        "test/full_ui_07_review_queue.test.mjs",
        [
          "FULL-UI-07 exposes searchable review queue controls and factual detail"
        ]
      ]
    ]
  },
  {
    "area": "coach_review",
    "id": "review_factual_detail",
    "evidence": [
      [
        "public/app/app.js",
        [
          "function renderCoachReviewDetail(record)"
        ]
      ],
      [
        "public/app/index.html",
        [
          "id=\"reviewDetailContent\""
        ]
      ],
      [
        "test/full_ui_07_review_queue.test.mjs",
        [
          "FULL-UI-07 exposes searchable review queue controls and factual detail"
        ]
      ]
    ]
  },
  {
    "area": "coach_review",
    "id": "review_live_status",
    "evidence": [
      [
        "public/app/index.html",
        [
          "id=\"reviewStatusFilter\"",
          "id=\"reviewStatus\"",
          "live read-only status"
        ]
      ],
      [
        "test/full_ui_07_review_queue.test.mjs",
        [
          "\"live_status_read_only\""
        ]
      ]
    ]
  },
  {
    "area": "coach_review",
    "id": "review_note_visibility",
    "evidence": [
      [
        "public/app/index.html",
        [
          "id=\"coachNoteVisibility\""
        ]
      ],
      [
        "test/full_ui_07_review_queue.test.mjs",
        [
          "FULL-UI-07 displays provenance live status and note visibility"
        ]
      ]
    ]
  },
  {
    "area": "coach_review",
    "id": "review_provenance",
    "evidence": [
      [
        "public/app/app.js",
        [
          "assignment_provenance",
          "event_provenance"
        ]
      ],
      [
        "src/api/product_review.routes.ts",
        [
          "assignment_provenance:",
          "event_provenance:"
        ]
      ],
      [
        "test/full_ui_07_review_queue.test.mjs",
        [
          "\"assignment_provenance\"",
          "\"event_provenance\""
        ]
      ]
    ]
  },
  {
    "area": "identity_account",
    "id": "account_create",
    "evidence": [
      [
        "public/app/account_ui.js",
        [
          "\"/account/register\""
        ]
      ],
      [
        "public/app/app.js",
        [
          "\"Account created.\""
        ]
      ],
      [
        "test/product_app_surface.test.mjs",
        [
          "\"/account/register\""
        ]
      ]
    ]
  },
  {
    "area": "identity_account",
    "id": "sign_out",
    "evidence": [
      [
        "public/app/account_ui.js",
        [
          "signOutAccount",
          "\"/account/sign-out\""
        ]
      ],
      [
        "public/app/index.html",
        [
          "id=\"signOutButton\""
        ]
      ],
      [
        "test/full_ui_02_account_routes.test.mjs",
        [
          "\"/sign-out\"",
          "\"signOutProductAccount\""
        ]
      ],
      [
        "test/full_ui_02_account_ui.test.mjs",
        [
          "\"signOutButton\"",
          "\"signOutAccount\""
        ]
      ]
    ]
  },
  {
    "area": "programme_builder",
    "id": "builder_keyboard_mobile",
    "evidence": [
      [
        "public/app/app.js",
        [
          "FULL-UI-05B: programme builder state, recovery, validation links and keyboard support."
        ]
      ],
      [
        "test/full_ui_05b_programme_builder.test.mjs",
        [
          "FULL-UI-05B supports keyboard and phone operation"
        ]
      ]
    ]
  },
  {
    "area": "programme_builder",
    "id": "builder_save_feedback",
    "evidence": [
      [
        "public/app/index.html",
        [
          "id=\"templateBuilderSaveState\""
        ]
      ],
      [
        "test/full_ui_05b_programme_builder.test.mjs",
        [
          "FULL-UI-05B gives durable save feedback and duplicate-submit protection"
        ]
      ]
    ]
  },
  {
    "area": "programme_library",
    "id": "programme_activation_validation",
    "evidence": [
      [
        "public/app/index.html",
        [
          "Validation summary",
          "Completion validation"
        ]
      ],
      [
        "test/full_ui_05a_programme_library.test.mjs",
        [
          "FULL-UI-05A provides a full visible activation validation summary"
        ]
      ]
    ]
  },
  {
    "area": "programme_library",
    "id": "programme_detail",
    "evidence": [
      [
        "public/app/app.js",
        [
          "function renderProgrammeDetail("
        ]
      ],
      [
        "public/app/index.html",
        [
          "Programme detail"
        ]
      ],
      [
        "test/full_ui_05a_programme_library.test.mjs",
        [
          "FULL-UI-05A opens a complete programme detail and preview surface"
        ]
      ]
    ]
  },
  {
    "area": "programme_library",
    "id": "programme_preview",
    "evidence": [
      [
        "public/app/app.js",
        [
          "function programmePreviewHtml("
        ]
      ],
      [
        "public/app/index.html",
        [
          "Programme preview"
        ]
      ],
      [
        "test/full_ui_05a_programme_library.test.mjs",
        [
          "FULL-UI-05A opens a complete programme detail and preview surface"
        ]
      ]
    ]
  },
  {
    "area": "programme_library",
    "id": "programme_states",
    "evidence": [
      [
        "public/app/index.html",
        [
          "Draft programmes",
          "Complete programmes",
          "Active programmes",
          "Archived programmes",
          "Superseded versions"
        ]
      ],
      [
        "test/full_ui_05a_programme_library.test.mjs",
        [
          "FULL-UI-05A exposes programme search filter sort and factual state counts",
          "FULL-UI-05A derives factual version families and superseded states"
        ]
      ]
    ]
  }
];

function read(relativePath) {
  return fs
    .readFileSync(path.join(root, relativePath), "utf8")
    .replace(/\r\n?/gu, "\n");
}

test(
  "FULL-UI-09A reconciles 26 completed product surfaces",
  () => {
    const functionMap = new Map(
      manifest.product_areas
        .flatMap((area) =>
          area.functions.map((entry) => ({
            area_id: area.area_id,
            entry
          }))
        )
        .map((item) => [item.entry.function_id, item])
    );

    assert.equal(targets.length, 26);

    for (const target of targets) {
      const item = functionMap.get(target.id);

      assert.ok(item, target.id);
      assert.equal(item.area_id, target.area, target.id);
      assert.equal(item.entry.state, "implemented", target.id);
      assert.notEqual(
        item.entry.persistence,
        "not_implemented",
        target.id
      );

      // identity_account owns its own, more specific direct_test
      // (test/full_ui_02_account_ui.test.mjs) - this generic cross-area
      // reconciliation pass defers to it rather than re-stamping a
      // competing pointer.
      if (target.area === "identity_account") {
        assert.ok(item.entry.direct_test, target.id);
      }
      else {
        assert.equal(
          item.entry.direct_test,
          "test/full_ui_09a_completed_surface_reconciliation.test.mjs",
          target.id
        );
      }

      for (const [relativePath, needles] of target.evidence) {
        const source = read(relativePath);

        for (const needle of needles) {
          assert.equal(
            source.includes(needle),
            true,
            target.id + ":" + relativePath + ":" + needle
          );
        }
      }
    }
  }
);

test(
  "FULL-UI-25 confirms terms-version display is fully implemented, not left partial",
  () => {
    // FULL-UI-09A originally left this deliberately partial. It has since
    // been genuinely completed (GET /account/terms + /account/detail, real
    // direct and integration test coverage, exercised throughout
    // FULL-UI-23/24/25) - the manifest caught up to reality first, so this
    // lock is updated to match rather than the reverse.
    const functionMap = new Map(
      manifest.product_areas
        .flatMap((area) => area.functions)
        .map((entry) => [entry.function_id, entry])
    );

    const entry = functionMap.get("terms_version");

    assert.ok(entry);
    assert.equal(entry.state, "implemented");
    assert.ok(entry.direct_test);
    assert.ok(entry.integration_test);
    assert.notEqual(entry.persistence, "not_implemented");
  }
);
