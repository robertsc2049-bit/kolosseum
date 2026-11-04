#!/bin/sh
# Nightly backup (the "backup" service in docker-compose.prod.yml): a
# pg_dump of the database plus a tarball of uploaded files, kept for
# BACKUP_KEEP_DAYS days in the kolosseum-backups volume. The offsite service
# copies them off the server (docs/ops/IONOS_VPS_DEPLOYMENT.md).
#
# Each file is written under a .partial_ name and only renamed into place
# once it's complete and not empty, so a failed run (e.g. the database still
# starting) leaves nothing behind for the restore check or the off-server
# copy to pick up - it says it failed and the next run tries again. How each
# run went is written to STATUS_DIR (backup_last_ok, backup_last_failed),
# which the app reads to email the admin when backups stop (backup_health.ts).
set -eu
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
UPLOADS_DIR="${UPLOADS_DIR:-/uploads}"
STATUS_DIR="${STATUS_DIR:-/status}"
mkdir -p "$BACKUP_DIR"

# Record how things went for the app; never fails the run.
status() {
  { [ -d "$STATUS_DIR" ] && printf '%s\n' "$2" > "$STATUS_DIR/$1"; } 2>/dev/null || true
}

failed() {
  status backup_last_failed "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "backup $1 FAILED: $2" >&2
  return 1
}

run_backup() {
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  dump="$BACKUP_DIR/db_${stamp}.dump"
  uploads="$BACKUP_DIR/uploads_${stamp}.tar.gz"
  rm -f "$BACKUP_DIR"/.partial_*
  if ! pg_dump --format=custom --file="$BACKUP_DIR/.partial_db_${stamp}.dump" "$DATABASE_URL" || [ ! -s "$BACKUP_DIR/.partial_db_${stamp}.dump" ]; then
    rm -f "$BACKUP_DIR/.partial_db_${stamp}.dump"
    failed "$stamp" "the database dump didn't complete"
    return 1
  fi
  if ! tar -czf "$BACKUP_DIR/.partial_uploads_${stamp}.tar.gz" -C "$UPLOADS_DIR" .; then
    rm -f "$BACKUP_DIR/.partial_db_${stamp}.dump" "$BACKUP_DIR/.partial_uploads_${stamp}.tar.gz"
    failed "$stamp" "the uploads archive didn't complete"
    return 1
  fi
  # (set -e doesn't apply inside a function called from if, so each step says so.)
  mv "$BACKUP_DIR/.partial_db_${stamp}.dump" "$dump" || { failed "$stamp" "couldn't save the dump"; return 1; }
  mv "$BACKUP_DIR/.partial_uploads_${stamp}.tar.gz" "$uploads" || { failed "$stamp" "couldn't save the uploads archive"; return 1; }
  find "$BACKUP_DIR" -type f -mtime +"$KEEP_DAYS" -delete || true
  status backup_last_ok "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "backup ${stamp} done: $(ls "$BACKUP_DIR" | wc -l) files kept"
}

if [ "${1:-}" = "once" ]; then
  run_backup
  exit $?
fi

while true; do
  if run_backup; then
    sleep 86400
  else
    echo "backup failed - trying again in 10 minutes" >&2
    sleep 600
  fi
done
