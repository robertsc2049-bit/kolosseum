import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  REQUIRED_MARKERS,
  REQUIRED_SECTION_HEADER,
  verifyPromotionPrTemplateFreezeSection,
} from "../ci/scripts/run_promotion_pr_template_freeze_section_verifier.mjs";

function writeText(dir, name, value) {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, String(value).replace(/\r\n/g, "\n") + "\n", "utf8");
  return filePath;
}

function runCase(t, templateText) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p107-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const templatePath = writeText(dir, "promotion.md", templateText);
  return verifyPromotionPrTemplateFreezeSection(templatePath);
}

test("passes when freeze confirmation section and all required markers exist", (t) => {
  const templateText = [
    "# Promotion PR",
    "",
    "## Summary",
    "- Promotion slice:",
    "",
    REQUIRED_SECTION_HEADER,
    ...REQUIRED_MARKERS,
    "",
    "## Notes",
    "- Follow-up:",
  ].join("\n");

  const result = runCase(t, templateText);

  assert.equal(result.ok, true);
  assert.equal(result.required_section_header, REQUIRED_SECTION_HEADER);
  assert.deepEqual(result.required_markers, REQUIRED_MARKERS);
});

test("fails when freeze confirmation section header is missing", (t) => {
  const templateText = [
    "# Promotion PR",
    "",
    "## Summary",
    "- Promotion slice:",
    "",
    "## Notes",
    "- Follow-up:",
  ].join("\n");

  const result = runCase(t, templateText);

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "CI_PROMOTION_PR_TEMPLATE_FREEZE_SECTION_MISSING");
  assert.match(result.failures[0].details, /section header/i);
});

test("fails when one required freeze marker is missing", (t) => {
  const markers = REQUIRED_MARKERS.filter((marker) => marker !== "- [ ] sealed_surface_manifest_confirmed");
  const templateText = [
    "# Promotion PR",
    "",
    REQUIRED_SECTION_HEADER,
    ...markers,
    "",
    "## Notes",
    "- Follow-up:",
  ].join("\n");

  const result = runCase(t, templateText);

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "CI_PROMOTION_PR_TEMPLATE_FREEZE_SECTION_MISSING");
  assert.match(result.failures[0].details, /sealed_surface_manifest_confirmed/i);
});

test("fails when marker text drifts from pinned literal", (t) => {
  const templateText = [
    "# Promotion PR",
    "",
    REQUIRED_SECTION_HEADER,
    "- [ ] freeze_state_confirmed",
    "- [ ] active_seal_state_confirmed",
    "- [ ] sealed_surfaces_manifest_confirmed",
    "- [ ] release_notes_boundary_confirmed",
    "",
    "## Notes",
    "- Follow-up:",
  ].join("\n");

  const result = runCase(t, templateText);

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "CI_PROMOTION_PR_TEMPLATE_FREEZE_SECTION_MISSING");
  assert.match(result.failures[0].details, /sealed_surface_manifest_confirmed/i);
});

test("repo promotion PR template passes verifier", () => {
  const templatePath = path.resolve(".github/PULL_REQUEST_TEMPLATE/promotion.md");
  const result = verifyPromotionPrTemplateFreezeSection(templatePath);

  assert.equal(result.ok, true);
});