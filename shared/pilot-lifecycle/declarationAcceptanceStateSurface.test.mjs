import test from "node:test";
import assert from "node:assert/strict";

import {
  DECLARATION_ALLOWED_TRANSITIONS,
  DECLARATION_STATE,
  DECLARATION_STATE_LIST,
  assertDeclarationStateMatchesContext,
  assertDeclarationTransitionAllowed,
  assertDeclarationTransitionMatchesContext,
  canTransitionDeclarationState,
  resolveDeclarationState,
} from "./declarationAcceptanceStateSurface.mjs";

test("declaration state enum is exact and closed", () => {
  assert.deepEqual(DECLARATION_STATE_LIST, [
    "pending",
    "accepted",
    "blocked",
    "superseded",
  ]);
});

test("declaration allowed transitions are exact", () => {
  assert.deepEqual(DECLARATION_ALLOWED_TRANSITIONS, {
    pending: ["accepted", "blocked", "superseded"],
    accepted: ["superseded"],
    blocked: ["pending", "superseded"],
    superseded: [],
  });
});

test("pending can move to accepted blocked or superseded", () => {
  assert.equal(canTransitionDeclarationState("pending", "accepted"), true);
  assert.equal(canTransitionDeclarationState("pending", "blocked"), true);
  assert.equal(canTransitionDeclarationState("pending", "superseded"), true);
});

test("accepted can only move to superseded", () => {
  assert.equal(canTransitionDeclarationState("accepted", "superseded"), true);
  assert.equal(canTransitionDeclarationState("accepted", "pending"), false);
  assert.equal(canTransitionDeclarationState("accepted", "blocked"), false);
  assert.equal(canTransitionDeclarationState("accepted", "accepted"), false);
});

test("blocked can move back to pending or to superseded", () => {
  assert.equal(canTransitionDeclarationState("blocked", "pending"), true);
  assert.equal(canTransitionDeclarationState("blocked", "superseded"), true);
  assert.equal(canTransitionDeclarationState("blocked", "accepted"), false);
  assert.equal(canTransitionDeclarationState("blocked", "blocked"), false);
});

test("superseded is terminal", () => {
  assert.equal(canTransitionDeclarationState("superseded", "pending"), false);
  assert.equal(canTransitionDeclarationState("superseded", "accepted"), false);
  assert.equal(canTransitionDeclarationState("superseded", "blocked"), false);
  assert.equal(canTransitionDeclarationState("superseded", "superseded"), false);
});

test("forbidden transition throws", () => {
  assert.throws(
    () => assertDeclarationTransitionAllowed("accepted", "blocked"),
    /declaration_state_transition_forbidden:accepted->blocked/,
  );
});

test("resolve declaration state defaults to pending", () => {
  assert.equal(resolveDeclarationState({}), DECLARATION_STATE.PENDING);
});

test("resolve declaration state returns accepted when explicit accepted flag is true", () => {
  assert.equal(
    resolveDeclarationState({ accepted: true }),
    DECLARATION_STATE.ACCEPTED,
  );
});

test("resolve declaration state returns blocked when explicit blocked flag is true", () => {
  assert.equal(
    resolveDeclarationState({ blocked: true }),
    DECLARATION_STATE.BLOCKED,
  );
});

test("resolve declaration state returns superseded when explicit superseded flag is true", () => {
  assert.equal(
    resolveDeclarationState({ superseded: true }),
    DECLARATION_STATE.SUPERSEDED,
  );
});

test("superseded has priority over accepted in a lawful context", () => {
  assert.equal(
    resolveDeclarationState({
      accepted: true,
      blocked: false,
      superseded: true,
    }),
    DECLARATION_STATE.SUPERSEDED,
  );
});

test("superseded has priority over blocked in a lawful context", () => {
  assert.equal(
    resolveDeclarationState({
      accepted: false,
      blocked: true,
      superseded: true,
    }),
    DECLARATION_STATE.SUPERSEDED,
  );
});

test("declaration cannot be simultaneously accepted and blocked", () => {
  assert.throws(
    () =>
      resolveDeclarationState({
        accepted: true,
        blocked: true,
        superseded: false,
      }),
    /declaration_state_invalid:accepted_and_blocked/,
  );
});

test("accepted and blocked remains invalid even if superseded is also true", () => {
  assert.throws(
    () =>
      resolveDeclarationState({
        accepted: true,
        blocked: true,
        superseded: true,
      }),
    /declaration_state_invalid:accepted_and_blocked/,
  );
});

test("state matches context for lawful states", () => {
  assert.equal(
    assertDeclarationStateMatchesContext("pending", {}),
    true,
  );

  assert.equal(
    assertDeclarationStateMatchesContext("accepted", { accepted: true }),
    true,
  );

  assert.equal(
    assertDeclarationStateMatchesContext("blocked", { blocked: true }),
    true,
  );

  assert.equal(
    assertDeclarationStateMatchesContext("superseded", { superseded: true }),
    true,
  );
});

test("state mismatch against context throws", () => {
  assert.throws(
    () =>
      assertDeclarationStateMatchesContext("accepted", { blocked: true }),
    /declaration_state_context_mismatch:accepted resolved=blocked/,
  );
});

test("pending to accepted transition matches explicit accepted context", () => {
  assert.equal(
    assertDeclarationTransitionMatchesContext("pending", "accepted", {
      accepted: true,
    }),
    true,
  );
});

test("pending to blocked transition matches explicit blocked context", () => {
  assert.equal(
    assertDeclarationTransitionMatchesContext("pending", "blocked", {
      blocked: true,
    }),
    true,
  );
});

test("accepted to superseded transition matches explicit superseded context", () => {
  assert.equal(
    assertDeclarationTransitionMatchesContext("accepted", "superseded", {
      superseded: true,
    }),
    true,
  );
});

test("blocked to pending transition matches cleared state context", () => {
  assert.equal(
    assertDeclarationTransitionMatchesContext("blocked", "pending", {}),
    true,
  );
});

test("transition context mismatch throws", () => {
  assert.throws(
    () =>
      assertDeclarationTransitionMatchesContext("pending", "accepted", {
        blocked: true,
      }),
    /declaration_state_context_mismatch:accepted resolved=blocked/,
  );
});

test("unknown state is rejected", () => {
  assert.throws(
    () => canTransitionDeclarationState("unknown", "accepted"),
    /declaration_state_from_unknown:unknown/,
  );

  assert.throws(
    () => canTransitionDeclarationState("pending", "unknown"),
    /declaration_state_to_unknown:unknown/,
  );
});