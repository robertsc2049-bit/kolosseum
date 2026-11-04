// Backup alerts (src/api/backup_health.ts): the backup and offsite services
// write how their last runs went to a status folder; the app reads it and
// emails the admin when backups stop - once a day while it lasts, once when
// fixed - and says nothing where there's no status folder.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { alertToSend, assessBackupHealth, readBackupStatus } from "../dist/src/api/backup_health.js";

const NOW = new Date("2026-11-04T12:00:00Z");
const hoursAgo = (h) => new Date(NOW.getTime() - h * 3600_000).toISOString();
const status = (overrides = {}) => ({
  backup_last_ok: hoursAgo(3), backup_last_failed: null, offsite_state: "on", offsite_last_ok: hoursAgo(1), offsite_last_failed: null, ...overrides
});

test("the status folder is read as the scripts write it, and is optional", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kolosseum-status-"));
  try {
    fs.writeFileSync(path.join(dir, "backup_last_ok"), "2026-11-04T09:01:21Z\n");
    fs.writeFileSync(path.join(dir, "offsite_state"), "on\n");
    fs.writeFileSync(path.join(dir, "offsite_last_failed"), "not a time\n");
    assert.deepEqual(readBackupStatus(dir), {
      backup_last_ok: "2026-11-04T09:01:21.000Z", backup_last_failed: null, offsite_state: "on", offsite_last_ok: null, offsite_last_failed: null
    });
  }
  finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  assert.equal(readBackupStatus(undefined), null, "local development: nothing to check");
  assert.equal(readBackupStatus(path.join(os.tmpdir(), "no-such-kolosseum-status")), null);
  const unchecked = assessBackupHealth(null, NOW);
  assert.deepEqual([unchecked.checked, unchecked.healthy, unchecked.problems], [false, true, []]);
});

test("backups are healthy while the nightly backup and the hourly copy keep up", () => {
  assert.deepEqual(assessBackupHealth(status(), NOW).problems, []);
  assert.deepEqual(assessBackupHealth(status({ backup_last_ok: hoursAgo(25), offsite_last_ok: hoursAgo(2.5) }), NOW).problems, []);
});

test("a late backup, a stalled copy, or copies switched off are each explained", () => {
  const late = assessBackupHealth(status({ backup_last_ok: hoursAgo(30), backup_last_failed: hoursAgo(1) }), NOW);
  assert.equal(late.healthy, false);
  assert.match(late.problems[0], /^No database backup in the last 26 hours\. The last one finished .+; the last attempt failed .+\.$/u);
  assert.match(assessBackupHealth(status({ backup_last_ok: null }), NOW).problems[0], /None has finished since this check started/u);

  const stalled = assessBackupHealth(status({ offsite_last_ok: hoursAgo(5), offsite_last_failed: hoursAgo(0.5) }), NOW);
  assert.deepEqual(stalled.problems.length, 1);
  assert.match(stalled.problems[0], /^Backups haven't been copied off the server in the last 3 hours\. The last copy worked .+; the last attempt failed .+\.$/u);
  assert.match(assessBackupHealth(status({ offsite_last_ok: null }), NOW).problems[0], /No copy has worked yet/u);

  assert.match(assessBackupHealth(status({ offsite_state: "off" }), NOW).problems[0], /OFFSITE_BACKUP_\* settings are missing/u);
  assert.deepEqual(assessBackupHealth(status({ offsite_state: null, offsite_last_ok: null }), NOW).problems, [], "the copy hasn't reported yet");
});

test("the admin is emailed once a day while backups are broken, and once when they're fixed", () => {
  const broken = assessBackupHealth(status({ backup_last_ok: hoursAgo(30) }), NOW);
  const fine = assessBackupHealth(status(), NOW);
  const key = "No database backup in the last 26 hours";
  const t = NOW.getTime();
  assert.equal(alertToSend(fine, { problemsKey: null, sentAt: null }, t), null);
  assert.equal(alertToSend(broken, { problemsKey: null, sentAt: null }, t), "problem");
  assert.equal(alertToSend(broken, { problemsKey: key, sentAt: t - 3600_000 }, t), null, "already told an hour ago");
  assert.equal(alertToSend(broken, { problemsKey: key, sentAt: t - 25 * 3600_000 }, t), "problem", "told again after a day");
  const both = assessBackupHealth(status({ backup_last_ok: hoursAgo(30), offsite_last_ok: hoursAgo(9) }), NOW);
  assert.equal(alertToSend(both, { problemsKey: key, sentAt: t - 3600_000 }, t), "problem", "a new problem straight away");
  assert.equal(alertToSend(fine, { problemsKey: key, sentAt: t - 3600_000 }, t), "recovered");
  assert.equal(alertToSend(assessBackupHealth(null, NOW), { problemsKey: key, sentAt: t }, t), null);
});
