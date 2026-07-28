# BETA-E2E-01 Persistent HTTP Product Journey

## Result

**PASS ? implementation gate complete.**

This record does not declare the live controlled beta ready. The live-beta decision remains `NO_GO_PENDING_LATER_ACCEPTANCE_GATES`.

## Proven Journey

- Athlete authentication product record persisted through HTTP.
- Beta acknowledgement and Phase 1 declaration persisted through HTTP.
- Coach profile and accepted coach-athlete relationship persisted through HTTP.
- Assignment composed from stored server records.
- Compile admission composed from stored declaration and assignment records.
- Compile-created session linked to athlete, coach and assignment.
- Runtime start and completion events persisted.
- Athlete history generated from factual stored state.
- Coach artefacts generated server-side and protected by stored relationship and assignment state.
- An unrelated coach was denied.
- State, events, athlete history and coach artefacts remained identical after a new operating-system process started.
- Session-state GET normalization was corrected so it performs no session-row update.

## Validated Commits

- Original base: `9d6759cc69d516a7c854f49098636fb0977f43f0`
- Persistence foundation: `e23c077abc68aa2452bd0bf7d5858145515ae050`
- Stored journey: `d4faf52a781493b68273135e4ef6393d171df510`

## CI Registration

- Manifest: `ci/contracts/test_ci_integration_vertical_slice_cluster_manifest.json`
- Evidence test: `test/beta_e2e_01_closure_evidence.test.mjs`
- Restart test: `test/beta_e2e_01_persistent_http_product_journey_restart.integration.test.mjs`

## Pinned Source Hashes

- `b6498ddee4dca3a43e12e5fb81dcc55a4ab4823caab780a986713ec769c5a6dd` ? `schema.sql`
- `6a5e52923323ab9d514f634c4b9815530436abf5a99f862f39dbb89f8be1ec05` ? `src/api/beta_product_record_store.ts`
- `ea2a7e05c7468212705f5bb0c2972237fd8f030d46c3ce21d381a9b523e0565e` ? `src/api/beta_product_journey_service.ts`
- `45db532638eb42b45da0cd93669422d3985ec35556afae05a592c4196f24f642` ? `src/api/block_compile_write_service.ts`
- `ef77dc0b648016ea35f802303ae3758c08aa16094cfaec57dcf7508c280a4b12` ? `src/api/blocks.handlers.ts`
- `cd177c7d6033abc9956a4b6c7173cb14985b4dd91182d53d215d054ec5cdd872` ? `src/api/sessions.handlers.ts`
- `56a21096bea50e1e255639facd3707a24b1fcbd123b10f6f0e713873ec2f47b7` ? `src/api/sessions.routes.ts`
- `d2ab6d48933ce7d9535cd970956909f47351ff153b6ee975147ad4f1dfac92d8` ? `src/api/session_state_query_service.ts`
- `2a7d9e800b6f28a995d93049547c9103495b32e1b6bcea7ae6c047f4e943405a` ? `test/beta_e2e_01_product_record_store.integration.test.mjs`
- `e4f6f8710164200663e42e3a68065fb1c53e6fda3a0b6728ce73a84f5ba1d89c` ? `test/beta_e2e_01_stored_journey_composition.integration.test.mjs`
- `e6ccb7d4296afc1a5a3b832a4705e7317c5b8ed432b0b3825aa1aaf107ee3693` ? `test/beta_e2e_01_persistent_http_product_journey_restart.integration.test.mjs`
- `07b95481e1605e50a0737d138a12a1bb895ebe7f9f544b42c872e57069d60017` ? `ci/contracts/test_ci_integration_vertical_slice_cluster_manifest.json`
