# TICKET_011 — Phase2 Canonical Envelope Preservation (Empty Constraints Must Persist)

DATE: 2026-01-14  
ENGINE_VERSION: EB2-1.0.0  
SCOPE: Engine (Phase 2 canonicalisation / hashing)  
STATUS: IMPLEMENTED ✅

---

## 0) Purpose

Ensure Phase2 canonicalisation preserves the *presence* of the Phase1 `constraints` envelope even when it is explicitly empty (`constraints: {}`).

This is required to support the closed-world contract introduced in Ticket 010:

- If the caller explicitly supplies `constraints: {}`, Phase3 must **not** inject default disqualifiers.
- If `constraints` is absent, Phase3 may apply defaults (demo rules / fallback behaviour).

The presence/absence of the envelope is semantic and must survive Phase2 canonicalisation and hashing.

---

## 1) Problem / Failure Mode Observed

An E2E baseline test pinned Phase1 to:

```js
constraints: {}
