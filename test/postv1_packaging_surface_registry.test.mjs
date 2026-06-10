import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const REGISTRY_PATH = 'docs/releases/V1_PACKAGING_SURFACE_REGISTRY.json';

test('P37: packaging surface registry exists', () => {
  assert.equal(fs.existsSync(REGISTRY_PATH), true);
});

test('P37: packaging surface registry entries correspond to real repo files only', () => {
  const raw = fs.readFileSync(REGISTRY_PATH, 'utf8');
  const parsed = JSON.parse(raw);

  assert.equal(parsed.name, 'v1_packaging_surface_registry');
  assert.ok(Array.isArray(parsed.surfaces), 'surfaces must be an array');
  assert.ok(parsed.surfaces.length > 0, 'surfaces must not be empty');

  const sorted = [...parsed.surfaces].sort();
  const unique = [...new Set(parsed.surfaces)].sort();

  assert.deepEqual(sorted, unique, 'surface entries must be unique');

  const bannedExactEntries = new Set([
    'artifacts/postv1_packaging_evidence',
    'docs/releases',
    'docs/releases/',
    'ci/scripts',
    'ci/scripts/',
    'deploy',
    'rollout',
    'publish',
  ]);

  const bannedPathSegments = new Set([
    'deploy',
    'rollout',
    'publish',
  ]);

  for (const filePath of parsed.surfaces) {
    assert.equal(typeof filePath, 'string', `surface path must be a string: ${filePath}`);
    assert.ok(filePath.length > 0, 'surface path must not be empty');
    assert.equal(filePath.includes('\\'), false, `surface path must use forward slashes: ${filePath}`);
    assert.equal(filePath.endsWith('/'), false, `surface path must be a file, not a directory: ${filePath}`);
    assert.equal(filePath.startsWith('./'), false, `surface path must be repo-relative without ./ prefix: ${filePath}`);
    assert.equal(filePath.startsWith('/'), false, `surface path must not be absolute: ${filePath}`);
    assert.equal(fs.existsSync(filePath), true, `missing registry surface: ${filePath}`);
    assert.equal(fs.statSync(filePath).isFile(), true, `registry surface must be a file: ${filePath}`);

    assert.equal(
      bannedExactEntries.has(filePath.toLowerCase()),
      false,
      `registry surface must be a concrete file path, not a banned root/action token: ${filePath}`,
    );

    const segments = filePath.toLowerCase().split('/');
    for (const segment of segments) {
      assert.equal(
        bannedPathSegments.has(segment),
        false,
        `registry surface must not include banned action path segment "${segment}": ${filePath}`,
      );
    }
  }
});