#!/bin/sh
# Proves the newest backup can be restored (run in the "backup" service):
# restores db_*.dump into a throwaway database next to the live one,
# compares row counts in the tables that matter most with the live
# database, checks the uploads tarball opens, then drops the throwaway copy.
# The live database is only read.
#
#   docker compose -f docker-compose.prod.yml exec backup sh /restore-check.sh
set -eu
BACKUP_DIR="${BACKUP_DIR:-/backups}"
CHECK_DB="kolosseum_restore_check"
export PGOPTIONS="-c client_min_messages=warning"
TABLES="product_accounts beta_product_records product_service_packages product_package_memberships product_package_payments product_coach_tax_details product_notifications"

dump="$(ls -1t "$BACKUP_DIR"/db_*.dump 2>/dev/null | head -n 1 || true)"
if [ -z "$dump" ]; then
  echo "no db_*.dump in $BACKUP_DIR - take one first: sh /backup.sh once" >&2
  exit 1
fi
# DATABASE_URL ends in /<database>; the throwaway copy sits beside it.
base_url="${DATABASE_URL%/*}"
admin_url="$base_url/postgres"
check_url="$base_url/$CHECK_DB"

cleanup() { psql "$admin_url" -qc "DROP DATABASE IF EXISTS $CHECK_DB" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "restoring $(basename "$dump") into $CHECK_DB"
psql "$admin_url" -qc "DROP DATABASE IF EXISTS $CHECK_DB"
psql "$admin_url" -qc "CREATE DATABASE $CHECK_DB"
pg_restore --no-owner --exit-on-error -d "$check_url" "$dump"

count() {
  psql "$1" -tAc "SELECT CASE WHEN to_regclass('$2') IS NULL THEN 'missing' ELSE (SELECT count(*)::text FROM $2) END"
}
printf '%-32s %10s %10s\n' "table" "backup" "live now"
missing=0
for table in $TABLES; do
  restored="$(count "$check_url" "$table")"
  live="$(count "$DATABASE_URL" "$table")"
  [ "$restored" = "missing" ] && missing=1
  printf '%-32s %10s %10s\n' "$table" "$restored" "$live"
done

uploads="$BACKUP_DIR/$(basename "$dump" .dump | sed 's/^db_/uploads_/').tar.gz"
if [ -f "$uploads" ]; then
  echo "uploads: $(tar -tzf "$uploads" | grep -vc '/$') files in $(basename "$uploads")"
else
  echo "uploads: no $(basename "$uploads") next to the dump" >&2
  missing=1
fi

if [ "$missing" -ne 0 ]; then
  echo "RESTORE CHECK FAILED - see above" >&2
  exit 1
fi
echo "restore check passed: the backup restores, counts above (the live database may have moved on since it was taken)"
