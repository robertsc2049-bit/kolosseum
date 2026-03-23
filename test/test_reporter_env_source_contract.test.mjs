import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const moduleUrl = pathToFileURL(
  path.join(process.cwd(), "ci", "scripts", "test_reporter_env.mjs")
).href;

function resetEnv(snapshot) {
  delete process.env.KOLOSSEUM_TEST_REPORTER;
  delete process.env.KOLOSSEUM_TEST_REPORTER_DISABLE;
  delete process.env.NODE_OPTIONS;

  for (const [key, value] of Object.entries(snapshot)) {
    if (typeof value === "string") {
      process.env[key] = value;
    }
  }
}

test("test reporter env helper defaults repo-owned node tests to dot reporter", async () => {
  const snapshot = {
    KOLOSSEUM_TEST_REPORTER: process.env.KOLOSSEUM_TEST_REPORTER,
    KOLOSSEUM_TEST_REPORTER_DISABLE: process.env.KOLOSSEUM_TEST_REPORTER_DISABLE,
    NODE_OPTIONS: process.env.NODE_OPTIONS
  };

  try {
    delete process.env.KOLOSSEUM_TEST_REPORTER;
    delete process.env.KOLOSSEUM_TEST_REPORTER_DISABLE;
    delete process.env.NODE_OPTIONS;

    const { applyDefaultNodeTestReporterEnv } = await import(`${moduleUrl}?t=default`);
    const reporter = applyDefaultNodeTestReporterEnv();

    assert.equal(reporter, "dot");
    assert.match(process.env.NODE_OPTIONS ?? "", /--test-reporter=dot/);
  } finally {
    resetEnv(snapshot);
  }
});

test("test reporter env helper respects explicit reporter override", async () => {
  const snapshot = {
    KOLOSSEUM_TEST_REPORTER: process.env.KOLOSSEUM_TEST_REPORTER,
    KOLOSSEUM_TEST_REPORTER_DISABLE: process.env.KOLOSSEUM_TEST_REPORTER_DISABLE,
    NODE_OPTIONS: process.env.NODE_OPTIONS
  };

  try {
    process.env.KOLOSSEUM_TEST_REPORTER = "tap";
    delete process.env.KOLOSSEUM_TEST_REPORTER_DISABLE;
    delete process.env.NODE_OPTIONS;

    const { applyDefaultNodeTestReporterEnv } = await import(`${moduleUrl}?t=override`);
    const reporter = applyDefaultNodeTestReporterEnv();

    assert.equal(reporter, "tap");
    assert.match(process.env.NODE_OPTIONS ?? "", /--test-reporter=tap/);
  } finally {
    resetEnv(snapshot);
  }
});

test("test reporter env helper does not overwrite an existing explicit test reporter", async () => {
  const snapshot = {
    KOLOSSEUM_TEST_REPORTER: process.env.KOLOSSEUM_TEST_REPORTER,
    KOLOSSEUM_TEST_REPORTER_DISABLE: process.env.KOLOSSEUM_TEST_REPORTER_DISABLE,
    NODE_OPTIONS: process.env.NODE_OPTIONS
  };

  try {
    delete process.env.KOLOSSEUM_TEST_REPORTER;
    delete process.env.KOLOSSEUM_TEST_REPORTER_DISABLE;
    process.env.NODE_OPTIONS = "--max-old-space-size=4096 --test-reporter=spec";

    const { applyDefaultNodeTestReporterEnv } = await import(`${moduleUrl}?t=existing`);
    const reporter = applyDefaultNodeTestReporterEnv();

    assert.equal(reporter, "dot");
    assert.equal(process.env.NODE_OPTIONS, "--max-old-space-size=4096 --test-reporter=spec");
  } finally {
    resetEnv(snapshot);
  }
});

test("test reporter env helper can be disabled", async () => {
  const snapshot = {
    KOLOSSEUM_TEST_REPORTER: process.env.KOLOSSEUM_TEST_REPORTER,
    KOLOSSEUM_TEST_REPORTER_DISABLE: process.env.KOLOSSEUM_TEST_REPORTER_DISABLE,
    NODE_OPTIONS: process.env.NODE_OPTIONS
  };

  try {
    delete process.env.KOLOSSEUM_TEST_REPORTER;
    process.env.KOLOSSEUM_TEST_REPORTER_DISABLE = "1";
    delete process.env.NODE_OPTIONS;

    const { applyDefaultNodeTestReporterEnv } = await import(`${moduleUrl}?t=disable`);
    const reporter = applyDefaultNodeTestReporterEnv();

    assert.equal(reporter, null);
    assert.equal(process.env.NODE_OPTIONS, undefined);
  } finally {
    resetEnv(snapshot);
  }
});
