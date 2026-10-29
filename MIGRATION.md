# Migration: 1_safe_mutations

`web/prisma/migrations/1_safe_mutations` is applied automatically by the build
(`prisma migrate deploy` in `web/package.json`) on every Vercel deployment,
**including preview deployments** if they share the production `DATABASE_URL`.

## What it changes

Additive only: nothing is dropped or rewritten.

- `Link` gains `revision` (default 1), `deleted` (tombstone time) and `pinHash`.
- New `LinkRevision` table: append-only destination history. Every existing
  link gets a `baseline` row recording its current destination.
- New `OwnerKey` table (owner → bound public key) and `RateLimit` table.
- Triggers refuse `UPDATE`, `DELETE` and `TRUNCATE` on `LinkRevision`, and
  `DELETE` and `TRUNCATE` on `Link`, so codes can never be freed.

## Backward compatibility

- **Existing short links keep redirecting** to the same destination, now with
  `307` and `Cache-Control: no-store` instead of `301`. Browsers that cached an
  old `301` keep using their cached copy until it expires; nothing server-side
  can clear it.
- **Links whose stored destination is not http(s)** (allowed before this change)
  now return `403` instead of redirecting. To find them (read-only):
  ```sql
  SELECT "code", "url" FROM "Link" WHERE "url" !~* '^https?://';
  ```
- **Existing browser owners** keep their links. The first time a browser edits,
  deletes or creates after this deploy, it creates a signing key, and the server
  binds that key to its existing `fp` owner (trust on first use). Covered by
  `web/test/compat.test.ts` and a manual Playwright run.
- **API integrations and the CLI** must sign requests (see `API_INTEGRATION.md`).
  Unsigned create, update and delete now return `401`, and update and delete
  require `revision` (`428` without it). This is a breaking API change.
- **The old deployment during rollout:** if the schema is migrated while the
  previous code is still serving, its hard `DELETE` fails (the trigger refuses
  it, so nothing is lost), and its edits change `url` without a history row or a
  revision bump. Promote the new deployment promptly after migrating.
- **Rollback:** the previous code runs against the migrated schema, except that
  hard deletes fail as described above.

## Plaintext PINs

PINs set before this change are stored in plaintext in `Link.pin`. Current code
never writes that column. A legacy PIN is verified in constant time and replaced
by its scrypt hash the first time it is used. To hash all of them at once:

```sh
cd web
DATABASE_URL=... npx tsx scripts/hash-legacy-pins.ts           # dry run: count only
DATABASE_URL=... npx tsx scripts/hash-legacy-pins.ts --apply   # hash and clear
```

Once the dry run reports 0, a follow-up migration can drop `Link.pin`.

## Known limits

- Trust on first use: until an existing owner makes a signed request, anyone who
  knows that owner's old fingerprint could bind their own key first. This is no
  worse than before, when the fingerprint alone granted full control, and it
  closes permanently once the owner binds a key.
- `GET /api/my-links` still lists links by `X-Fingerprint` without a signature.
  It is read-only, but it reveals an owner's links to anyone who has the
  fingerprint.
- Rate limits use fixed windows, so up to twice the limit can pass across a
  window boundary.
- `web/lib/kv.ts`, `web/lib/sync.ts` and `web/lib/browser-db.ts` are unused
  legacy code and were left unchanged.
