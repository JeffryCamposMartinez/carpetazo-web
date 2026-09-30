-- Juego y detalle (edición, idioma) de cada carta deseada, para distinguir impresiones con el mismo nombre.
ALTER TABLE "WishlistItem" ADD COLUMN "game" TEXT,
    ADD COLUMN "detail" TEXT;
