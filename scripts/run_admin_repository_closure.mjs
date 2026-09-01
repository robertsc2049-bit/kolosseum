// @law: Repository Administrative Closure
// @severity: critical
// @scope: repo

// DEV NOTE: ADMIN-08 final repository administrative acceptance gate.
// This script composes existing owning guards/tests and reconciles live GitHub
// governance/administrative state. It is an acceptance surface only: it does not
// mutate repository settings, close PRs/issues, repair docs, or rewrite registries.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const EVIDENCE_PATH = "ci/evidence/admin_repository_closure.v1.json";
const FINAL_PASS = "REPOSITORY_ADMIN_CLOSURE: PASS";
const FINAL_FAIL = "REPOSITORY_ADMIN_CLOSURE: FAIL";
const CANONICAL_COMMAND = "npm run verify";
const WINDOWS_COMMAND = "npm.cmd run verify";
const VERIFY_SCRIPT = "node ci/scripts/green_fast.mjs";
const RULESET_ID = 11819074;
const ACTIONS_INTEGRATION_ID = 15368;
const REQUIRED_CONTEXTS = Object.freeze([
  "v0-test-suite",
  "runnable-v0",
  "engine-status-guard-pull_request",
  "engine-status-smoke-pull_request",
  "plan-session-api",
  "tier1-smoke-db",
  "comprehensive-test-suite",
  "green-unit",
  "green-integration",
  "ci"
]);
const DOCUMENTED_BYPASS = Object.freeze([
  Object.freeze({ actor_id: 5, actor_type: "RepositoryRole", bypass_mode: "pull_request" })
]);

function read(rel) {
  return fs.readFileSync(path.join(ROOT, ...rel.split("/")), "utf8");
}

function readJson(rel) {
  return JSON.parse(read(rel));
}

function compactOutput(result) {
  const text = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
  return text.length <= 1200 ? text : text.slice(-1200);
}

function runProof(label, file, args = []) {
  const result = spawnSync(file, args, {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 16 * 1024 * 1024
  });
  return {
    label,
    passed: result.status === 0,
    exit_code: result.status,
    output: compactOutput(result)
  };
}

function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableObject(value[key])]));
  }
  return value;
}

function sameJson(a, b) {
  return JSON.stringify(stableObject(a)) === JSON.stringify(stableObject(b));
}

function pushBlocker(blockers, code, detail) {
  blockers.push({ code, detail });
}

function requireEnv(name, blockers) {
  const value = process.env[name]?.trim();
  if (!value) pushBlocker(blockers, "MISSING_ENV", name);
  return value ?? "";
}

