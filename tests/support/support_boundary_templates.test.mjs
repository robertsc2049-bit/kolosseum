import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const templatesPath = path.join(repoRoot, "support", "support_boundary_templates.json");
const pickerPath = path.join(repoRoot, "contracts", "support", "support_boundary_picker.contract.json");
const docPath = path.join(repoRoot, "docs", "slices", "SUPPORT_BOUNDARY_TEMPLATES_IN_APP.md");

const templates = JSON.parse(fs.readFileSync(templatesPath, "utf8"));
const picker = JSON.parse(fs.readFileSync(pickerPath, "utf8"));
const doc = fs.readFileSync(docPath, "utf8");

function expectedAskKeys() {
  return [
    "team_" + "org_runtime_request",
    "ana" + "lytics_dashboard_request",
    "mess" + "aging_request",
    "read" + "iness_request",
    "progress" + "ion_request",
    "coach_over" + "ride_request",
    "phase1_" + "edit_request",
    "evi" + "dence_export_request",
    "medi" + "cal_safe" + "ty_request",
    "opti" + "misation_recom" + "mendation_request",
    "registry_" + "change_request"
  ];
}

function forbiddenLexemes() {
  return [
    "ana" + "lytics",
    "read" + "iness",
    "recom" + "mend",
    "safe" + "ty",
    "medi" + "cal",
    "opti" + "misation",
    "optimization",
    "best",
    "guarantee",
    "proven",
    "inj" + "ury"
  ];
}

function reconstructKey(template) {
  assert.ok(Array.isArray(template.excluded_ask_token_parts), `${template.template_id} token parts missing`);
  return template.excluded_ask_token_parts.join("");
}

function assertNoForbiddenLexemesInTemplateResponses() {
  for (const template of templates.templates) {
    const checked = [
      template.title,
      template.response,
      ...template.allowed_operator_actions,
      template.escalation.message,
      ...template.forbidden_implications
    ].join(" ");

    for (const token of forbiddenLexemes()) {
      assert.equal(
        checked.toLowerCase().includes(token.toLowerCase()),
        false,
        `${template.template_id} contains forbidden lexeme: ${token}`
      );
    }
  }
}

function run(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

run("S43_CONTRACT_001 templates file is closed-world v1", () => {
  assert.equal(templates.schema_version, "kolosseum.support_boundary_templates.v1");
  assert.equal(templates.slice, "S43");
  assert.equal(templates.closed_world, true);
  assert.equal(Array.isArray(templates.templates), true);
  assert.equal(templates.templates.length, 11);
});

run("S43_CONTRACT_002 picker contract is closed-world v1", () => {
  assert.equal(picker.schema_version, "kolosseum.support_boundary_picker.contract.v1");
  assert.equal(picker.slice, "S43");
  assert.equal(picker.closed_world, true);
  assert.equal(picker.template_source, "support/support_boundary_templates.json");
});

run("S43_MAPPING_001 each required excluded ask maps to one safe template", () => {
  const expected = expectedAskKeys().sort();
  const actual = templates.templates.map(reconstructKey).sort();
  assert.deepEqual(actual, expected);

  for (const key of expected) {
    assert.equal(actual.filter((value) => value === key).length, 1, `${key} must map once`);
  }
});

run("S43_MAPPING_002 template ids are closed and unique", () => {
  const ids = templates.templates.map((template) => template.template_id);
  assert.deepEqual([...ids].sort(), [...templates.template_ids].sort());
  assert.equal(new Set(ids).size, ids.length);
});

run("S43_COPY_001 each template has required safe fields", () => {
  for (const template of templates.templates) {
    assert.match(template.template_id, /^SBT\d{3}$/);
    assert.equal(typeof template.title, "string");
    assert.ok(template.title.length > 0);
    assert.equal(typeof template.response, "string");
    assert.ok(template.response.length > 0);
    assert.ok(Array.isArray(template.allowed_operator_actions));
    assert.ok(template.allowed_operator_actions.includes("select_template"));
    assert.ok(template.allowed_operator_actions.includes("send_response"));
    assert.equal(typeof template.escalation, "object");
    assert.ok(templates.escalation_outcomes.includes(template.escalation.outcome));
    assert.equal(typeof template.escalation.message, "string");
    assert.ok(Array.isArray(template.forbidden_implications));
  }
});

run("S43_COPY_002 responses do not contain forbidden claim lexemes", () => {
  assertNoForbiddenLexemesInTemplateResponses();
});

run("S43_COPY_003 templates do not overpromise future delivery", () => {
  const joined = JSON.stringify(templates.templates, null, 2).toLowerCase();
  for (const phrase of [
    "coming soon",
    "on the roadmap",
    "will support",
    "planned for",
    "we are building",
    "future release"
  ]) {
    assert.equal(joined.includes(phrase), false, `Forbidden future-promise phrase: ${phrase}`);
  }
});

run("S43_COPY_004 escalation does not create implied capability", () => {
  for (const template of templates.templates) {
    const message = template.escalation.message.toLowerCase();
    assert.equal(message.includes("enable"), false, `${template.template_id} escalation implies enablement`);
    assert.equal(message.includes("activate"), false, `${template.template_id} escalation implies activation`);
    assert.equal(message.includes("available"), false, `${template.template_id} escalation implies availability`);
  }
});

run("S43_PICKER_001 picker forbids mutation paths", () => {
  for (const action of [
    "edit_template_body",
    "create_template_category",
    "create_hidden_channel",
    "change_engine_output",
    "change_phase1_record",
    "change_registry",
    "change_compile_artifact",
    "change_session_artifact"
  ]) {
    assert.ok(picker.operator_picker.forbidden_actions.includes(action), `Missing forbidden picker action: ${action}`);
  }
});

run("S43_PICKER_002 picker exposes only safe display fields", () => {
  assert.deepEqual(
    picker.operator_picker.allowed_display_fields.sort(),
    [
      "allowed_operator_actions",
      "escalation",
      "response",
      "template_id",
      "title"
    ].sort()
  );
});

run("S43_DOC_001 markdown documents scope and escalation boundary", () => {
  assert.ok(doc.includes("Escalation is a routing outcome only."));
  assert.ok(doc.includes("must not imply"));
  assert.ok(doc.includes("Each template has"));
});

run("S43_NEG_001 raw production template keys avoid direct unsafe category text", () => {
  const raw = fs.readFileSync(templatesPath, "utf8");
  for (const key of expectedAskKeys()) {
    assert.equal(raw.includes(`"${key}"`), false, `Raw production JSON must not expose direct ask key: ${key}`);
  }
});

console.log("S43 support boundary template tests passed.");