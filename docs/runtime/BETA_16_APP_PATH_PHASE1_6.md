# BETA-16 App Path Phase 1-6

## Status

BETA-16 connects the existing controlled-beta application surfaces from product account state through Phase 1 declaration, compile, session creation and Phase 6 execution.

It extends the existing session runner screen and the existing `/sessions` and `/blocks` routers. It does not add a second application, a second execution runtime or a new authentication provider.

## User path

The clean individual-user path is:

1. Record the existing athlete product/auth state.
2. Record the controlled-beta acknowledgement.
3. Record the user-declared Phase 1 declaration.
4. Submit the same hash-bound Phase 1 input to the existing compile route.
5. Create and start the resulting session.
6. Record completion, split and explicit return events.
7. Read factual completed, remaining and dropped counts.

The compile route refuses a BETA-16 context unless the beta-path query flag is explicit.

The compile route also refuses:

- record hash divergence;
- user-binding divergence;
- missing acknowledgement;
- invalid or superseded declaration state;
- Phase 1 input divergence between declaration and compile.

## Existing auth boundary

BETA-16 uses the existing product/auth-record model. It does not claim to implement password verification, an external identity provider or a durable login session.

The account record remains product state only and engine-invisible.

## Copy Registry

All BETA-16 browser prose is stored in:

`copy/beta_16_app_path_phase1_6_copy.json`

The browser-served mirror is:

`public/beta_16_app_path_phase1_6_copy.json`

The two files must remain byte-identical. Every `BETA16_COPY_*` identifier referenced by the screen, browser controller or app-path service must exist in the registry.

## Execution surface

BETA-16 retains the existing routes:

- `POST /blocks/compile?create_session=true`
- `POST /sessions/:session_id/start`
- `POST /sessions/:session_id/events`
- `GET /sessions/:session_id/state`
- `GET /sessions/:session_id/events`

The browser supports:

- completion recording;
- session split;
- explicit return continue;
- explicit return skip;
- factual partial classification;
- completed, remaining and dropped counts.

## Boundary

BETA-16 adds no Phase 7 UI and no Phase 8 UI.

It adds no dashboard, analytics, readiness assessment, recommendation, performance judgement, safety judgement or outcome claim.

The browser cannot change engine truth except by submitting an existing validated compile request or an existing factual runtime event.
