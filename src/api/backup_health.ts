// DEV NOTE: Whether the live server's backups are working
// (docker-compose.prod.yml). The backup and offsite services write how their
// last runs went to a shared status folder (deploy/backup.sh,
// deploy/offsite.sh: backup_last_ok, backup_last_failed, offsite_state,
// offsite_encrypted, offsite_last_ok, offsite_last_failed - one value per
// file); the app
// reads it, shows it on the admin console, and emails the admin
// (KOLOSSEUM_SUPPORT_ALERT_EMAIL_TO) when backups stop - once a day while
// it lasts, and once when it's fixed. Without KOLOSSEUM_BACKUP_STATUS_DIR
// (local development) there's nothing to check and nothing is sent.
import fs from "node:fs";
import path from "node:path";

export type BackupStatus = {
  backup_last_ok: string | null;
  backup_last_failed: string | null;
  offsite_state: "on" | "off" | null;
  // Whether the off-server copies are encrypted before they leave the server.
  offsite_encrypted: "on" | "off" | null;
  offsite_last_ok: string | null;
  offsite_last_failed: string | null;
};

export type BackupHealth = BackupStatus & { checked: boolean; healthy: boolean; problems: string[] };

// A nightly backup is late after this long; the hourly off-server copy waits
// for a backup to be 10 minutes old, so it's late after a few missed hours.
export const BACKUP_MAX_AGE_HOURS = 26;
export const OFFSITE_MAX_AGE_HOURS = 3;
const ALERT_REPEAT_MS = 24 * 3600 * 1000;
const CHECK_INTERVAL_MS = 3600 * 1000;

function readTime(dir: string, name: string): string | null {
  try {
    const value = fs.readFileSync(path.join(dir, name), "utf8").trim();
    return Number.isNaN(Date.parse(value)) ? null : new Date(value).toISOString();
  }
  catch {
    return null;
  }
}

function readOnOff(dir: string, name: string): "on" | "off" | null {
  try {
    const value = fs.readFileSync(path.join(dir, name), "utf8").trim();
    return value === "on" || value === "off" ? value : null;
  }
  catch {
    return null; // not written yet
  }
}

export function readBackupStatus(dir: string | undefined = process.env.KOLOSSEUM_BACKUP_STATUS_DIR): BackupStatus | null {
  if (!dir || !fs.existsSync(dir)) return null;
  return {
    backup_last_ok: readTime(dir, "backup_last_ok"),
    backup_last_failed: readTime(dir, "backup_last_failed"),
    offsite_state: readOnOff(dir, "offsite_state"),
    offsite_encrypted: readOnOff(dir, "offsite_encrypted"),
    offsite_last_ok: readTime(dir, "offsite_last_ok"),
    offsite_last_failed: readTime(dir, "offsite_last_failed")
  };
}

const hoursSince = (iso: string, now: Date) => (now.getTime() - Date.parse(iso)) / 3600_000;

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
}

// What's wrong, in words the admin can act on.
export function assessBackupHealth(status: BackupStatus | null, now: Date = new Date()): BackupHealth {
  if (!status) {
    return { backup_last_ok: null, backup_last_failed: null, offsite_state: null, offsite_encrypted: null, offsite_last_ok: null, offsite_last_failed: null, checked: false, healthy: true, problems: [] };
  }
  const problems: string[] = [];
  if (!status.backup_last_ok || hoursSince(status.backup_last_ok, now) > BACKUP_MAX_AGE_HOURS) {
    const last = status.backup_last_ok ? `The last one finished ${when(status.backup_last_ok)}` : "None has finished since this check started";
    const failed = status.backup_last_failed ? `; the last attempt failed ${when(status.backup_last_failed)}` : "";
    problems.push(`No database backup in the last ${BACKUP_MAX_AGE_HOURS} hours. ${last}${failed}.`);
  }
  if (status.offsite_state === "off") {
    problems.push("Backups aren't being copied off the server - the OFFSITE_BACKUP_* settings are missing from .env.");
  }
  else if (status.offsite_state === "on" && (!status.offsite_last_ok || hoursSince(status.offsite_last_ok, now) > OFFSITE_MAX_AGE_HOURS)) {
    const last = status.offsite_last_ok ? `The last copy worked ${when(status.offsite_last_ok)}` : "No copy has worked yet";
    const failed = status.offsite_last_failed ? `; the last attempt failed ${when(status.offsite_last_failed)}` : "";
    problems.push(`Backups haven't been copied off the server in the last ${OFFSITE_MAX_AGE_HOURS} hours. ${last}${failed}.`);
  }
  if (status.offsite_state === "on" && status.offsite_encrypted === "off") {
    problems.push("Backups copied off the server aren't encrypted - set OFFSITE_BACKUP_PASSPHRASE in .env (docs/ops/IONOS_VPS_DEPLOYMENT.md).");
  }
  return { ...status, checked: true, healthy: problems.length === 0, problems };
}

