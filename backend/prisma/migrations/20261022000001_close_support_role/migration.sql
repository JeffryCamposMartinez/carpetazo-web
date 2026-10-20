-- El rol de soporte se retira: quien lo tenía pasa a «sin rol de equipo» (solo pierde permisos de lectura de Moderación)
UPDATE "User" SET "role" = 'user' WHERE "role" = 'support';
