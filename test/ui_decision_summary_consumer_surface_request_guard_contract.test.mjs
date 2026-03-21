import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("decision summary consumer surface request guard contract: button loading state, title sync, and stale-response guard stay wired", () => {
  const repo = process.cwd();
  const jsSrc = fs.readFileSync(path.join(repo, "public", "decision-summary.js"), "utf8");
  const cssSrc = fs.readFileSync(path.join(repo, "public", "decision-summary.css"), "utf8");

  assert.match(
    jsSrc,
    /let activeRequestSeq = 0;/,
    "expected a top-level active request sequence guard"
  );

  assert.match(
    jsSrc,
    /const requestSeq = \+\+activeRequestSeq;/,
    "expected each load request to claim a new request sequence"
  );

  assert.match(
    jsSrc,
    /if \(requestSeq !== activeRequestSeq\) \{\s*log\(`stale response ignored: \$\{runId\}`\);\s*return;\s*\}/s,
    "expected stale success or error payloads to be ignored"
  );

  assert.match(
    jsSrc,
    /if \(requestSeq !== activeRequestSeq\) \{\s*log\(`stale failure ignored: \$\{runId\}`\);\s*return;\s*\}/s,
    "expected stale thrown failures to be ignored"
  );

  assert.match(
    jsSrc,
    /function setLoadingUi\(isLoading\) \{/,
    "expected dedicated loading-ui helper"
  );

  assert.match(
    jsSrc,
    /elBtnLoad\.disabled = isLoading;/,
    "expected load button to be disabled while a request is active"
  );

  assert.match(
    jsSrc,
    /elBtnLoad\.textContent = isLoading \? "Loading\.\.\." : "Load";/,
    "expected load button label to expose loading state"
  );

  assert.match(
    jsSrc,
    /setLoadingUi\(\$true\);/,
    "expected active requests to switch button into loading mode"
  );

  assert.match(
    jsSrc,
    /setLoadingUi\(\$false\);/,
    "expected settled active requests to restore the button"
  );

  assert.match(
    jsSrc,
    /function setDocumentTitle\(stateText,\s*runId\) \{/,
    "expected dedicated document-title sync helper"
  );

  assert.match(
    jsSrc,
    /document\.title = `Kolosseum — Decision Summary — \$\{stateText\}\$\{suffix\}`;/,
    "expected title to reflect the current surface state and selected run"
  );

  assert.match(
    jsSrc,
    /function setSurfaceState\(kind,\s*text,\s*runId\) \{/,
    "expected title sync and state-pill sync to be centralized together"
  );

  assert.match(
    jsSrc,
    /setSurfaceState\("loading",\s*"loading",\s*runId\);/,
    "expected loading state to update the centralized surface state"
  );

  assert.match(
    jsSrc,
    /setSurfaceState\("idle",\s*"idle",\s*readRunId\(\)\);/,
    "expected boot state to initialize through the centralized surface-state helper"
  );

  assert.match(
    cssSrc,
    /\.btn:disabled\s*\{/,
    "expected disabled-button styling for active requests"
  );
});
