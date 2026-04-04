import test from "node:test";
import assert from "node:assert/strict";

const mod = await import("../src/ui/copy/declaration_error_copy.ts");
const { DECLARATION_ERROR_COPY } = mod;

const EXPECTED_TOKENS = [
  "consent_not_granted",
  "explicit_null_law_violated",
  "forbidden_primary_goal",
  "invalid_activity_id",
  "invalid_actor_type",
  "invalid_equipment_profile",
  "invalid_format",
  "invalid_location_type",
  "invalid_movement_blacklist",
  "invalid_presentation_flag",
  "invalid_sport_role",
  "missing_governing_authority",
  "missing_record_target",
  "missing_required_field",
  "missing_sport_role",
  "role_generalisation_violation",
  "role_goal_without_role",
  "type_mismatch",
  "unknown_enum_value",
  "unknown_field",
  "version_mismatch",
].sort();

const BANNED_REGEXES = [
  /\bsafer?\b/i,
  /\bsafety\b/i,
  /\bsuitable\b/i,
  /\bappropriate\b/i,
  /\bright for you\b/i,
  /\brecommend(?:ed|ation)?\b/i,
  /\bbest\b/i,
  /\bideal\b/i,
  /\bimprov(?:e|ed|ement)\b/i,
  /\boptim(?:ise|ize|ised|ized|isation|ization)\b/i,
  /\bfix(?:ed|es)?\b/i,
  /\bcorrect(?:ed|ion)?\b/i,
  /\bprotect(?:ion)?\b/i,
  /\bprevent(?:ion)?\b/i,
  /\brecover(?:y)?\b/i,
  /\brehab(?:ilitation)?\b/i,
  /\breadiness\b/i,
  /\bfatigue\b/i,
  /\bperformance\b/i,
  /\badherence\b/i,
  /\byou should\b/i,
  /\btry again with\b/i,
  /\bwe suggest\b/i,
];

function assertNoBannedWording(label, value) {
  for (const rx of BANNED_REGEXES) {
    assert.equal(rx.test(value), false, `banned wording in ${label}: ${value}`);
  }
}

test("legal refusal copy is pinned exactly", () => {
  assert.equal(DECLARATION_ERROR_COPY.legal_refusal, "Execution not permitted.");
});

test("technical failure prefix is pinned and non-advisory", () => {
  assert.equal(DECLARATION_ERROR_COPY.technical_failure_prefix, "Declaration error.");
  assertNoBannedWording("technical_failure_prefix", DECLARATION_ERROR_COPY.technical_failure_prefix);
});

test("technical failure token mapping is pinned exactly", () => {
  const actualTokens = Object.keys(DECLARATION_ERROR_COPY.token_copy).sort();
  assert.deepEqual(actualTokens, EXPECTED_TOKENS);
});

test("all declaration error copy strings are short, technical, and banned-wording free", () => {
  assertNoBannedWording("legal_refusal", DECLARATION_ERROR_COPY.legal_refusal);
  for (const [token, value] of Object.entries(DECLARATION_ERROR_COPY.token_copy)) {
    assert.equal(typeof value, "string");
    assert.ok(value.length > 0);
    assertNoBannedWording(token, value);
  }
});

test("legal refusal and technical failure surfaces remain separate", () => {
  for (const value of Object.values(DECLARATION_ERROR_COPY.token_copy)) {
    assert.notEqual(value, DECLARATION_ERROR_COPY.legal_refusal);
  }
});