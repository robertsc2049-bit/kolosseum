// DEV NOTE: BETA-20 Phase 7 hash and copy guard.
// The factual projection remains Phase 6-only. Root section order is pinned,
// rendered JSON is canonical, and projection_hash covers only the exact UTF-8
// rendered_output bytes. User-facing copy remains outside engine truth.

import {
  createHash
} from "node:crypto";

import {
  Beta18Phase7SchemaError,
  validateBeta18Phase7Input
} from "./beta18Phase7SchemaBinding.js";

import type {
  Beta18Phase7FailureToken,
  Beta18Phase7Result,
  Phase7Input,
  Phase7Output
} from "./beta18Phase7SchemaBinding.js";

import {
  buildBeta19Phase7RenderedProjection
} from "./beta19Phase7FactualProjection.js";

import type {
  Beta19RenderedProjection
} from "./beta19Phase7FactualProjection.js";

import {
  betaCanonicalJson
} from "./betaCanonical.js";

type JsonRecord =
  Record<string, unknown>;

export const BETA20_PHASE7_SECTION_ORDER =
  Object.freeze([
    "projection_metadata",
    "program_summary",
    "block_summary",
    "session_list",
    "event_digest"
  ] as const);

const REQUIRED_SECTION_KEYS =
  Object.freeze([
    "projection_metadata",
    "program_summary",
    "session_list",
    "event_digest"
  ] as const);

const OUTPUT_KEYS =
  Object.freeze([
    "phase7_projection_id",
    "canonical_input_hash",
    "selection_hash",
    "execution_status",
    "execution_state",
    "content_format",
    "rendered_output",
    "projection_hash"
  ] as const);

const INLINE_COPY_KEYS =
  new Set([
    "copy",
    "copy_id",
    "copy_ids",
    "copy_text",
    "description",
    "heading",
    "label",
    "labels",
    "message",
    "narrative",
    "subtitle",
    "text",
    "title",
    "user_facing_text"
  ]);

const FORBIDDEN_CLAIM_TERMS =
  Object.freeze([
    "advice",
    "best",
    "effective",
    "effectiveness",
    "good",
    "infer",
    "optimal",
    "poor",
    "rank",
    "readiness",
    "recommend",
    "safe",
    "safety",
    "suitability",
    "suitable"
  ]);

export const beta20Phase7HashCopyGuardContract =
  Object.freeze({
    contract_id:
      "beta20_phase7_hash_copy_guard",
    slice_id: "BETA-20",
    version: "1.0.0",
    content_formats:
      Object.freeze([
        "application/json"
      ]),
    canonical_encoding: "utf-8",
    root_section_order:
      BETA20_PHASE7_SECTION_ORDER,
    projection_hash_source:
      "canonical_rendered_output_utf8_bytes_only",
    copy_policy:
      "presentation_copy_registry_only",
    inline_copy_allowed: false,
    pdf_enabled: false
  });

