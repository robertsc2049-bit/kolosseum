import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("decision summary consumer surface render contract: enter key submits, stale summary is reset, centralized surface state is updated, and raw payload is rendered", () => {
  const repo = process.cwd();
  const jsSrc = fs.readFileSync(path.join(repo, "public", "decision-summary.js"), "utf8");

  assert.match(
    jsSrc,
    /elRunId\.addEventListener\("keydown",\s*async\s*\(event\)\s*=>\s*\{/,
    "expected run_id input to listen for Enter-key submission"
  );

  assert.match(
    jsSrc,
    /if \(event\.key !== "Enter"\) return;/,
    "expected only Enter to trigger keyboard submission"
  );

  assert.match(
    jsSrc,
    /event\.preventDefault\(\);/,
    "expected Enter-key submission to suppress default form-like behaviour"
  );

  assert.match(
    jsSrc,
    /elBtnLoad\.click\(\);/,
    "expected Enter-key submission to reuse the explicit load action"
  );

  assert.match(
    jsSrc,
    /function setStatePill\(kind,\s*text\) \{/,
    "expected consumer surface to keep a dedicated state-pill helper"
  );

  assert.match(
    jsSrc,
    /function setSurfaceState\(kind,\s*text,\s*runId\) \{/,
    "expected state updates to be centralized through setSurfaceState"
  );

  assert.match(
    jsSrc,
    /setSurfaceState\("loading",\s*"loading",\s*runId\);/,
    "expected loading state to be surfaced through the centralized surface-state helper"
  );

  assert.match(
    jsSrc,
    /setSurfaceState\("success",\s*"success",\s*runId\);/,
    "expected success state to be surfaced through the centralized surface-state helper"
  );

  assert.match(
    jsSrc,
    /setSurfaceState\("bad",\s*"bad_request",\s*runId\);/,
    "expected bad-request state to be surfaced through the centralized surface-state helper"
  );

  assert.match(
    jsSrc,
    /setSurfaceState\("not-found",\s*"not_found",\s*runId\);/,
    "expected not-found state to be surfaced through the centralized surface-state helper"
  );

  assert.match(
    jsSrc,
    /setSurfaceState\("invalid",\s*"invalid_source",\s*runId\);/,
    "expected invalid-source state to be surfaced through the centralized surface-state helper"
  );

  assert.match(
    jsSrc,
    /function resetRenderedSummary\(\) \{/,
    "expected stale summary reset helper"
  );

  assert.match(
    jsSrc,
    /resetRenderedSummary\(\);\s*if \(!runId\)/s,
    "expected summary reset before missing-run validation and request work"
  );

  assert.match(
    jsSrc,
    /elRawPayload\.textContent = safeJson\(payload \?\? \{\}\);/,
    "expected raw payload panel to render the exact returned payload"
  );

  assert.match(
    jsSrc,
    /setSurfaceState\("idle",\s*"idle",\s*readRunId\(\)\);/,
    "expected consumer surface to boot into an explicit idle state"
  );
});
