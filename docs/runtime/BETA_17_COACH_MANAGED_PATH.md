# BETA-17 Coach Managed Path

## Status

BETA-17 connects the existing coach product contracts into one controlled-beta application path.

It extends the existing sessions router and existing session runner. It does not create a parallel application, new engine phase, new registry authority or coach override mechanism.

## Path

The minimal path is:

1. Record an active coach product profile.
2. Record an athlete invitation.
3. Record explicit athlete relationship acceptance.
4. Record an existing-contract assignment trigger.
5. Read factual session artefact records.
6. Record a non-binding coach note.
7. Deny further access after relationship revocation.

## Coach profile

Coach profile state is product-auth state only.

It is engine-invisible and grants no authority to:

- edit an athlete Phase 1 declaration;
- alter registry content;
- replace compile input;
- override an engine decision;
- mutate session execution truth.

## Relationship permission

Assignment, artefact viewing and note creation require:

- active coach profile;
- matching coach and athlete identities;
- individual coach-athlete scope;
- accepted relationship state;
- no revocation timestamp;
- no expiry timestamp.

Invited and revoked relationships fail closed.

## Assignment trigger

The BETA-17 assignment record references the existing S-V1-28 assignment contract.

It records product state only. It is not compile input and does not alter Phase 1, registry content or engine output.

## Factual artefacts

The coach artefact view exposes stored factual fields only:

- session and artefact identifiers;
- recorded session status;
- runtime event count;
- recorded runtime event identifiers and types.

The view is read-only, does not call the engine and does not include coach notes.

## Coach notes

Coach note text is stored exactly as supplied.

Every note is:

- non-binding;
- a product record only;
- stored separately from factual artefacts;
- excluded from engine input;
- excluded from compile hashes;
- unable to change Phase 1–6 output.

## Copy Registry

All BETA-17 browser prose is stored in:

`copy/beta_17_coach_managed_path_copy.json`

The browser mirror is:

`public/beta_17_coach_managed_path_copy.json`

The files must remain byte-identical and all referenced `BETA17_COPY_*` identifiers must exist in the registry.
