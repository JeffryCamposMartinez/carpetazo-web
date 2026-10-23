ALTER TABLE "Feedback"
ADD COLUMN "attachments" JSONB NOT NULL DEFAULT '[]'::jsonb;
