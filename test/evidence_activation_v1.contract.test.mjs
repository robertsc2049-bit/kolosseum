import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const SOURCE_PATH = "src/api/evidence_activation_v1.ts";

function readSource() {
  return fs.readFileSync(SOURCE_PATH, "utf8");
}

test("evidence activation v1 source contract: exports evidence envelope builder and closed active envelope shape", () => {
  const src = readSource();
  assert.match(src, /export\s+function\s+buildEvidenceEnvelopeV1\s*\(/);
  assert.match(src, /export\s+type\s+EvidenceEnvelopeV1\s*=\s*\{/);
  assert.match(src, /evidence_status:\s*"active"/);
  assert.match(src, /replay_hash:\s*string/);
  assert.match(src, /accepted_at:\s*string/);
  assert.match(src, /scope:\s*string/);
});

test("evidence activation v1 source contract: evidence is gated by lawful replay acceptance only", () => {
  const src = readSource();
  assert.match(src, /input\.accepted !== true/);
  assert.match(src, /replay_acceptance\?: unknown/);
  assert.doesNotMatch(src, /\bpredict/i);
  assert.doesNotMatch(src, /\bforecast/i);
  assert.doesNotMatch(src, /\brecommend/i);
  assert.doesNotMatch(src, /\bscore\b/i);
  assert.doesNotMatch(src, /\binfer/i);
});

test("evidence activation v1 source contract: layer stays activation-only and avoids endpoint concerns", () => {
  const src = readSource();
  assert.doesNotMatch(src, /router\.get|router\.post|app\.get|app\.post|req\b|res\b|status\(\d+\)|json\(/);
});
