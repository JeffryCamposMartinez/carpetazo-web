-- Carpetazo Intelligence: analítica propia (eventos, sesiones, agregados, cifras de negocio, libro de pagos, ajustes)
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "visitorId" TEXT,
    "sessionId" TEXT,
    "userId" TEXT,
    "path" TEXT NOT NULL DEFAULT '',
    "props" JSONB,
    "device" TEXT NOT NULL DEFAULT '',
    "browser" TEXT NOT NULL DEFAULT '',
    "os" TEXT NOT NULL DEFAULT '',
    "viewport" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT '',
    "medium" TEXT NOT NULL DEFAULT '',
    "campaign" TEXT NOT NULL DEFAULT '',
    "tz" TEXT NOT NULL DEFAULT '',
    "origin" TEXT NOT NULL DEFAULT 'web',
    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AnalyticsEvent_at_idx" ON "AnalyticsEvent"("at");
CREATE INDEX "AnalyticsEvent_name_at_idx" ON "AnalyticsEvent"("name", "at");
CREATE INDEX "AnalyticsEvent_sessionId_at_idx" ON "AnalyticsEvent"("sessionId", "at");
CREATE INDEX "AnalyticsEvent_path_at_idx" ON "AnalyticsEvent"("path", "at");
CREATE INDEX "AnalyticsEvent_userId_at_idx" ON "AnalyticsEvent"("userId", "at");

CREATE TABLE "AnalyticsSession" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "userId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "lastAt" TIMESTAMP(3) NOT NULL,
    "entryPath" TEXT NOT NULL DEFAULT '',
    "exitPath" TEXT NOT NULL DEFAULT '',
    "pages" INTEGER NOT NULL DEFAULT 0,
    "events" INTEGER NOT NULL DEFAULT 0,
    "activeSec" INTEGER NOT NULL DEFAULT 0,
    "device" TEXT NOT NULL DEFAULT '',
    "browser" TEXT NOT NULL DEFAULT '',
    "os" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT '',
    "medium" TEXT NOT NULL DEFAULT '',
    "campaign" TEXT NOT NULL DEFAULT '',
    "tz" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "AnalyticsSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AnalyticsSession_startedAt_idx" ON "AnalyticsSession"("startedAt");
CREATE INDEX "AnalyticsSession_visitorId_startedAt_idx" ON "AnalyticsSession"("visitorId", "startedAt");
CREATE INDEX "AnalyticsSession_userId_startedAt_idx" ON "AnalyticsSession"("userId", "startedAt");

CREATE TABLE "AnalyticsDaily" (
    "day" DATE NOT NULL,
    "metric" TEXT NOT NULL,
    "dim1" TEXT NOT NULL DEFAULT '',
    "dim2" TEXT NOT NULL DEFAULT '',
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    CONSTRAINT "AnalyticsDaily_pkey" PRIMARY KEY ("day", "metric", "dim1", "dim2")
);
CREATE INDEX "AnalyticsDaily_metric_day_idx" ON "AnalyticsDaily"("metric", "day");

CREATE TABLE "BusinessDaily" (
    "day" DATE NOT NULL,
    "metric" TEXT NOT NULL,
    "dim" TEXT NOT NULL DEFAULT '',
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "origin" TEXT NOT NULL DEFAULT 'measured',
    CONSTRAINT "BusinessDaily_pkey" PRIMARY KEY ("day", "metric", "dim")
);
CREATE INDEX "BusinessDaily_metric_day_idx" ON "BusinessDaily"("metric", "day");

CREATE TABLE "PaymentLedger" (
    "id" TEXT NOT NULL,
    "providerPaymentId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "userId" TEXT,
    "status" TEXT NOT NULL,
    "amountClp" INTEGER NOT NULL DEFAULT 0,
    "refundedClp" INTEGER NOT NULL DEFAULT 0,
    "paidAt" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'payment',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentLedger_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaymentLedger_providerPaymentId_key" ON "PaymentLedger"("providerPaymentId");
CREATE INDEX "PaymentLedger_status_paidAt_idx" ON "PaymentLedger"("status", "paidAt");
CREATE INDEX "PaymentLedger_subscriptionId_idx" ON "PaymentLedger"("subscriptionId");
CREATE INDEX "PaymentLedger_userId_idx" ON "PaymentLedger"("userId");

CREATE TABLE "AnalyticsSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "retentionDays" INTEGER NOT NULL DEFAULT 90,
    "sampleRate" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    CONSTRAINT "AnalyticsSettings_pkey" PRIMARY KEY ("id")
);
INSERT INTO "AnalyticsSettings" ("id", "enabled", "retentionDays", "sampleRate", "updatedAt") VALUES (1, false, 90, 1, CURRENT_TIMESTAMP);
