When you stage package-lock.json, update this note with 2-6 lines:

- Why did the lockfile change?
- What command caused it? (npm ci / npm install / npm update / etc)
- Was this intentional?
- Any risk areas (deps for tooling vs runtime)

Example:
Intentional: updated devDependencies for typescript tooling.
Command: npm install
Scope: dev-only.