When you stage package-lock.json, update this note with 2-6 lines:

- Why did the lockfile change?
- What command caused it? (npm ci / npm install / npm update / etc)
- Was this intentional?
- Any risk areas (deps for tooling vs runtime)

Example:
Intentional: updated devDependencies for typescript tooling.
Command: npm install
Scope: dev-only.2026-02-05: Added dev dependency 'ajv-formats' so phase4_schema_enforcement.test.mjs can load schema formats; resolves ERR_MODULE_NOT_FOUND in CI/pre-push.
2026-02-05: Proof: lockfile note enforcement (added is-number/is-odd dev deps)
