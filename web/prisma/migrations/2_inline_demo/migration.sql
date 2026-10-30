-- Storage for inline-demo, which keeps no database of its own.
-- Additive only: new tables, nothing existing is touched.

-- CreateTable
CREATE TABLE "InlineDemo" (
    "id" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "src" TEXT NOT NULL,
    "poster" TEXT,
    "caption" TEXT,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "plays" INTEGER NOT NULL DEFAULT 0,
    "created" BIGINT NOT NULL,
    "updated" BIGINT,

    CONSTRAINT "InlineDemo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InlineDemoSlot" (
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "demoId" TEXT NOT NULL,

    CONSTRAINT "InlineDemoSlot_pkey" PRIMARY KEY ("owner","name")
);

-- CreateTable
CREATE TABLE "InlineDemoShortLink" (
    "owner" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "shortUrl" TEXT NOT NULL,

    CONSTRAINT "InlineDemoShortLink_pkey" PRIMARY KEY ("owner")
);

-- CreateTable
CREATE TABLE "InlineDemoAsset" (
    "name" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "bytes" BYTEA NOT NULL,
    "created" BIGINT NOT NULL,

    CONSTRAINT "InlineDemoAsset_pkey" PRIMARY KEY ("name")
);

-- CreateIndex
CREATE INDEX "InlineDemo_owner_created_idx" ON "InlineDemo"("owner", "created");

-- CreateIndex
CREATE INDEX "InlineDemoAsset_owner_idx" ON "InlineDemoAsset"("owner");

-- AddForeignKey
ALTER TABLE "InlineDemoSlot" ADD CONSTRAINT "InlineDemoSlot_demoId_fkey" FOREIGN KEY ("demoId") REFERENCES "InlineDemo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
