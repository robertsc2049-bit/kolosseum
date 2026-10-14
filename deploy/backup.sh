#!/bin/sh
# Nightly backup (the "backup" service in docker-compose.prod.yml): a
# pg_dump of the database plus a tarball of uploaded files, kept for
# BACKUP_KEEP_DAYS days in the kolosseum-backups volume. These sit on the
# same server - copy them off it too (docs/ops/IONOS_VPS_DEPLOYMENT.md).
set -eu
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
mkdir -p /backups

run_backup() {
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  pg_dump --format=custom --file="/backups/db_${stamp}.dump" "$DATABASE_URL"
  tar -czf "/backups/uploads_${stamp}.tar.gz" -C /uploads .
  find /backups -type f -mtime +"$KEEP_DAYS" -delete
  echo "backup ${stamp} done: $(ls /backups | wc -l) files kept"
}

if [ "${1:-}" = "once" ]; then
  run_backup
  exit 0
fi

while true; do
  run_backup || echo "backup failed - will retry next cycle" >&2
  sleep 86400
done
