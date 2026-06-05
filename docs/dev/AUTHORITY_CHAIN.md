# Documentation Authority Chain

This file explains what wins when Kolosseum documents, comments, tests, or implementation details appear to conflict.

## Core Rule

Navigation docs help people find the law. They do not create the law.

## Authority Order

Use this order unless a current release boundary explicitly states otherwise.

### 1. Active Release Boundary

The active release boundary defines what the current release is and is not allowed to contain.

It wins over older roadmap notes, old plans, speculative commercial ideas, and abandoned drafts.

### 2. Engine Contracts And Executable Tests

Engine contracts and tests define deterministic behaviour.

If engine behaviour is changed, the change must be intentional, sliced, documented, and proven.

### 3. Registry Contracts And Validation Rules

Registry contracts define supported content and closure rules.

Do not add unsupported activities, hidden fallback, or undocumented mappings.

### 4. Proof, Replay, Hash, And Evidence Rules

Proof rules protect determinism, auditability, and replay.

Do not change proof behaviour as a side effect of UI, dashboard, or developer convenience work.

### 5. Current Slice Contract

The active slice defines the allowed change.

If an improvement is outside the slice, it should become a later slice.

### 6. Module README And Developer Notes

Module docs and DEV NOTE comments explain purpose, boundaries, invariants, and failure behaviour.

They do not override contracts or tests.

### 7. Historical Documents

Historical docs may explain why a decision was made.

They do not override the active release boundary.

## Conflict Handling

When a conflict is found:

1. Identify both sources.
2. Determine authority level.
3. Preserve the higher-authority source.
4. Do not silently delete the lower-authority source.
5. Add a clarification or pointer if needed.
6. If behaviour must change, create a slice.

## Developer Comments

Comments are useful when they explain:

- Purpose
- Boundary
- Determinism
- Failure behaviour
- Non-obvious constraints

Comments are harmful when they:

- Restate obvious code
- Create new product rules
- Contradict canonical docs
- Use unsupported claim language
- Describe aspirational future behaviour as current behaviour

## Rule For Future Docs

Do not duplicate canonical rules into many places.

Prefer:

- Short summary
- Link or pointer to authority
- Search terms
- Boundary warning

This keeps the docs searchable without creating drift.
