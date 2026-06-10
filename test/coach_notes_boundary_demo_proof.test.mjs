import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function readText(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), "utf8");
}

function readJson(relPath) {
  return JSON.parse(readText(relPath));
}

const docPath = "docs/commercial/V0_COACH_NOTES_BOUNDARY_DEMO_PROOF.md";
const registryPath = "docs/commercial/V0_COACH_NOTES_BOUNDARY_DEMO_PROOF_REGISTRY.json";

const EXPECTED_EXAMPLE_IDS = [
  "note_example_01_context_only",
  "note_example_02_intent_only",
  "note_example_03_followup_only",
];

const EXPECTED_SURFACES = ["coach.notes.boundary.read", "coach.notes.non_binding"].sort();

const EXPECTED_EXAMPLES = {
  note_example_01_context_only: {
    demo_note_text: "Athlete reported knee irritation after prior session; coach note records context only.",
    allowed_demo_line: "This note records context for the coach view and does not change engine legality or execution authority.",
  },
  note_example_02_intent_only: {
    demo_note_text: "Coach would prefer tempo emphasis next time; note expresses intent only.",
    allowed_demo_line: "This note shows coach intent only and does not override assignment, execution flow, or engine decisions.",
  },
  note_example_03_followup_only: {
    demo_note_text: "Coach wants to revisit warm-up clarity on the next review; note flags follow-up only.",
    allowed_demo_line: "This note flags follow-up only and does not change athlete execution or create automatic follow-up handling.",
  },
};

const BANNED_TERMS = [
  "override",
  "force",
  "enforce",
  "control",
  "instructs the engine",
  "changes legality",
  "changes execution authority",
  "auto-adjusts",
  "automatic correction",
  "compliance enforcement",
  "mandatory athlete action",
];

function extractSections(text) {
  const sections = new Map();
  const matches = [...text.matchAll(/^###\s+([a-z0-9_]+)\n([\s\S]*?)(?=^###\s+|^##\s+|\Z)/gm)];
  for (const match of matches) {
    sections.set(match[1], match[2].trim());
  }
  return sections;
}

test("coach notes boundary demo proof registry is pinned exactly", () => {
  const registry = readJson(registryPath);
  assert.equal(registry.schema_version, "kolosseum.v0.coach_notes_boundary_demo_proof.v1.0.0");
  assert.deepEqual(registry.required_example_ids, EXPECTED_EXAMPLE_IDS);
  const exampleIds = registry.note_examples.map((example) => example.example_id);
  assert.deepEqual(exampleIds, EXPECTED_EXAMPLE_IDS);
  assert.deepEqual(registry.banned_authority_terms, BANNED_TERMS);
});

test("demo note examples are pinned and reference tested surfaces only", () => {
  const registry = readJson(registryPath);
  for (const example of registry.note_examples) {
    const expected = EXPECTED_EXAMPLES[example.example_id];
    assert.ok(expected, `unexpected example id: ${example.example_id}`);
    assert.equal(example.demo_note_text, expected.demo_note_text);
    assert.equal(example.allowed_demo_line, expected.allowed_demo_line);
    assert.deepEqual([...example.surface_ids].sort(), EXPECTED_SURFACES);
    assert.ok(example.doc_surfaces.length > 0, `missing doc surfaces for ${example.example_id}`);
    assert.ok(example.proof_ids.length > 0, `missing proof ids for ${example.example_id}`);
    for (const relPath of [...example.doc_surfaces, ...example.proof_ids]) {
      assert.equal(fs.existsSync(path.join(repoRoot, relPath)), true, `missing proof/doc surface: ${relPath}`);
    }
  }
});

test("banned authority language fails inside allowed demo lines", () => {
  const registry = readJson(registryPath);
  for (const example of registry.note_examples) {
    const value = example.allowed_demo_line.toLowerCase();
    for (const term of registry.banned_authority_terms) {
      if (term === "override" && value.includes("does not override")) {
        continue;
      }
      assert.equal(value.includes(term.toLowerCase()), false, `banned authority language in ${example.example_id}: ${term}`);
    }
  }
});

test("notes boundary markdown contains exactly the pinned example sections", () => {
  const text = readText(docPath);
  const headings = [...text.matchAll(/^###\s+([a-z0-9_]+)$/gm)].map((match) => match[1]);
  assert.deepEqual(headings, EXPECTED_EXAMPLE_IDS);
});

test("notes boundary markdown renders demo note text, allowed line, surfaces, and proof ids for every example", () => {
  const text = readText(docPath);
  const sections = extractSections(text);
  const registry = readJson(registryPath);
  for (const example of registry.note_examples) {
    const section = sections.get(example.example_id);
    assert.ok(section, `missing markdown section for ${example.example_id}`);
    assert.equal(section.includes(example.demo_note_text), true, `missing demo note text for ${example.example_id}`);
    assert.equal(section.includes(example.allowed_demo_line), true, `missing allowed demo line for ${example.example_id}`);
    for (const surfaceId of example.surface_ids) {
      assert.equal(section.includes(surfaceId), true, `missing surface id ${surfaceId} for ${example.example_id}`);
    }
    for (const relPath of example.doc_surfaces) {
      assert.equal(section.includes(relPath), true, `missing doc surface ${relPath} for ${example.example_id}`);
    }
    for (const proofId of example.proof_ids) {
      assert.equal(section.includes(proofId), true, `missing proof id ${proofId} for ${example.example_id}`);
    }
  }
});