function isRecord(
  value: unknown
): value is JsonRecord {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function hasOwn(
  value: JsonRecord,
  key: string
): boolean {
  return Object.prototype
    .hasOwnProperty.call(
      value,
      key
    );
}

function cloneJson<T>(
  value: T
): T {
  return JSON.parse(
    JSON.stringify(value)
  ) as T;
}

function deepFreeze<T>(
  value: T
): T {
  if (
    value === null ||
    (
      typeof value !== "object" &&
      typeof value !== "function"
    )
  ) {
    return value;
  }

  if (Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(
    value as object
  );

  if (Array.isArray(value)) {
    for (const child of value) {
      deepFreeze(child);
    }
  }
  else {
    for (
      const child
      of Object.values(
        value as JsonRecord
      )
    ) {
      deepFreeze(child);
    }
  }

  return value;
}

function fail(
  failureToken:
    Beta18Phase7FailureToken,
  message: string,
  details: JsonRecord = {}
): never {
  throw new Beta18Phase7SchemaError(
    failureToken,
    message,
    details
  );
}

function assertRecord(
  value: unknown,
  objectName: string
): asserts value is JsonRecord {
  if (!isRecord(value)) {
    fail(
      "phase7_output_invalid",
      `${objectName} must be an object.`,
      {
        object: objectName
      }
    );
  }
}

function assertExactKeys(
  value: JsonRecord,
  expectedKeys:
    readonly string[],
  objectName: string
): void {
  const expected =
    new Set(expectedKeys);

  for (
    const key
    of Object.keys(value)
  ) {
    if (!expected.has(key)) {
      fail(
        "phase7_output_invalid",
        `${objectName} contains an unknown field.`,
        {
          object: objectName,
          field: key
        }
      );
    }
  }

  for (const key of expectedKeys) {
    if (!hasOwn(value, key)) {
      fail(
        "phase7_output_invalid",
        `${objectName} is missing a required field.`,
        {
          object: objectName,
          field: key
        }
      );
    }
  }
}

function isInlineCopyKey(
  key: string
): boolean {
  const normalised =
    key.toLowerCase();

  return (
    INLINE_COPY_KEYS.has(
      normalised
    ) ||
    normalised.endsWith(
      "_copy"
    ) ||
    normalised.endsWith(
      "_description"
    ) ||
    normalised.endsWith(
      "_heading"
    ) ||
    normalised.endsWith(
      "_label"
    ) ||
    normalised.endsWith(
      "_message"
    ) ||
    normalised.endsWith(
      "_subtitle"
    ) ||
    normalised.endsWith(
      "_text"
    ) ||
    normalised.endsWith(
      "_title"
    )
  );
}

function assertClaimSafeString(
  value: string,
  path: string
): void {
  if (
    !/[\s.!?]/u.test(value)
  ) {
    return;
  }

  const lower =
    value.toLowerCase();

  for (
    const term
    of FORBIDDEN_CLAIM_TERMS
  ) {
    if (lower.includes(term)) {
      fail(
        "phase7_output_invalid",
        "Phase 7 rendered output contains forbidden claim language.",
        {
          path,
          term
        }
      );
    }
  }
}

export function assertBeta20ProjectionCopyClaimSafe(
  value: unknown,
  pathParts:
    readonly string[] = []
): void {
  if (Array.isArray(value)) {
    value.forEach(
      (child, index) =>
        assertBeta20ProjectionCopyClaimSafe(
          child,
          [
            ...pathParts,
            String(index)
          ]
        )
    );

    return;
  }

  if (typeof value === "string") {
    assertClaimSafeString(
      value,
      pathParts.join(".")
    );

    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (
    const [key, child]
    of Object.entries(value)
  ) {
    if (isInlineCopyKey(key)) {
      fail(
        "phase7_output_invalid",
        "Inline user-facing copy is forbidden from Phase 7 rendered output.",
        {
          field: key,
          path: [
            ...pathParts,
            key
          ].join(".")
        }
      );
    }

    assertBeta20ProjectionCopyClaimSafe(
      child,
      [
        ...pathParts,
        key
      ]
    );
  }
}

function expectedSectionOrder(
  value: JsonRecord
): string[] {
  return BETA20_PHASE7_SECTION_ORDER
    .filter(
      (section) =>
        hasOwn(
          value,
          section
        )
    );
}

export function canonicaliseBeta20RenderedOutput(
  value: unknown
): string {
  assertRecord(
    value,
    "phase7_rendered_projection"
  );

  const allowed =
    new Set<string>(
      BETA20_PHASE7_SECTION_ORDER
    );

  for (
    const key
    of Object.keys(value)
  ) {
    if (!allowed.has(key)) {
      fail(
        "phase7_output_invalid",
        "Phase 7 rendered output contains an unsupported section.",
        {
          section: key
        }
      );
    }
  }

  for (
    const key
    of REQUIRED_SECTION_KEYS
  ) {
    if (!hasOwn(value, key)) {
      fail(
        "phase7_output_invalid",
        "Phase 7 rendered output is missing a required section.",
        {
          section: key
        }
      );
    }
  }

  assertBeta20ProjectionCopyClaimSafe(
    value
  );

  const sections =
    expectedSectionOrder(
      value
    );

  const fields =
    sections.map(
      (section) =>
        `${JSON.stringify(section)}:${betaCanonicalJson(value[section])}`
    );

  return `{${fields.join(",")}}`;
}

export function hashBeta20RenderedOutputBytes(
  renderedOutput: string
): string {
  if (
    typeof renderedOutput !==
      "string"
  ) {
    fail(
      "phase7_output_invalid",
      "Rendered output must be a UTF-8 JSON string."
    );
  }

  return createHash("sha256")
    .update(
      renderedOutput,
      "utf8"
    )
    .digest("hex");
}

export function validateBeta20CanonicalRenderedBytes(
  renderedOutput: unknown
): Beta19RenderedProjection {
  if (
    typeof renderedOutput !==
      "string"
  ) {
    fail(
      "phase7_output_invalid",
      "Rendered output must be a string."
    );
  }

  let parsed: unknown;

  try {
    parsed =
      JSON.parse(
        renderedOutput
      );
  }
  catch {
    fail(
      "phase7_output_invalid",
      "Rendered output must contain valid JSON."
    );
  }

  const canonical =
    canonicaliseBeta20RenderedOutput(
      parsed
    );

  if (canonical !== renderedOutput) {
    fail(
      "phase7_output_invalid",
      "Rendered output bytes are not canonical."
    );
  }

  assertRecord(
    parsed,
    "phase7_rendered_projection"
  );

  const actualOrder =
    Object.keys(parsed);

  const requiredOrder =
    expectedSectionOrder(
      parsed
    );

  if (
    actualOrder.join("\u0000") !==
    requiredOrder.join("\u0000")
  ) {
    fail(
      "phase7_output_invalid",
      "Rendered output section ordering is not deterministic.",
      {
        expected:
          requiredOrder,
        actual:
          actualOrder
      }
    );
  }

  return deepFreeze(
    cloneJson(
      parsed
    ) as
      Beta19RenderedProjection
  );
}

function projectFromValidated(
  input:
    Phase7Input
): Phase7Output {
  if (
    input.content_format !==
      "application/json"
  ) {
    fail(
      "phase7_input_invalid",
      "BETA-20 supports application/json only."
    );
  }

  const renderedProjection =
    buildBeta19Phase7RenderedProjection(
      input
    );

  const renderedOutput =
    canonicaliseBeta20RenderedOutput(
      renderedProjection
    );

  return deepFreeze({
    phase7_projection_id:
      input.phase7_projection_id,
    canonical_input_hash:
      input.phase6_output
        .canonical_input_hash,
    selection_hash:
      input.phase6_output
        .selection_hash,
    execution_status:
      input.phase6_output
        .execution_status,
    execution_state:
      cloneJson(
        input.phase6_output
          .execution_state
      ),
    content_format:
      "application/json",
    rendered_output:
      renderedOutput,
    projection_hash:
      hashBeta20RenderedOutputBytes(
        renderedOutput
      )
  });
}

export function projectBeta20Phase7(
  value: unknown
): Phase7Output {
  const input =
    validateBeta18Phase7Input(
      value
    );

  return projectFromValidated(
    input
  );
}

export function validateBeta20Phase7Output(
  inputValue: unknown,
  outputValue: unknown
): Phase7Output {
  const input =
    validateBeta18Phase7Input(
      inputValue
    );

  assertRecord(
    outputValue,
    "phase7_output"
  );

  assertExactKeys(
    outputValue,
    OUTPUT_KEYS,
    "phase7_output"
  );

  if (
    outputValue
      .phase7_projection_id !==
    input.phase7_projection_id
  ) {
    fail(
      "phase7_binding_mismatch",
      "Projection ID does not match the admitted Phase 7 input."
    );
  }

  if (
    outputValue
      .canonical_input_hash !==
    input.phase6_output
      .canonical_input_hash
  ) {
    fail(
      "phase7_binding_mismatch",
      "Canonical input hash echo mismatch."
    );
  }

  if (
    outputValue.selection_hash !==
    input.phase6_output
      .selection_hash
  ) {
    fail(
      "phase7_binding_mismatch",
      "Selection hash echo mismatch."
    );
  }

  if (
    outputValue.execution_status !==
    input.phase6_output
      .execution_status
  ) {
    fail(
      "phase7_binding_mismatch",
      "Execution status echo mismatch."
    );
  }

  if (
    betaCanonicalJson(
      outputValue.execution_state
    ) !==
    betaCanonicalJson(
      input.phase6_output
        .execution_state
    )
  ) {
    fail(
      "phase7_binding_mismatch",
      "Execution state echo mismatch."
    );
  }

  if (
    outputValue.content_format !==
      "application/json" ||
    outputValue.content_format !==
      input.content_format
  ) {
    fail(
      "phase7_output_invalid",
      "BETA-20 output content format must be application/json."
    );
  }

  const expected =
    projectFromValidated(
      input
    );

  validateBeta20CanonicalRenderedBytes(
    outputValue.rendered_output
  );

  if (
    outputValue.rendered_output !==
      expected.rendered_output
  ) {
    fail(
      "phase7_output_invalid",
      "Rendered output is not the exact canonical factual projection."
    );
  }

  if (
    typeof outputValue
      .projection_hash !==
      "string" ||
    !/^[a-f0-9]{64}$/u.test(
      outputValue
        .projection_hash
    )
  ) {
    fail(
      "phase7_output_invalid",
      "Projection hash must be a lowercase SHA-256 hash."
    );
  }

  const expectedHash =
    hashBeta20RenderedOutputBytes(
      outputValue
        .rendered_output as
          string
    );

  if (
    outputValue.projection_hash !==
      expectedHash
  ) {
    fail(
      "phase7_projection_hash_mismatch",
      "Projection hash does not match the canonical rendered-output bytes.",
      {
        expected:
          expectedHash,
        actual:
          outputValue
            .projection_hash
      }
    );
  }

  return deepFreeze(
    cloneJson(
      outputValue
    ) as unknown as
      Phase7Output
  );
}

export function tryProjectBeta20Phase7(
  value: unknown
): Beta18Phase7Result {
  try {
    return deepFreeze({
      ok: true,
      phase7:
        projectBeta20Phase7(
          value
        )
    });
  }
  catch (error) {
    if (
      error instanceof
        Beta18Phase7SchemaError
    ) {
      return deepFreeze({
        ok: false,
        failure_token:
          error.failure_token,
        details:
          error.details
      });
    }

    return deepFreeze({
      ok: false,
      failure_token:
        "phase7_input_invalid",
      details: {
        reason:
          error instanceof Error
            ? error.message
            : String(error)
      }
    });
  }
}
