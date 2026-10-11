-- Da el rol de administrador a la cuenta "tito_jeffry" (Tito Jeffry), a pedido del dueño de la plataforma.
-- Solo corre en la base de producción (llamada "postgres"): las bases locales y de pruebas no se tocan.
-- Es seguro repetirla: si la cuenta no existe, ya es administradora o fue eliminada, no hace nada.
WITH promoted AS (
  UPDATE "User" SET "role" = 'admin'
  WHERE current_database() = 'postgres' AND "username" = 'tito_jeffry' AND "role" NOT IN ('admin', 'deleted')
  RETURNING "id", "username"
)
INSERT INTO "ModerationAudit" ("id", "actorId", "action", "targetType", "targetId", "note", "createdAt")
SELECT gen_random_uuid()::text, NULL, 'role.admin_granted', 'user', "id", 'Rol de administrador otorgado a @' || "username" || ' a pedido del dueño de la plataforma', now()
FROM promoted;