export type AlertState = { problemsKey: string | null; sentAt: number | null };

// Whether to email: a new or changed problem straight away, the same one
// again after a day, and once when everything is fine again.
export function alertToSend(health: BackupHealth, state: AlertState, nowMs: number): "problem" | "recovered" | null {
  if (!health.checked) return null;
  if (health.healthy) return state.problemsKey ? "recovered" : null;
  const key = health.problems.map((p) => p.split(".")[0]).join("|");
  if (key !== state.problemsKey || state.sentAt === null || nowMs - state.sentAt >= ALERT_REPEAT_MS) return "problem";
  return null;
}

async function sendAlert(subject: string, lines: string[]): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.KOLOSSEUM_SUPPORT_ALERT_EMAIL_TO;
  const from = process.env.KOLOSSEUM_SUPPORT_ALERT_EMAIL_FROM || process.env.KOLOSSEUM_EMAIL_FROM;
  if (!apiKey || !to || !from) return false;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text: lines.join("\n") }),
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) {
      // eslint-disable-next-line no-console
      console.error(`WARN: backup alert email failed (status ${response.status})`);
    }
    return response.ok;
  }
  catch (error) {
    // eslint-disable-next-line no-console
    console.error("WARN: backup alert email failed to send", error instanceof Error ? error.message : error);
    return false;
  }
}

const alertState: AlertState = { problemsKey: null, sentAt: null };

export async function runBackupHealthCheck(now: Date = new Date()): Promise<BackupHealth> {
  const health = assessBackupHealth(readBackupStatus(), now);
  const send = alertToSend(health, alertState, now.getTime());
  if (send === "problem") {
    const sent = await sendAlert("Kolosseum backups need attention", [
      ...health.problems,
      "",
      "Check on the server: docker compose -f docker-compose.prod.yml logs --tail 20 backup offsite",
      "(docs/ops/IONOS_VPS_DEPLOYMENT.md, Backups). You'll get this once a day until it's fixed."
    ]);
    if (sent) Object.assign(alertState, { problemsKey: health.problems.map((p) => p.split(".")[0]).join("|"), sentAt: now.getTime() });
  }
  else if (send === "recovered") {
    if (await sendAlert("Kolosseum backups are working again", ["Backups are running and being copied off the server again."])) {
      Object.assign(alertState, { problemsKey: null, sentAt: null });
    }
  }
  return health;
}

let timer: NodeJS.Timeout | null = null;

// Hourly, starting a quarter of an hour after start-up so a deploy's own
// backup and copy have run first. Nothing to do without a status folder.
export function startBackupHealthChecks(): void {
  if (timer || !process.env.KOLOSSEUM_BACKUP_STATUS_DIR) return;
  const tick = () => { runBackupHealthCheck().catch(() => undefined); };
  setTimeout(tick, 15 * 60 * 1000).unref?.();
  timer = setInterval(tick, CHECK_INTERVAL_MS);
  timer.unref?.();
}
