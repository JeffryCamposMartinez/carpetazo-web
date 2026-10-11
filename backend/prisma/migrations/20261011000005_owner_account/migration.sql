-- Cuenta propietaria: la cuenta original de Carpetazo queda protegida (nadie puede cambiar su rol, suspenderla, cerrarla ni ocultar su contenido)
ALTER TABLE "User" ADD COLUMN "isOwner" BOOLEAN NOT NULL DEFAULT false;

UPDATE "User" SET "isOwner" = true, "role" = 'admin'
WHERE lower("email") = 'carpetazo.soporte@gmail.com' AND "role" <> 'deleted';
