-- Make mutable links safe to mutate.
-- Additive only: no existing column is dropped or rewritten, so links created
-- before this migration keep resolving. The legacy plaintext "pin" column is
-- kept until scripts/hash-legacy-pins.ts has emptied it (see MIGRATION.md).

-- AlterTable
ALTER TABLE "Link" ADD COLUMN     "deleted" INTEGER,
ADD COLUMN     "pinHash" TEXT,
ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "LinkRevision" (
    "code" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "urlBefore" TEXT,
    "urlAfter" TEXT,
    "actor" TEXT NOT NULL,
    "at" INTEGER NOT NULL,

    CONSTRAINT "LinkRevision_pkey" PRIMARY KEY ("code","revision")
);

-- CreateTable
CREATE TABLE "OwnerKey" (
    "owner" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "created" INTEGER NOT NULL,

    CONSTRAINT "OwnerKey_pkey" PRIMARY KEY ("owner")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "window" INTEGER NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key","window")
);

-- AddForeignKey
ALTER TABLE "LinkRevision" ADD CONSTRAINT "LinkRevision_code_fkey" FOREIGN KEY ("code") REFERENCES "Link"("code") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- History starts from each existing link's current destination.
INSERT INTO "LinkRevision" ("code", "revision", "action", "urlBefore", "urlAfter", "actor", "at")
SELECT "code", "revision", 'baseline', NULL, "url", 'migration:1_safe_mutations', COALESCE("updated", "created")
FROM "Link";

-- History is append-only.
CREATE FUNCTION "link_revision_append_only"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'LinkRevision is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "LinkRevision_no_update_or_delete"
BEFORE UPDATE OR DELETE ON "LinkRevision"
FOR EACH ROW EXECUTE FUNCTION "link_revision_append_only"();

CREATE TRIGGER "LinkRevision_no_truncate"
BEFORE TRUNCATE ON "LinkRevision"
FOR EACH STATEMENT EXECUTE FUNCTION "link_revision_append_only"();

-- Codes are never freed: deletion is a tombstone ("deleted" set), not a row delete.
CREATE FUNCTION "link_no_hard_delete"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Link rows are tombstoned, never deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Link_no_delete"
BEFORE DELETE ON "Link"
FOR EACH ROW EXECUTE FUNCTION "link_no_hard_delete"();

CREATE TRIGGER "Link_no_truncate"
BEFORE TRUNCATE ON "Link"
FOR EACH STATEMENT EXECUTE FUNCTION "link_no_hard_delete"();
