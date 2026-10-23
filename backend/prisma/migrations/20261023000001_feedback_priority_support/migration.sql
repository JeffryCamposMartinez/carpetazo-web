ALTER TABLE "Feedback" ADD COLUMN "priority" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Feedback_priority_status_createdAt_idx" ON "Feedback"("priority", "status", "createdAt");
