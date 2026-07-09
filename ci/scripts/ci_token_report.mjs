// DEV NOTE: CI token report contract helper.
// Purpose: standardise guard failure output into one machine-readable JSON report
// shape without changing what existing stable tokens mean.
// Boundary: this module formats CI reports only. It does not define token meaning,
// product behaviour, engine behaviour, registry law, copy text, replay semantics,
// Phase 7 semantics, or Phase 8 semantics.
// Determinism: reports are normalised with stable object key order and optional
// fields are included only when supplied.
// Failure: invalid failure metadata throws before report emission so missing
// token metadata cannot silently produce a malformed CI report.

import process from "node:process";

export const CI_TOKEN_REPORT_SCHEMA_VERSION = "kolosseum.ci_token_report.v1";
export const CI_TOKEN_REPORT_CONTRACT_TOKEN = "CI_BETA_TOKEN_REPORT_CONTRACT";

export const BETA_TOKEN_REPORT_TOPIC_TOKENS = Object.freeze({
  spine: "CI_BETA_SPINE_ARTEFACT_MANIFEST",
  schema: "CI_SCHEMA_GUARD",
  registry: "CI_REGISTRY_GUARD",
  copy: "CI_COPY_GUARD",
  replay: "CI_REPLAY_GUARD",
  phase7: "CI_BETA_PHASE_7_SCOPE",
  phase8: "CI_BETA_PHASE_8_SCOPE"
});

const REQUIRED_FAILURE_FIELDS = Object.freeze(["token", "message"]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normaliseLocation(input) {
  if (!isPlainObject(input)) return null;

  const out = {};
  const file = cleanString(input.file);
  const path = cleanString(input.path);

  if (file) out.file = file;
  if (path) out.path = path;

  if (Number.isInteger(input.line) && input.line > 0) {
    out.line = input.line;
  }

  if (Number.isInteger(input.column) && input.column > 0) {
    out.column = input.column;
  }

  return Object.keys(out).length > 0 ? Object.freeze(out) : null;
}

function normaliseDetails(input) {
  if (!isPlainObject(input)) return null;

  const entries = Object.entries(input)
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));

  if (entries.length === 0) return null;

  const out = {};
  for (const [key, value] of entries) {
    out[key] = value;
  }

  return Object.freeze(out);
}

export function normaliseTokenFailure(input) {
  if (!isPlainObject(input)) {
    throw new Error(`${CI_TOKEN_REPORT_CONTRACT_TOKEN}: failure must be an object`);
  }

  const token = cleanString(input.token);
  const message = cleanString(input.message);

  if (!token) {
    throw new Error(`${CI_TOKEN_REPORT_CONTRACT_TOKEN}: failure.token is required`);
  }

  if (!message) {
    throw new Error(`${CI_TOKEN_REPORT_CONTRACT_TOKEN}: failure.message is required`);
  }

  for (const field of REQUIRED_FAILURE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(input, field)) {
      throw new Error(`${CI_TOKEN_REPORT_CONTRACT_TOKEN}: failure.${field} is required`);
    }
  }

  const out = {
    token,
    message
  };

  const severity = cleanString(input.severity);
  if (severity) out.severity = severity;

  const source = cleanString(input.source);
  if (source) out.source = source;

  const location = normaliseLocation(input.location);
  if (location) out.location = location;

  const details = normaliseDetails(input.details);
  if (details) out.details = details;

  return Object.freeze(out);
}

export function createCiTokenReport(input = {}) {
  if (!isPlainObject(input)) {
    throw new Error(`${CI_TOKEN_REPORT_CONTRACT_TOKEN}: report input must be an object`);
  }

  const guard = cleanString(input.guard);
  if (!guard) {
    throw new Error(`${CI_TOKEN_REPORT_CONTRACT_TOKEN}: report.guard is required`);
  }

  const rawFailures = Array.isArray(input.failures) ? input.failures : [];
  const failures = rawFailures.map((failure) => normaliseTokenFailure(failure));

  const report = {
    ok: failures.length === 0,
    schema_version: CI_TOKEN_REPORT_SCHEMA_VERSION,
    guard,
    failure_count: failures.length
  };

  const token = cleanString(input.token);
  if (token) report.token = token;

  const path = cleanString(input.path);
  if (path) report.path = path;

  const message = cleanString(input.message);
  if (message) report.message = message;

  if (failures.length > 0) {
    report.failures = Object.freeze(failures);
  }

  const details = normaliseDetails(input.details);
  if (details) report.details = details;

  return Object.freeze(report);
}

export function emitCiTokenReport(report, options = {}) {
  if (!isPlainObject(report)) {
    throw new Error(`${CI_TOKEN_REPORT_CONTRACT_TOKEN}: report must be an object`);
  }

  const streamName = options.stream === "stdout" ? "stdout" : "stderr";
  const output = `${JSON.stringify(report)}\n`;

  if (streamName === "stdout") {
    process.stdout.write(output);
  } else {
    process.stderr.write(output);
  }

  return report;
}

export function emitCiTokenFailureReport(input, options = {}) {
  const report = createCiTokenReport(input);
  emitCiTokenReport(report, options);
  return report;
}

export function exitWithCiTokenReport(input, options = {}) {
  const report = emitCiTokenFailureReport(input, {
    stream: options.stream || (input && Array.isArray(input.failures) && input.failures.length > 0 ? "stderr" : "stdout")
  });

  process.exit(report.failure_count > 0 ? 1 : 0);
}
