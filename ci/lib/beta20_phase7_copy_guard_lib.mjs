// DEV NOTE: BETA-20 presentation-copy and optional render-stack validation.
// This library is CI/presentation law only and does not enter engine truth.

export const BETA20_COPY_IDS =
  Object.freeze({
    projection_metadata:
      "PHASE7_PROJECTION_METADATA_LABEL",
    program_summary:
      "PHASE7_PROGRAM_SUMMARY_LABEL",
    block_summary:
      "PHASE7_BLOCK_SUMMARY_LABEL",
    session_list:
      "PHASE7_SESSION_LIST_LABEL",
    event_digest:
      "PHASE7_EVENT_DIGEST_LABEL",
    factual_boundary:
      "PHASE7_FACTUAL_BOUNDARY_LABEL"
  });

const EXPECTED_COPY_ID_LIST =
  Object.freeze(
    Object.values(
      BETA20_COPY_IDS
    )
  );

const FORBIDDEN_TERMS =
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

const PDF_DEPENDENCY_PATTERN =
  /pdf|puppeteer|playwright|canvas|fontkit|wkhtml|chromium/iu;

function isRecord(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function makeFailure(
  reason,
  details = {}
) {
  return Object.freeze({
    reason,
    ...details
  });
}

function error(
  reason,
  details = {}
) {
  const value =
    new Error(
      `beta20_phase7_copy_guard_${reason}`
    );

  value.reason = reason;
  value.details =
    Object.freeze({
      ...details
    });

  return value;
}

export function buildBeta20Phase7CopyReferences() {
  return Object.freeze({
    surface_id:
      "beta20_phase7_projection",
    section_label_copy_ids:
      Object.freeze({
        projection_metadata:
          BETA20_COPY_IDS
            .projection_metadata,
        program_summary:
          BETA20_COPY_IDS
            .program_summary,
        block_summary:
          BETA20_COPY_IDS
            .block_summary,
        session_list:
          BETA20_COPY_IDS
            .session_list,
        event_digest:
          BETA20_COPY_IDS
            .event_digest
      }),
    boundary_copy_id:
      BETA20_COPY_IDS
        .factual_boundary
  });
}

export function validateBeta20Phase7CopyReferences(
  value
) {
  if (!isRecord(value)) {
    throw error(
      "copy_reference_record_required"
    );
  }

  const expected =
    buildBeta20Phase7CopyReferences();

  if (
    JSON.stringify(value) !==
    JSON.stringify(expected)
  ) {
    throw error(
      "inline_copy_or_unknown_reference_forbidden"
    );
  }

  return expected;
}

export function lintBeta20Phase7CopyRegistry(
  value
) {
  const failures = [];

  if (!isRecord(value)) {
    return Object.freeze({
      ok: false,
      failures:
        Object.freeze([
          makeFailure(
            "copy_registry_record_required"
          )
        ])
    });
  }

  if (
    value.surface_id !==
      "beta20_phase7_projection"
  ) {
    failures.push(
      makeFailure(
        "surface_id_invalid"
      )
    );
  }

  if (
    value.surface_version !==
      "1.0.0"
  ) {
    failures.push(
      makeFailure(
        "surface_version_invalid"
      )
    );
  }

  if (
    value.copy_scope !==
      "phase7_factual_projection_labels"
  ) {
    failures.push(
      makeFailure(
        "copy_scope_invalid"
      )
    );
  }

  if (!Array.isArray(value.entries)) {
    failures.push(
      makeFailure(
        "copy_entries_array_required"
      )
    );
  }
  else {
    const actualIds =
      value.entries.map(
        (entry) =>
          entry?.copy_id
      );

    if (
      JSON.stringify(actualIds) !==
      JSON.stringify(
        EXPECTED_COPY_ID_LIST
      )
    ) {
      failures.push(
        makeFailure(
          "copy_id_set_or_order_invalid"
        )
      );
    }

    if (
      new Set(actualIds).size !==
      actualIds.length
    ) {
      failures.push(
        makeFailure(
          "duplicate_copy_id"
        )
      );
    }

    for (
      const entry
      of value.entries
    ) {
      if (!isRecord(entry)) {
        failures.push(
          makeFailure(
            "copy_entry_record_required"
          )
        );

        continue;
      }

      if (
        typeof entry.copy_id !==
          "string" ||
        typeof entry.text !==
          "string" ||
        entry.text.trim().length === 0 ||
        !Array.isArray(entry.params) ||
        entry.params.length !== 0
      ) {
        failures.push(
          makeFailure(
            "copy_entry_invalid",
            {
              copy_id:
                entry.copy_id ?? null
            }
          )
        );

        continue;
      }

      const lower =
        entry.text.toLowerCase();

      for (
        const term
        of FORBIDDEN_TERMS
      ) {
        if (lower.includes(term)) {
          failures.push(
            makeFailure(
              "claim_term_found",
              {
                copy_id:
                  entry.copy_id,
                term
              }
            )
          );
        }
      }
    }
  }

  if (
    !isRecord(
      value.render_boundary
    ) ||
    value.render_boundary
      .inline_copy_allowed !==
        false ||
    value.render_boundary
      .engine_projection_contains_copy !==
        false ||
    value.render_boundary
      .copy_resolution_layer !==
        "presentation_only"
  ) {
    failures.push(
      makeFailure(
        "render_boundary_invalid"
      )
    );
  }

  return Object.freeze({
    ok:
      failures.length === 0,
    failures:
      Object.freeze(failures)
  });
}

function allDependencies(
  packageJson
) {
  return {
    ...(
      isRecord(
        packageJson?.dependencies
      )
        ? packageJson.dependencies
        : {}
    ),
    ...(
      isRecord(
        packageJson?.devDependencies
      )
        ? packageJson.devDependencies
        : {}
    )
  };
}

function isExactVersion(value) {
  return (
    typeof value === "string" &&
    /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u
      .test(value)
  );
}

export function lintBeta20RenderStackContract(
  contract,
  packageJson
) {
  const failures = [];

  if (
    !isRecord(contract) ||
    contract.contract_id !==
      "beta20_phase7_render_stack" ||
    contract.contract_version !==
      "1.0.0" ||
    contract.slice_id !==
      "BETA-20"
  ) {
    failures.push(
      makeFailure(
        "render_contract_identity_invalid"
      )
    );
  }

  if (
    !Array.isArray(
      contract?.content_formats
    ) ||
    contract.content_formats[0] !==
      "application/json" ||
    (
      contract.content_formats.length ===
        1
    ) === false
  ) {
    failures.push(
      makeFailure(
        "json_only_content_format_required"
      )
    );
  }

  if (
    !isRecord(contract?.json) ||
    contract.json.encoding !==
      "utf-8" ||
    contract.json
      .projection_hash_source !==
        "rendered_output_utf8_bytes" ||
    !Array.isArray(
      contract.json
        .root_section_order
    )
  ) {
    failures.push(
      makeFailure(
        "json_render_contract_invalid"
      )
    );
  }

  const dependencies =
    allDependencies(
      packageJson
    );

  const pdfDependencies =
    Object.entries(dependencies)
      .filter(
        ([name]) =>
          PDF_DEPENDENCY_PATTERN
            .test(name)
      );

  const pdf =
    contract?.pdf;

  if (!isRecord(pdf)) {
    failures.push(
      makeFailure(
        "pdf_contract_record_required"
      )
    );
  }
  else if (pdf.enabled === false) {
    if (
      pdf.renderer !== null ||
      !Array.isArray(pdf.fonts) ||
      pdf.fonts.length !== 0 ||
      pdf.system_fonts_allowed !==
        false ||
      contract.content_formats
        .includes(
          "application/pdf"
        ) ||
      pdfDependencies.length > 0
    ) {
      failures.push(
        makeFailure(
          "disabled_pdf_surface_not_empty"
        )
      );
    }
  }
  else if (pdf.enabled === true) {
    if (
      !contract.content_formats
        .includes(
          "application/pdf"
        )
    ) {
      failures.push(
        makeFailure(
          "pdf_content_format_missing"
        )
      );
    }

    if (
      !isRecord(pdf.renderer) ||
      typeof pdf.renderer.package !==
        "string" ||
      !isExactVersion(
        pdf.renderer.exact_version
      ) ||
      dependencies[
        pdf.renderer.package
      ] !==
        pdf.renderer.exact_version
    ) {
      failures.push(
        makeFailure(
          "pdf_renderer_not_exactly_pinned"
        )
      );
    }

    if (
      !Array.isArray(pdf.fonts) ||
      pdf.fonts.length === 0 ||
      pdf.fonts.some(
        (font) =>
          !isRecord(font) ||
          typeof font.path !==
            "string" ||
          !/^[a-f0-9]{64}$/u.test(
            font.sha256
          )
      )
    ) {
      failures.push(
        makeFailure(
          "pdf_fonts_not_hash_pinned"
        )
      );
    }

    if (
      pdf.deterministic_metadata !==
        true ||
      pdf.system_fonts_allowed !==
        false ||
      typeof pdf.locale !==
        "string" ||
      typeof pdf.timezone !==
        "string"
    ) {
      failures.push(
        makeFailure(
          "pdf_environment_not_pinned"
        )
      );
    }
  }
  else {
    failures.push(
      makeFailure(
        "pdf_enabled_boolean_required"
      )
    );
  }

  return Object.freeze({
    ok:
      failures.length === 0,
    failures:
      Object.freeze(failures)
  });
}
