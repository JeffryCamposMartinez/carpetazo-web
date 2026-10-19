-- Detalle de visitas de las carpetas públicas: una fila por carpeta, día y origen
CREATE TABLE "FolderVisitDay" (
    "folderId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "source" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FolderVisitDay_pkey" PRIMARY KEY ("folderId","day","source")
);

CREATE INDEX "FolderVisitDay_day_idx" ON "FolderVisitDay"("day");

ALTER TABLE "FolderVisitDay" ADD CONSTRAINT "FolderVisitDay_folderId_fkey"
  FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
