#!/usr/bin/env bash
# Database step of every deploy (run by `npm run build`, so Vercel runs it before
# `next build`). Safe to run repeatedly.
#
#   1. Applies pending migrations — short_url's own and inline-demo's tables — to the
#      database named by DATABASE_URL.
#   2. Generates the Prisma client.
#   3. Imports inline-demo data from INLINE_DEMO_IMPORT, if set (insert-only; see
#      scripts/import-inline-demo.ts).
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set. Point it at the short_url Postgres database and re-run." >&2
  exit 1
fi

echo "==> prisma migrate deploy"
npx prisma migrate deploy

echo "==> prisma generate"
npx prisma generate

echo "==> inline-demo import"
npx tsx scripts/import-inline-demo.ts
