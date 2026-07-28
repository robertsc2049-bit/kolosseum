// DEV NOTE: Temporary FULL-UI-02C branch-local application runner.
// The workflow deletes this file and its payload parts before the slice commit.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { gunzipSync } from "node:zlib";

const parts = [
  [
    "scripts/.full_ui_02c_payload/part01.txt",
    "843d316f8778f0b5fc212ae93947dd709a36e8e6db2353d9ddfeafc59170be9d"
  ],
  [
    "scripts/.full_ui_02c_payload/part02.txt",
    "cde328f2c9f7c66fa532690cf335257766efe6693c7fef295643168f872ff16b"
  ],
  [
    "scripts/.full_ui_02c_payload/part03.txt",
    "70aad63e28045b1b4acacfff4b63072f4bbfe4ad35119d720d688d6961fa298a"
  ],
  [
    "scripts/.full_ui_02c_payload/part04.txt",
    "612fbe4d79dca610bb191a3726a6e4c1ad67bd7b5f1d2ea0603bab6aea6ad740"
  ]
];

const fullPayloadSha256 =
  "46613e7c0a511aba2225f1b3fff2171934623259036c2cc0080eb67a649bbbc6";

const decodedScriptSha256 =
  "4642aebaf196e0103a55fb4f4be723c79f6dc5dd6b44ff8102ea0a55fd52bd6d";

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex");
}

const payload = parts
  .map(([filePath, expectedHash]) => {
    const value = fs
      .readFileSync(filePath, "utf8")
      .trim();

    const actualHash = sha256(value);

    if (actualHash !== expectedHash) {
      throw new Error(
        `FULL_UI_02C_PAYLOAD_PART_HASH_MISMATCH: ${filePath}:${actualHash}`
      );
    }

    return value;
  })
  .join("");

const actualPayloadHash = sha256(payload);

if (actualPayloadHash !== fullPayloadSha256) {
  throw new Error(
    `FULL_UI_02C_PAYLOAD_HASH_MISMATCH: ${actualPayloadHash}`
  );
}

const decodedScript = gunzipSync(
  Buffer.from(payload, "base64")
);

const actualDecodedHash = sha256(decodedScript);

if (actualDecodedHash !== decodedScriptSha256) {
  throw new Error(
    `FULL_UI_02C_DECODED_SCRIPT_HASH_MISMATCH: ${actualDecodedHash}`
  );
}

const temporaryScript = path.join(
  process.cwd(),
  `.full-ui-02c-patch-${process.pid}.mjs`
);

try {
  fs.writeFileSync(
    temporaryScript,
    decodedScript
  );

  const result = spawnSync(
    process.execPath,
    [temporaryScript],
    {
      cwd: process.cwd(),
      stdio: "inherit"
    }
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
finally {
  fs.rmSync(
    temporaryScript,
    { force: true }
  );
}
