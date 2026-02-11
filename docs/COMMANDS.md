# Commands

This repo intentionally has **one public human command** and **one CI entrypoint**.

## Public (humans)

Use this when you want one authoritative signal that your change is acceptable:

`ash
npm run verify
`",
  ",
  

CI uses the CI entrypoint. Humans generally should not run this locally unless debugging CI behavior:

`ash
npm run ci
`",
  ",
  

These exist for hooks, guard composition, or advanced debugging. They are **not** part of the public contract:

- green / green:fast / green:dev: internal verification runners used by hooks/CI wiring
- lint:fast, test:unit, build:fast: composed steps used by the verification runner
- guard:* : guard maintenance and deterministic index generation
- diff:* : contract/golden inspection utilities

If you're unsure which to use: run 
pm run verify.
