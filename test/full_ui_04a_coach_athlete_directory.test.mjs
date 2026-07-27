
// DEV NOTE: FULL-UI-04A coach athlete directory and relationship lifecycle proof.

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(relativePath) {
  return fs.readFileSync(
    new URL(
      `../${relativePath}`,
      import.meta.url
    ),
    "utf8"
  );
}

const service =
  read(
    "src/api/beta19_coach_workspace_service.ts"
  );

const handlers =
  read(
    "src/api/coach_workspace.handlers.ts"
  );

const routes =
  read(
    "src/api/coach_workspace.routes.ts"
  );

const html =
  read(
    "public/app/index.html"
  );

const application =
  read(
    "public/app/app.js"
  );

const styles =
  read(
    "public/app/styles.css"
  );

test(
  "FULL-UI-04A exposes latest factual relationship rows",
  () => {
    assert.match(
      service,
      /export async function listCoachAthleteRelationships/u
    );

    assert.match(
      service,
      /SELECT DISTINCT ON \(subject_user_id\)/u
    );

    assert.match(
      service,
      /record_type = 'beta17_coach_relationship'/u
    );

    assert.match(
      service,
      /relationship_state:/u
    );

    assert.match(
      service,
      /relationship_expired:/u
    );
  }
);

test(
  "FULL-UI-04A mounts a relationship directory endpoint",
  () => {
    assert.match(
      handlers,
      /export async function getCoachAthleteRelationships/u
    );

    assert.match(
      routes,
      /"\/relationships"/u
    );

    assert.match(
      routes,
      /asyncHandler\(getCoachAthleteRelationships\)/u
    );
  }
);

test(
  "FULL-UI-04A provides search filters counts and audit facts",
  () => {
    for (const id of [
      "refreshAthleteDirectoryButton",
      "athleteDirectorySearch",
      "athleteRelationshipFilter",
      "athleteRelationshipCounts",
      "athleteRoster",
      "athleteRelationshipDetailPanel",
      "athleteRelationshipAuditFacts",
      "athleteRelationshipProfileButton",
      "athleteRelationshipTransitionButton",
      "connectAthleteRelationshipState",
      "connectAthleteExpiry"
    ]) {
      assert.match(
        html,
        new RegExp(
          `id="${id}"`,
          "u"
        )
      );
    }
  }
);

test(
  "FULL-UI-04A records accepted invited and revoked states",
  () => {
    assert.match(
      application,
      /refreshCoachRelationships/u
    );

    assert.match(
      application,
      /relationshipState === "invited"/u
    );

    assert.match(
      application,
      /relationship_state:\s*"revoked"/u
    );

    assert.match(
      application,
      /Historical records will be preserved/u
    );

    assert.match(
      application,
      /window\.confirm/u
    );
  }
);

test(
  "FULL-UI-04A keeps accepted training access separate",
  () => {
    assert.match(
      service,
      /athlete\.relationship_state ===\s*"accepted"/u
    );

    assert.match(
      application,
      /Select an accepted connected athlete/u
    );

    assert.match(
      application,
      /relationshipEffectiveState/u
    );
  }
);

test(
  "FULL-UI-04A remains factual and responsive",
  () => {
    const marker =
      application.indexOf(
        "// FULL-UI-04A factual coach–athlete directory"
      );

    assert.ok(marker >= 0);

    const relevant =
      application.slice(marker);

    assert.doesNotMatch(
      relevant,
      /readiness score|performance prediction|athlete ranking|recommended programme|capability inference/iu
    );

    assert.match(
      styles,
      /FULL-UI-04A coach athlete directory/u
    );

    assert.match(
      styles,
      /@media \(max-width: 620px\)/u
    );
  }
);
