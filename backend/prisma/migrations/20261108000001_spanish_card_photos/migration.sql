-- Fotos de la comunidad para la versión en español de una carta
ALTER TABLE "CatalogCard" ADD COLUMN "spanishImageKey" TEXT, ADD COLUMN "spanishThumbKey" TEXT;
ALTER TABLE "CatalogImageProposal" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en';
