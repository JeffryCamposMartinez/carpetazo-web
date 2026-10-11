-- Confianza (insignia de vendedor verificado) y guía de primeros pasos
ALTER TABLE "User" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "onboardingSharedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "onboardingNudgeAt" TIMESTAMP(3);
