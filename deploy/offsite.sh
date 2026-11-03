#!/bin/sh
# Off-server copies of the nightly backups (the "offsite" service in
# docker-compose.prod.yml): every hour, any new db_*.dump and
# uploads_*.tar.gz in the kolosseum-backups volume is copied to S3-compatible
# object storage - IONOS S3 Object Storage by default - and copies older than
# BACKUP_KEEP_DAYS days are deleted there. Off until OFFSITE_BACKUP_BUCKET and
# the access key are set in .env (docs/ops/IONOS_VPS_DEPLOYMENT.md).
#
#   sh /offsite.sh once   copy now
#   sh /offsite.sh list   what's stored off the server
set -eu
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
REMOTE="offsite:${OFFSITE_BACKUP_BUCKET:-}/kolosseum"

configured() {
  [ -n "${OFFSITE_BACKUP_BUCKET:-}" ] && [ -n "${RCLONE_CONFIG_OFFSITE_ACCESS_KEY_ID:-}" ] && [ -n "${RCLONE_CONFIG_OFFSITE_SECRET_ACCESS_KEY:-}" ]
}

copy_offsite() {
  # Files still being written (a dump in progress) wait for the next run.
  rclone copy "$BACKUP_DIR" "$REMOTE" --include "db_*.dump" --include "uploads_*.tar.gz" --min-age 10m
  rclone delete "$REMOTE" --min-age "${KEEP_DAYS}d"
  echo "offsite copy done $(date -u +%Y%m%dT%H%M%SZ): $(rclone lsf "$REMOTE" | wc -l) files stored off the server"
}

if ! configured; then
  echo "off-server backups are off - set OFFSITE_BACKUP_BUCKET, OFFSITE_BACKUP_ACCESS_KEY and OFFSITE_BACKUP_SECRET_KEY in .env" >&2
  [ "${1:-}" = "" ] || exit 1
  # Stay up quietly so the stack's status stays clean.
  while true; do sleep 86400; done
fi

case "${1:-}" in
  once) copy_offsite; exit 0 ;;
  list) rclone lsl "$REMOTE"; exit 0 ;;
esac

while true; do
  copy_offsite || echo "offsite copy failed - will retry next hour" >&2
  sleep 3600
done
