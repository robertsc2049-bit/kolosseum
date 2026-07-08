# Evidence Envelope + Seal (Phase 7/8)

This repo contains a deterministic evidence envelope and a derived seal to anchor integrity of:
- schema set (ci/schemas/*.json)
- registry bundle (registries/registry_bundle.json)
- engine version + node runtime version (package.json version + process.versions.node)

## Files

- ci/evidence/evidence_envelope.v1.json
- ci/evidence/evidence_seal.v1.json
- ci/scripts/evidence_seal.mjs (authoritative generator/checker)
- ci/guards/evidence_seal_guard.mjs (CI/green enforcement)

## Canonicalization

The envelope JSON is serialized using a deterministic stable stringify:
- deep key sort (object keys sorted recursively)
- arrays preserved as-is
- pretty printed (2 spaces)
- LF line endings with trailing newline

Envelope SHA256 is computed over UTF-8 bytes of that canonical JSON string.

## Seal

The seal is a deterministic commitment to the envelope hash:

seal_material = "kolosseum:evidence_seal@1\n" + envelope_sha256 + "\n"
seal_sha256   = SHA256(seal_material)

The optional "signature" field is schema-allowed but not required yet.

## Updating (when schemas/registry/engine change)

Run:

node ci/scripts/evidence_seal.mjs --write
git add ci/evidence/evidence_envelope.v1.json ci/evidence/evidence_seal.v1.json
npm run green

If CI fails with evidence_seal_guard, the committed evidence files are out of date or not canonical.

## V0 regeneration rule

The committed v0 evidence envelope and seal are generated artefacts. Do not edit `ci/evidence/evidence_envelope.v1.json` or `ci/evidence/evidence_seal.v1.json` by hand.

If either file is missing or `ci/guards/evidence_seal_guard.mjs` reports drift, regenerate both files with:

    node ci/scripts/evidence_seal.mjs --write

Then run:

    node ci/guards/evidence_seal_guard.mjs

Only commit the regenerated evidence files when the guard proves they match the canonical recompute. This regeneration rule does not activate user-facing proof export, Phase 8 evidence sealing, or any v1 evidence product surface inside v0.
