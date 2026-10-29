import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';
import { LEGACY } from './fixtures';

/**
 * Builds a fresh test database the way production will be upgraded:
 * apply 0_init, insert rows shaped like existing production data, then let
 * `prisma migrate deploy` apply every later migration on top of them.
 */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error('Set TEST_DATABASE_URL to a disposable Postgres database (see README "Running tests")');
  }
  const target = new URL(url);
  const database = target.pathname.slice(1);
  if (!database.endsWith('_test')) {
    throw new Error(`Refusing to reset "${database}": the test database name must end in _test`);
  }

  const admin = new URL(url);
  admin.pathname = '/postgres';
  const adminClient = new Client({ connectionString: admin.toString() });
  await adminClient.connect();
  await adminClient.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
  await adminClient.query(`CREATE DATABASE "${database}"`);
  await adminClient.end();

  const migrations = path.resolve(__dirname, '../prisma/migrations');
  const db = new Client({ connectionString: url });
  await db.connect();
  await db.query(readFileSync(path.join(migrations, '0_init/migration.sql'), 'utf8'));
  for (const row of LEGACY) {
    await db.query(
      'INSERT INTO "Link" ("code", "url", "clicks", "created", "updated", "owner", "pin") VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [row.code, row.url, row.clicks, row.created, row.updated, row.owner, row.pin]
    );
  }
  await db.end();

  const env = { ...process.env, DATABASE_URL: url };
  const prisma = path.resolve(__dirname, '../node_modules/.bin/prisma');
  execFileSync(prisma, ['migrate', 'resolve', '--applied', '0_init'], { env, stdio: 'pipe' });
  execFileSync(prisma, ['migrate', 'deploy'], { env, stdio: 'pipe' });
}
