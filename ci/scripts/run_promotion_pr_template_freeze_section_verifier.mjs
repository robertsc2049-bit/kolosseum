import fs from "node:fs";
import path from "node:path";

const TOKEN = "CI_PROMOTION_PR_TEMPLATE_FREEZE_SECTION_MISSING";
const REQUIRED_SECTION_HEADER = "## Freeze Confirmation";
const REQUIRED_MARKERS = [
  "- [ ] freeze_state_confirmed",
  "- [ ] active_seal_state_confirmed",
  "- [ ] sealed_surface_manifest_confirmed",
  "- [ ] release_notes_boundary_confirmed",
];

function fail(details, pathValue = undefined) {
  return {
    ok: false,
    failures: [
      {
        token: TOKEN,
        ...(pathValue ? { path: pathValue } : {}),
        details,
      },
    ],
  };
}

function ok(meta = {}) {
  return { ok: true, ...meta };
}

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

function readText(filePath) {
  try {
    return normalizeText(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { __read_error__: `Failed to read template at ${filePath}: ${message}` };
  }
}

function extractSectionBody(text, header) {
  const lines = normalizeText(text).split("\n");
  const startIndex = lines.findIndex((line) => line.trim() === header);

  if (startIndex === -1) {
    return { error: `Promotion PR template is missing required section header '${header}'.` };
  }

  const bodyLines = [];
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.startsWith("## ")) {
      break;
    }
    bodyLines.push(line);
  }

  return { body: bodyLines.join("\n") };
}

function verifyPromotionPrTemplateFreezeSection(templatePath) {
  const textOrError = readText(templatePath);
  if (typeof textOrError !== "string") {
    return fail(textOrError.__read_error__, "promotion_pr_template");
  }

  const extracted = extractSectionBody(textOrError, REQUIRED_SECTION_HEADER);
  if (extracted.error) {
    return fail(extracted.error, "promotion_pr_template.freeze_section");
  }

  const sectionBody = extracted.body;

  for (const marker of REQUIRED_MARKERS) {
    if (!sectionBody.includes(marker)) {
      return fail(
        `Promotion PR template freeze section is missing required marker '${marker}'.`,
        "promotion_pr_template.freeze_section"
      );
    }
  }

  return ok({
    template_path: path.resolve(templatePath),
    required_section_header: REQUIRED_SECTION_HEADER,
    required_markers: REQUIRED_MARKERS,
  });
}

function main() {
  const args = process.argv.slice(2);

  if (args.length !== 1) {
    process.stderr.write(
      JSON.stringify(
        fail(
          "Usage: node ci/scripts/run_promotion_pr_template_freeze_section_verifier.mjs <promotion_pr_template_path>"
        ),
        null,
        2
      ) + "\n"
    );
    process.exit(1);
  }

  const templatePath = path.resolve(args[0]);
  const result = verifyPromotionPrTemplateFreezeSection(templatePath);
  const target = result.ok ? process.stdout : process.stderr;
  target.write(JSON.stringify(result, null, 2) + "\n");
  process.exit(result.ok ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  REQUIRED_MARKERS,
  REQUIRED_SECTION_HEADER,
  verifyPromotionPrTemplateFreezeSection,
};