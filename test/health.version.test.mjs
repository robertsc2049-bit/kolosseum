import assert from "node:assert/strict";
import { VERSION } from "../dist/src/version.js";

test("health exposes version", async () => {
  const res = await fetch("http://127.0.0.1:3000/health");
  assert.equal(res.status, 200);

  const json = await res.json();
  assert.equal(json.version, VERSION);
});
