-- CreateTable
CREATE TABLE "Link" (
    "code" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL,
    "updated" INTEGER,
    "last" INTEGER,
    "owner" TEXT NOT NULL,
    "pin" TEXT,

    CONSTRAINT "Link_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE UNIQUE INDEX "Link_code_key" ON "Link"("code");

-- CreateIndex
CREATE INDEX "Link_owner_idx" ON "Link"("owner");

-- CreateIndex
CREATE INDEX "Link_created_idx" ON "Link"("created");
