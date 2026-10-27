-- Las cartas que ya estaban subidas quedan en 5 estrellas (perfecta)
UPDATE "Card" SET "condition" = 5 WHERE "condition" IS NULL;
