#!/bin/sh
# Off-server copies of the nightly backups (the "offsite" service in
# docker-compose.prod.yml): every hour, any new db_*.dump and
# uploads_*.tar.gz in the kolosseum-backups volume is copied to S3-compatible
# object storage - IONOS S3 Object Storage by default - and copies older than
# BACKUP_KEEP_DAYS days are deleted there. Off until OFFSITE_BACKUP_BUCKET and
# the access key are set in .env (docs/ops/IONOS_VPS_DEPLOYMENT.md).
#
# With OFFSITE_BACKUP_PASSPHRASE set, each file is encrypted here, before it
# leaves the server (rclone crypt: contents and file names), into
# kolosseum-encrypted/ in the bucket; the storage provider only ever holds
# ciphertext. Copies made before encryption was turned on (kolosseum/) age out
# after BACKUP_KEEP_DAYS days like any other. Without the passphrase the
# encrypted copies can't be read by anyone - keep it in a password manager,
# not only on the server.
#
# How each run went is written to STATUS_DIR (offsite_state on/off,
# offsite_encrypted on/off, offsite_last_ok, offsite_last_failed), which the
# app reads to email the admin when copies stop (backup_health.ts).
#
#   sh /offsite.sh once         copy now
#   sh /offsite.sh list         what's stored off the server
#   sh /offsite.sh fetch DIR    copy everything back into DIR (decrypted)
set -eu
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
STATUS_DIR="${STATUS_DIR:-/status}"
PLAIN="offsite:${OFFSITE_BACKUP_BUCKET:-}/kolosseum"
REMOTE="$PLAIN"
MIN_PASSPHRASE=20

configured() {
  [ -n "${OFFSITE_BACKUP_BUCKET:-}" ] && [ -n "${RCLONE_CONFIG_OFFSITE_ACCESS_KEY_ID:-}" ] && [ -n "${RCLONE_CONFIG_OFFSITE_SECRET_ACCESS_KEY:-}" ]
}

# Record how things went for the app; never fails the run.
status() {
  { [ -d "$STATUS_DIR" ] && printf '%s\n' "$2" > "$STATUS_DIR/$1"; } 2>/dev/null || true
}

now() { date -u +%Y-%m-%dT%H:%M:%SZ; }

# Each step stops the run on failure (set -e doesn't apply inside a function
# called with ||, so it's spelled out).
copy_offsite() {
  # Files still being written (a dump in progress) wait for the next run.
  rclone copy "$BACKUP_DIR" "$REMOTE" --include "db_*.dump" --include "uploads_*.tar.gz" --min-age 10m || return 1
  rclone delete "$REMOTE" --min-age "${KEEP_DAYS}d" || return 1
  # Unencrypted copies from before encryption was turned on age out too.
  if [ "$REMOTE" != "$PLAIN" ]; then
    rclone delete "$PLAIN" --min-age "${KEEP_DAYS}d" || return 1
  fi
  stored="$(rclone lsf "$REMOTE")" || return 1
  status offsite_last_ok "$(now)"
  echo "offsite copy done $(now): $(printf '%s\n' "$stored" | grep -c .) files stored off the server"
}

if ! configured; then
  status offsite_state off
  echo "off-server backups are off - set OFFSITE_BACKUP_BUCKET, OFFSITE_BACKUP_ACCESS_KEY and OFFSITE_BACKUP_SECRET_KEY in .env" >&2
  [ "${1:-}" = "" ] || exit 1
  # Stay up quietly so the stack's status stays clean.
  while true; do sleep 86400; done
fi
status offsite_state on

if [ -n "${OFFSITE_BACKUP_PASSPHRASE:-}" ]; then
  if [ "${#OFFSITE_BACKUP_PASSPHRASE}" -lt "$MIN_PASSPHRASE" ]; then
    status offsite_last_failed "$(now)"
    echo "OFFSITE_BACKUP_PASSPHRASE is too short - use at least $MIN_PASSPHRASE characters (a few random words). Nothing was copied." >&2
    exit 1
  fi
  obscured="$(rclone obscure "$OFFSITE_BACKUP_PASSPHRASE")"
  export RCLONE_CONFIG_SECURE_TYPE=crypt
  export RCLONE_CONFIG_SECURE_REMOTE="offsite:${OFFSITE_BACKUP_BUCKET}/kolosseum-encrypted"
  export RCLONE_CONFIG_SECURE_PASSWORD="$obscured"
  REMOTE="secure:"
  status offsite_encrypted on
else
  status offsite_encrypted off
  echo "off-server backups are NOT encrypted - set OFFSITE_BACKUP_PASSPHRASE in .env to encrypt them before they leave the server" >&2
fi

run_once() {
  if copy_offsite; then
    return 0
  fi
  status offsite_last_failed "$(now)"
  echo "offsite copy FAILED $(now) - see the rclone error above" >&2
  return 1
}

case "${1:-}" in
  once) run_once; exit $? ;;
  list) rclone lsl "$REMOTE"; exit 0 ;;
  fetch)
    target="${2:?usage: sh /offsite.sh fetch DIR}"
    rclone copy "$REMOTE" "$target"
    ls -l "$target"
    exit 0 ;;
esac

while true; do
  run_once || echo "offsite copy will retry next hour" >&2
  sleep 3600
done
