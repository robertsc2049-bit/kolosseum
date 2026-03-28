import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const BOUNDARY_PATH = 'docs/releases/V1_RELEASE_OPERATIONS_BOUNDARY.json';
const ORDER_DOC_PATH = 'docs/releases/V1_OPERATOR_EXECUTION_ORDER.md';

const EXPECTED_EXECUTION_SEQUENCE = [
  'ci/scripts/build_postv1_packaging_evidence.mjs',
  'ci/scripts/run_postv1_packaging_evidence_manifest_verifier.mjs',
  'ci/scripts/run_postv1_final_acceptance_gate.mjs',
  'ci/scripts/run_release_claim_validator.mjs',
  'ci/scripts/run_postv1_merge_readiness_verifier.mjs',
  'ci/scripts/run_postv1_mainline_post_merge_verification.mjs',
];

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

test('P42: release operations boundary and execution order doc exist', () => {
  assert.equal(fs.existsSync(BOUNDARY_PATH), true, 'release operations boundary must exist');
  assert.equal(fs.existsSync(ORDER_DOC_PATH), true, 'operator execution order doc must exist');
});

test('P42: boundary claims the exact execution surfaces declared by operator order and nothing outside them', () => {
  const boundary = readJson(BOUNDARY_PATH);

  assert.equal(boundary.name, 'v1_release_operations_boundary');
  assert.ok(Array.isArray(boundary.surfaces), 'boundary surfaces must be an array');

  const boundaryExecutionSurfaces = boundary.surfaces.filter((surface) =>
    surface.startsWith('ci/scripts/') &&
    (
      surface === 'ci/scripts/build_postv1_packaging_evidence.mjs' ||
      surface.startsWith('ci/scripts/run_postv1_') ||
      surface === 'ci/scripts/run_release_claim_validator.mjs'
    )
  );

  const actualSorted = [...boundaryExecutionSurfaces].sort();
  const expectedSorted = [...EXPECTED_EXECUTION_SEQUENCE].sort();

  assert.deepEqual(
    actualSorted,
    expectedSorted,
    'boundary execution surfaces must exactly match declared execution surfaces'
  );
});

test('P42: operator execution order doc remains linear for the declared execution sequence', () => {
  const orderDoc = fs.readFileSync(ORDER_DOC_PATH, 'utf8');

  for (let i = 0; i < EXPECTED_EXECUTION_SEQUENCE.length; i += 1) {
    const step = EXPECTED_EXECUTION_SEQUENCE[i];
    const idx = orderDoc.indexOf(step);
    assert.notEqual(idx, -1, `missing execution step in order doc: ${step}`);

    if (i > 0) {
      const prev = orderDoc.indexOf(EXPECTED_EXECUTION_SEQUENCE[i - 1]);
      assert.ok(idx > prev, `execution order doc is out of order at: ${step}`);
    }
  }
});