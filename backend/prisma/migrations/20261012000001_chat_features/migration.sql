-- Mensajería estilo WhatsApp: entregado/leído, respuestas, reenviados, ediciones, reacciones, destacados, ajustes por chat y presencia
ALTER TABLE "Message" ADD COLUMN "deliveredAt" TIMESTAMP(3);
ALTER TABLE "Message" ADD COLUMN "readAt" TIMESTAMP(3);
ALTER TABLE "Message" ADD COLUMN "replyToId" TEXT;
ALTER TABLE "Message" ADD COLUMN "forwarded" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Message" ADD COLUMN "editedAt" TIMESTAMP(3);

-- Lo ya leído queda como entregado y leído desde que se envió (no hay otra fecha guardada)
UPDATE "Message" SET "deliveredAt" = "createdAt", "readAt" = "createdAt" WHERE "isRead" = true;
UPDATE "Message" SET "deliveredAt" = "createdAt" WHERE "isRead" = false AND "deliveredAt" IS NULL;

ALTER TABLE "User" ADD COLUMN "lastSeenAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "showLastSeen" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "showReadReceipts" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "MessageReaction" (
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessageReaction_pkey" PRIMARY KEY ("messageId","userId")
);

CREATE TABLE "MessageStar" (
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessageStar_pkey" PRIMARY KEY ("messageId","userId")
);
CREATE INDEX "MessageStar_userId_createdAt_idx" ON "MessageStar"("userId", "createdAt");

CREATE TABLE "ChatSetting" (
    "userId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "pinnedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "mutedUntil" TIMESTAMP(3),
    "markedUnread" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ChatSetting_pkey" PRIMARY KEY ("userId","partnerId")
);

ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessageStar" ADD CONSTRAINT "MessageStar_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
