-- Eventos y torneos de las tiendas, con inscripción y lista de espera
CREATE TABLE "StoreEvent" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "capacity" INTEGER,
    "feeClp" INTEGER NOT NULL DEFAULT 0,
    "format" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "resultNote" TEXT NOT NULL DEFAULT '',
    "reminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoreEventSignup" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'registered',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreEventSignup_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StoreEvent_storeId_startsAt_idx" ON "StoreEvent"("storeId", "startsAt");
CREATE INDEX "StoreEvent_status_startsAt_idx" ON "StoreEvent"("status", "startsAt");
CREATE UNIQUE INDEX "StoreEventSignup_eventId_userId_key" ON "StoreEventSignup"("eventId", "userId");
CREATE INDEX "StoreEventSignup_eventId_status_createdAt_idx" ON "StoreEventSignup"("eventId", "status", "createdAt");

ALTER TABLE "StoreEvent" ADD CONSTRAINT "StoreEvent_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoreEventSignup" ADD CONSTRAINT "StoreEventSignup_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "StoreEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoreEventSignup" ADD CONSTRAINT "StoreEventSignup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
