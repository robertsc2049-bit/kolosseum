// DEV NOTE: BETA-FIX-02 HTTP smoke harness proof.

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(relativePath) {
  return fs.readFileSync(relativePath, "utf8");
}

const schemaPath =
  "ci/schemas/phase1.input.schema.v1.0.0.json";

test(
  "smoke scripts bind the exact Phase 1 schema",
  () => {
    for (
      const relativePath of [
        "scripts/smoke-blocks.ps1",
        "scripts/smoke-api.ps1"
      ]
    ) {
      const source = read(relativePath);

      assert.equal(
        source.includes(
          `[string]$SchemaPath = "${schemaPath}"`
        ),
        true,
        relativePath
      );

      assert.equal(
        source.includes(
          "Resolve-Phase1SchemaFile $SchemaPath"
        ),
        true,
        relativePath
      );

      assert.equal(
        source.includes("Find-Phase1SchemaFile"),
        false,
        relativePath
      );

      assert.equal(
        source.includes("Get-ChildItem"),
        false,
        relativePath
      );
    }
  }
);

test(
  "smoke runners preserve child failure status",
  () => {
    const cases = [
      {
        path:
          "scripts/smoke-blocks-run.ps1",
        command:
          "npm.cmd run smoke:blocks -- -- -SchemaPath $SchemaPath",
        token:
          "CI_BETA_FIX_02_SMOKE_BLOCKS_CHILD_FAILED"
      },
      {
        path:
          "scripts/smoke-api-run.ps1",
        command:
          "npm.cmd run smoke:api -- -- -SchemaPath $SchemaPath",
        token:
          "CI_BETA_FIX_02_SMOKE_API_CHILD_FAILED"
      }
    ];

    for (const item of cases) {
      const source = read(item.path);

      assert.equal(
        source.includes(item.command),
        true,
        item.path
      );

      assert.equal(
        source.includes(
          "$SmokeExitCode = $LASTEXITCODE"
        ),
        true,
        item.path
      );

      assert.equal(
        source.includes(
          "if ($SmokeExitCode -ne 0)"
        ),
        true,
        item.path
      );

      assert.equal(
        source.includes(item.token),
        true,
        item.path
      );
    }
  }
);

test(
  "database smoke preserves caller configuration",
  () => {
    const source = read(
      "scripts/smoke-blocks-run.ps1"
    );

    assert.equal(
      source.includes(
        "Respect a caller-supplied DATABASE_URL"
      ),
      true
    );

    assert.equal(
      source.includes(
        "if (Is-Blank $env:DATABASE_URL)"
      ),
      true
    );
  }
);

test(
  "generated smoke logs are ignored",
  () => {
    const lines =
      read(".gitignore")
        .split(/\r?\n/);

    assert.equal(
      lines.includes(".logs/"),
      true
    );
  }
);
