-- Contadores de actividad por día, sin datos de personas
CREATE TABLE "MetricDay" (
    "day" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT '',
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MetricDay_pkey" PRIMARY KEY ("day","name","key")
);

CREATE INDEX "MetricDay_name_day_idx" ON "MetricDay"("name", "day");
