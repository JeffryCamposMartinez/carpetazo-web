-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
ALTER COLUMN "reporterId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ImageHash" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "userId" TEXT,
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "bannedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImageHash_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImageHash_url_key" ON "ImageHash"("url");

-- CreateIndex
CREATE INDEX "ImageHash_banned_idx" ON "ImageHash"("banned");

-- CreateIndex
CREATE INDEX "ImageHash_createdAt_idx" ON "ImageHash"("createdAt");
