import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const path = 'docs/releases/V1_ENV_TEMPLATE.example';

test('P6: env template exists with placeholder-only values', () => {
  assert.equal(fs.existsSync(path), true);
  const text = fs.readFileSync(path, 'utf8');

  assert.match(text, /^# Kolosseum v1 operator environment template$/m);
  assert.match(text, /DATABASE_URL=<set_me>/);
  assert.match(text, /RELEASE_COMMIT_SHA=<set_me>/);
  assert.match(text, /RELEASE_TAG=<set_me_or_leave_blank>/);
  assert.match(text, /RELEASE_OPERATOR=<set_me>/);
});

test('P6: env template avoids embedded secrets and concrete runtime values', () => {
  const text = fs.readFileSync(path, 'utf8');

  assert.doesNotMatch(text, /postgres:\/\//i);
  assert.doesNotMatch(text, /password=/i);
  assert.doesNotMatch(text, /api[_-]?key/i);
  assert.doesNotMatch(text, /^NODE_ENV=production$/m);
  assert.doesNotMatch(text, /^KOLOSSEUM_STRICT_HTTP_E2E=/m);
});

test('P6: env template is explicitly non-deployment in scope', () => {
  const text = fs.readFileSync(path, 'utf8');

  assert.match(text, /Placeholder values only\./);
  assert.match(text, /not a deployment manifest\./i);
});