async function githubRequest(repo, token, endpoint) {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "kolosseum-admin-08"
    }
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub ${response.status} ${endpoint}: ${body.slice(0, 500)}`);
  }
  return response.json();
}

async function githubPaged(repo, token, endpoint) {
  const out = [];
  for (let page = 1; page <= 20; page += 1) {
    const separator = endpoint.includes("?") ? "&" : "?";
    const rows = await githubRequest(repo, token, `${endpoint}${separator}per_page=100&page=${page}`);
    if (!Array.isArray(rows)) throw new Error(`expected array from ${endpoint}`);
    out.push(...rows);
    if (rows.length < 100) break;
  }
  return out;
}

async function waitForRequiredChecks(repo, token, headSha) {
  let latest = [];
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const payload = await githubRequest(repo, token, `/repos/${repo}/commits/${headSha}/check-runs?per_page=100`);
    latest = Array.isArray(payload.check_runs) ? payload.check_runs : [];
    const selected = new Map();
    for (const run of latest) {
      if (!REQUIRED_CONTEXTS.includes(run.name)) continue;
      const current = selected.get(run.name);
      if (!current || Number(run.id) > Number(current.id)) selected.set(run.name, run);
    }
    const states = REQUIRED_CONTEXTS.map((name) => selected.get(name));
    const hardFailure = states.some((run) => run?.status === "completed" && run.conclusion !== "success");
    const allSuccess = states.every((run) => run?.status === "completed" && run.conclusion === "success");
    if (hardFailure || allSuccess) return { selected, allSuccess };
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  const selected = new Map();
  for (const run of latest) {
    if (!REQUIRED_CONTEXTS.includes(run.name)) continue;
    const current = selected.get(run.name);
    if (!current || Number(run.id) > Number(current.id)) selected.set(run.name, run);
  }
  return {
    selected,
    allSuccess: REQUIRED_CONTEXTS.every((name) => selected.get(name)?.status === "completed" && selected.get(name)?.conclusion === "success")
  };
}

function writeEvidence(evidence) {
  const abs = path.join(ROOT, ...EVIDENCE_PATH.split("/"));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
}

async function main() {
  const blockers = [];
  const headSha = requireEnv("ADMIN_HEAD_SHA", blockers);
  const baseSha = requireEnv("ADMIN_BASE_SHA", blockers);
  const repo = requireEnv("ADMIN_REPOSITORY", blockers);
  const token = requireEnv("GITHUB_TOKEN", blockers);

  const localProofs = [
    runProof("repository_clean", "git", ["status", "--porcelain=v1"]),
    runProof("developer_command_and_portable_paths", "node", ["ci/guards/developer_operating_conventions_guard.mjs"]),
    runProof("readme_validation_contract", "node", ["ci/guards/readme_validation_contract_guard.mjs"]),
    runProof("current_project_docs_currency", "node", ["ci/guards/current_project_docs_currency_guard.mjs"]),
    runProof("no_known_mojibake", "node", ["ci/guards/no_mojibake_guard.mjs"]),
    runProof("product_surface_index_reconciliation", "node", ["--test", "test/admin_04_product_surface_index_reconciliation.test.mjs"]),
    runProof("registry_expected_count_no_drift", "node", ["scripts/materialize_registry_expected_counts.mjs", "--check"]),
    runProof("reg_full_09_acceptance", "node", ["--test", "test/reg_full_09_final_registry_acceptance.test.mjs"]),
    runProof("full_ui_completion_guard", "node", ["ci/guards/full_ui_completion_guard.mjs"]),
    runProof("full_ui_25_final_acceptance", "node", ["--test", "test/full_ui_25_final_acceptance_gate.test.mjs"])
  ];

  if (localProofs[0].output !== "") {
    localProofs[0].passed = false;
    pushBlocker(blockers, "REPOSITORY_DIRTY", localProofs[0].output);
  }
  for (const proof of localProofs.slice(1)) {
    if (!proof.passed) pushBlocker(blockers, "LOCAL_PROOF_FAILED", { label: proof.label, output: proof.output });
  }

  const gitHead = runProof("exact_checkout_head", "git", ["rev-parse", "HEAD"]);
  const checkoutHead = gitHead.output.split(/\r?\n/)[0]?.trim() ?? "";
  if (!gitHead.passed || checkoutHead !== headSha) {
    pushBlocker(blockers, "HEAD_SHA_MISMATCH", { expected: headSha, actual: checkoutHead });
  }

  const ancestry = runProof("base_is_ancestor", "git", ["merge-base", "--is-ancestor", baseSha, headSha]);
  if (!ancestry.passed) pushBlocker(blockers, "BASE_NOT_ANCESTOR", { base_sha: baseSha, head_sha: headSha });

  const packageJson = readJson("package.json");
  const readme = read("README.md");
  const commands = read("docs/COMMANDS.md");
  const statusDoc = read("docs/product/CURRENT_PROJECT_DOCS_STATUS.md");
  const surfaceIndex = read("docs/product/V0_SURFACE_INDEX.md");
  const gapReport = read("docs/product/FULL_UI_GAP_REPORT.md");
  const governanceDoc = read("docs/dev/GITHUB_MERGE_ENFORCEMENT.md");
  const manifest = readJson("product/ui/function_manifest.json");
  const regExpected = readJson("registries/registry_expected_counts.json");
  const reg09 = readJson("ci/evidence/reg_full_09_final_registry_acceptance.v1.json");

  const functions = (manifest.product_areas ?? []).flatMap((area) => Array.isArray(area.functions) ? area.functions : []);
  const functionCounts = Object.fromEntries(["implemented", "partial", "missing", "prohibited"].map((state) => [state, functions.filter((fn) => fn.state === state).length]));
  if (functionCounts.partial !== 0 || functionCounts.missing !== 0) {
    pushBlocker(blockers, "FULL_UI_INCOMPLETE", functionCounts);
  }

  const commandConsistency = {
    package_verify_script: packageJson.scripts?.verify ?? null,
    canonical_developer_command_exists: packageJson.scripts?.verify === VERIFY_SCRIPT,
    readme_matches_package_command: readme.includes(CANONICAL_COMMAND) && readme.includes(WINDOWS_COMMAND),
    command_documentation_matches_readme: commands.includes(CANONICAL_COMMAND) && readme.includes(CANONICAL_COMMAND),
    portable_docs_no_developer_specific_repo_path: localProofs.find((proof) => proof.label === "developer_command_and_portable_paths")?.passed === true
  };
  for (const [key, value] of Object.entries(commandConsistency)) {
    if (key !== "package_verify_script" && value !== true) pushBlocker(blockers, "DOCUMENTATION_COMMAND_DRIFT", key);
  }

  const expectedGapLines = [
    `- implemented: ${functionCounts.implemented}`,
    `- partial: ${functionCounts.partial}`,
    `- missing: ${functionCounts.missing}`,
    `- prohibited: ${functionCounts.prohibited}`
  ];
  const docsArchitectureAligned = expectedGapLines.every((line) => gapReport.includes(line) && statusDoc.includes(line))
    && surfaceIndex.includes(`${functionCounts.implemented} implemented, zero partial, zero missing`)
    && localProofs.find((proof) => proof.label === "product_surface_index_reconciliation")?.passed === true
    && localProofs.find((proof) => proof.label === "current_project_docs_currency")?.passed === true;
  if (!docsArchitectureAligned) pushBlocker(blockers, "CURRENT_PROJECT_DOCUMENTATION_DRIFT", { function_counts: functionCounts });

  const registryNoDrift = localProofs.find((proof) => proof.label === "registry_expected_count_no_drift")?.passed === true;
  const regFull09Pass = reg09.status === "PASS"
    && reg09.checks?.registry_expected_count_authority === "PASS"
    && localProofs.find((proof) => proof.label === "reg_full_09_acceptance")?.passed === true;
  if (!registryNoDrift) pushBlocker(blockers, "REGISTRY_EXPECTED_COUNT_DRIFT", regExpected.counts ?? null);
  if (!regFull09Pass) pushBlocker(blockers, "REG_FULL_09_NOT_PASS", { status: reg09.status, checks: reg09.checks });

  let githubGovernance = {
    default_branch: null,
    current_main_sha: null,
    ruleset_id: RULESET_ID,
    ruleset_active: false,
    required_contexts_match: false,
    bypass_policy_documented: false,
    bypass_actor_runtime_observation: "not_read"
  };
  let openObsoletePrCount = null;
  let openObsoleteIssueCount = null;
  let closedFullUiIssueCount = null;
  let ciResults = { all_pass: false, contexts: {} };

  if (repo && token && headSha && baseSha) {
    try {
      const repoInfo = await githubRequest(repo, token, `/repos/${repo}`);
      const mainBranch = await githubRequest(repo, token, `/repos/${repo}/branches/${encodeURIComponent(repoInfo.default_branch)}`);
      const ruleset = await githubRequest(repo, token, `/repos/${repo}/rulesets/${RULESET_ID}`);
      const openPulls = await githubPaged(repo, token, `/repos/${repo}/pulls?state=open`);
      const openIssues = await githubPaged(repo, token, `/repos/${repo}/issues?state=open`);
      const closedIssues = await githubPaged(repo, token, `/repos/${repo}/issues?state=closed`);

      const requiredRule = (ruleset.rules ?? []).find((rule) => rule.type === "required_status_checks");
      const liveContexts = (requiredRule?.parameters?.required_status_checks ?? []).map((entry) => ({ context: entry.context, integration_id: entry.integration_id }));
      const expectedContexts = REQUIRED_CONTEXTS.map((context) => ({ context, integration_id: ACTIONS_INTEGRATION_ID }));
      const liveBypass = ruleset.bypass_actors ?? [];
      const bypassPolicyDocumented = REQUIRED_CONTEXTS.every((context) => governanceDoc.includes(context))
        && governanceDoc.includes('{ "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "pull_request" }');

      githubGovernance = {
        default_branch: repoInfo.default_branch,
        current_main_sha: mainBranch.commit?.sha ?? null,
        ruleset_id: ruleset.id,
        ruleset_active: ruleset.enforcement === "active" && (ruleset.conditions?.ref_name?.include ?? []).includes("~DEFAULT_BRANCH"),
        strict_required_status_checks_policy: requiredRule?.parameters?.strict_required_status_checks_policy === true,
        required_contexts: liveContexts,
        required_contexts_match: sameJson(liveContexts, expectedContexts),
        documented_bypass_policy: DOCUMENTED_BYPASS,
        bypass_actors_returned_by_workflow_token: liveBypass,
        bypass_actor_runtime_observation: liveBypass.length > 0 ? "returned" : "not_exposed_or_empty",
        bypass_policy_documented: bypassPolicyDocumented
      };

      if (repoInfo.default_branch !== "main") pushBlocker(blockers, "DEFAULT_BRANCH_NOT_MAIN", repoInfo.default_branch);
      if (mainBranch.commit?.sha !== baseSha) pushBlocker(blockers, "BASE_SHA_NOT_CURRENT_MAIN", { base_sha: baseSha, current_main_sha: mainBranch.commit?.sha });
      if (!githubGovernance.ruleset_active) pushBlocker(blockers, "DEFAULT_BRANCH_RULESET_NOT_ACTIVE", githubGovernance);
      if (!githubGovernance.strict_required_status_checks_policy) pushBlocker(blockers, "RULESET_NOT_STRICT", githubGovernance);
      if (!githubGovernance.required_contexts_match) pushBlocker(blockers, "RULESET_REQUIRED_CONTEXT_DRIFT", { expected: expectedContexts, actual: liveContexts });
      if (!githubGovernance.bypass_policy_documented) pushBlocker(blockers, "BYPASS_POLICY_DOCUMENTATION_DRIFT", "docs/dev/GITHUB_MERGE_ENFORCEMENT.md");

      const obsoleteRegFullDrafts = openPulls.filter((pr) => pr.draft === true && /REG[-_ ]?FULL/iu.test(pr.title ?? ""));
      openObsoletePrCount = obsoleteRegFullDrafts.length;
      if (openObsoletePrCount !== 0) {
        pushBlocker(blockers, "OPEN_OBSOLETE_REG_FULL_DRAFT_PRS", obsoleteRegFullDrafts.map((pr) => ({ number: pr.number, title: pr.title })));
      }

      const openFullUiIssues = openIssues.filter((issue) => !issue.pull_request && /^FULL-UI-\d+/iu.test(issue.title ?? ""));
      openObsoleteIssueCount = openFullUiIssues.length;
      if (openObsoleteIssueCount !== 0) {
        pushBlocker(blockers, "OPEN_OBSOLETE_FULL_UI_ISSUES", openFullUiIssues.map((issue) => ({ number: issue.number, title: issue.title })));
      }
      closedFullUiIssueCount = closedIssues.filter((issue) => !issue.pull_request && /^FULL-UI-\d+/iu.test(issue.title ?? "")).length;

      const checks = await waitForRequiredChecks(repo, token, headSha);
      const contexts = {};
      for (const name of REQUIRED_CONTEXTS) {
        const run = checks.selected.get(name);
        contexts[name] = run ? {
          id: run.id,
          status: run.status,
          conclusion: run.conclusion,
          details_url: run.details_url,
          head_sha: run.head_sha,
          app_id: run.app?.id ?? null
        } : null;
      }
      ciResults = { all_pass: checks.allSuccess, contexts };
      if (!checks.allSuccess) pushBlocker(blockers, "AUTHORITATIVE_CI_NOT_GREEN_ON_EXACT_HEAD", contexts);
      for (const [name, run] of Object.entries(contexts)) {
        if (run?.head_sha && run.head_sha !== headSha) pushBlocker(blockers, "CI_HEAD_SHA_MISMATCH", { context: name, expected: headSha, actual: run.head_sha });
      }
    } catch (error) {
      pushBlocker(blockers, "GITHUB_ADMIN_RECONCILIATION_FAILED", error?.message ?? String(error));
    }
  }

  const status = blockers.length === 0 ? "PASS" : "FAIL";
  const evidence = {
    evidence_id: "admin_repository_closure",
    schema_version: "1.0.0",
    slice_id: "ADMIN-08",
    generated_from: "exact_pr_head_and_live_github_state",
    head_sha: headSha,
    base_sha: baseSha,
    repository: repo,
    repository_clean: localProofs[0].passed && localProofs[0].output === "",
    ci_results: ciResults,
    documentation_consistency_results: {
      ...commandConsistency,
      current_project_status_matches_current_architecture: docsArchitectureAligned,
      product_surface_index_reconciled: localProofs.find((proof) => proof.label === "product_surface_index_reconciliation")?.passed === true,
      no_known_mojibake: localProofs.find((proof) => proof.label === "no_known_mojibake")?.passed === true,
      function_manifest_counts: functionCounts
    },
    github_governance_results: githubGovernance,
    open_obsolete_pr_count: openObsoletePrCount,
    open_obsolete_issue_count: openObsoleteIssueCount,
    closed_full_ui_issue_count: closedFullUiIssueCount,
    registry_closure_status: {
      expected_count_authority: registryNoDrift ? "PASS" : "FAIL",
      reg_full_09: regFull09Pass ? "PASS" : "FAIL",
      reg_full_09_status: reg09.status,
      accepted_counts: regExpected.counts
    },
    local_proofs: Object.fromEntries(localProofs.map((proof) => [proof.label, { passed: proof.passed, exit_code: proof.exit_code }])),
    blockers,
    final_status: status,
    final_statement: status === "PASS" ? FINAL_PASS : FINAL_FAIL
  };

  writeEvidence(evidence);

  if (status === "FAIL") {
    console.error(JSON.stringify({ blockers }, null, 2));
    console.log(FINAL_FAIL);
    process.exit(1);
  }

  console.log(FINAL_PASS);
}

main().catch((error) => {
  const headSha = process.env.ADMIN_HEAD_SHA?.trim() ?? "";
  const baseSha = process.env.ADMIN_BASE_SHA?.trim() ?? "";
  const repo = process.env.ADMIN_REPOSITORY?.trim() ?? "";
  const evidence = {
    evidence_id: "admin_repository_closure",
    schema_version: "1.0.0",
    slice_id: "ADMIN-08",
    head_sha: headSha,
    base_sha: baseSha,
    repository: repo,
    blockers: [{ code: "UNCAUGHT_ADMIN_08_ERROR", detail: error?.stack ?? error?.message ?? String(error) }],
    final_status: "FAIL",
    final_statement: FINAL_FAIL
  };
  try { writeEvidence(evidence); } catch {}
  console.error(error?.stack ?? error?.message ?? String(error));
  console.log(FINAL_FAIL);
  process.exit(1);
});
