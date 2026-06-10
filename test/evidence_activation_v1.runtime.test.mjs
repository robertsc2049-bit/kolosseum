import test from "node:test";
import assert from "node:assert/strict";

test("evidence activation v1 runtime: lawful replay acceptance activates deterministic evidence envelope", async () => {
  const mod = await import(`../dist/src/api/evidence_activation_v1.js?case=evidence_activation_ok`);

  const source = {
    replay_acceptance: {
      accepted: true,
      replay_hash: "sha256:abc123",
      accepted_at: "2026-03-27T10:00:00Z",
      scope: "v1/live-replay"
    }
  };

  const before = JSON.stringify(source);
  const result = mod.buildEvidenceEnvelopeV1(source);
  const after = JSON.stringify(source);

  assert.equal(after, before);
  assert.deepEqual(result, {
    version: "v1",
    replay_hash: "sha256:abc123",
    accepted_at: "2026-03-27T10:00:00Z",
    scope: "v1/live-replay",
    evidence_status: "active"
  });
});

test("evidence activation v1 runtime: absent replay acceptance yields no evidence envelope", async () => {
  const mod = await import(`../dist/src/api/evidence_activation_v1.js?case=evidence_activation_absent`);

  assert.equal(mod.buildEvidenceEnvelopeV1({}), null);
  assert.equal(mod.buildEvidenceEnvelopeV1({ replay_acceptance: null }), null);
});

test("evidence activation v1 runtime: invalid or unaccepted replay acceptance fails closed", async () => {
  const mod = await import(`../dist/src/api/evidence_activation_v1.js?case=evidence_activation_fail_closed`);

  assert.equal(
    mod.buildEvidenceEnvelopeV1({
      replay_acceptance: {
        accepted: false,
        replay_hash: "sha256:abc123",
        accepted_at: "2026-03-27T10:00:00Z",
        scope: "v1/live-replay"
      }
    }),
    null
  );

  assert.equal(
    mod.buildEvidenceEnvelopeV1({
      replay_acceptance: {
        accepted: true,
        replay_hash: "",
        accepted_at: "2026-03-27T10:00:00Z",
        scope: "v1/live-replay"
      }
    }),
    null
  );

  assert.equal(
    mod.buildEvidenceEnvelopeV1({
      replay_acceptance: {
        accepted: true,
        replay_hash: "sha256:abc123",
        accepted_at: "",
        scope: "v1/live-replay"
      }
    }),
    null
  );
});
