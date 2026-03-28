import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const REGISTRY_PATH = 'docs/releases/V1_PACKAGING_SURFACE_REGISTRY.json';
const BOUNDARY_PATH = 'docs/releases/V1_RELEASE_OPERATIONS_BOUNDARY.json';

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

test('P41: packaging registry and release operations boundary exist', () => {
  assert.equal(fs.existsSync(REGISTRY_PATH), true, 'packaging registry must exist');
  assert.equal(fs.existsSync(BOUNDARY_PATH), true, 'release operations boundary must exist');
});

test('P41: release operations boundary surfaces are repo-known packaging surfaces or the packaging registry authority file', () => {
  const registry = readJson(REGISTRY_PATH);
  const boundary = readJson(BOUNDARY_PATH);

  assert.equal(registry.name, 'v1_packaging_surface_registry');
  assert.equal(boundary.name, 'v1_release_operations_boundary');
  assert.ok(Array.isArray(registry.surfaces), 'registry surfaces must be an array');
  assert.ok(Array.isArray(boundary.surfaces), 'boundary surfaces must be an array');

  const registrySet = new Set(registry.surfaces);

  const allowedAuthoritySurfaces = new Set([
    REGISTRY_PATH,
  ]);

  const missingFromRegistry = boundary.surfaces.filter(
    (surface) => !registrySet.has(surface) && !allowedAuthoritySurfaces.has(surface)
  );

  assert.deepEqual(
    missingFromRegistry,
    [],
    `boundary surfaces missing from packaging registry: ${missingFromRegistry.join(', ')}`
  );
});

test('P41: packaging registry authority file is explicitly claimed by the boundary', () => {
  const boundary = readJson(BOUNDARY_PATH);
  assert.equal(
    boundary.surfaces.includes(REGISTRY_PATH),
    true,
    'boundary must explicitly include packaging registry authority file'
  );
});