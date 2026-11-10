#!/usr/bin/env bash
set -euo pipefail

SQLCMD=/opt/mssql-tools/bin/sqlcmd
DB_NAME="${DB_NAME:-TREPortal}"
SQL_ARGS=(-S db -U sa -P "$SA_PASSWORD" -b)

"$SQLCMD" "${SQL_ARGS[@]}" -Q "IF DB_ID(N'$DB_NAME') IS NULL CREATE DATABASE [$DB_NAME];"

shopt -s nullglob
for f in /scripts/schema/*.sql /scripts/migrations/*.sql; do
    echo "Applying $f"
    "$SQLCMD" "${SQL_ARGS[@]}" -d "$DB_NAME" -i "$f"
done
