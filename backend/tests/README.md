# Pruebas de rutas con sesión

Verifican propiedad (propio vs ajeno), validación, pedidos y reservas de stock, conversaciones, reseñas, moderación y borrado de cuenta.

- `npm run test:session` levanta la API en el puerto 8000 con Firebase simulado (`tests/register.mjs`, token `test-<uid>`), crea sus propios datos (`tests/fixtures.cjs`), corre `batchA`, `chats`, `fraud`, `orders`, `audit` y `terms` (aceptación de términos), borra todo lo que creó y apaga la API.
- Los datos de prueba son usuarios con `firebaseUid` que empieza por `cztest-` (más sus carpetas, pedidos, mensajes y reseñas). No usa datos existentes de la base, así que se puede repetir y no cambia nada más.
- El administrador de prueba es `cztest-admin@test.local`: el runner se lo pasa a la API de prueba en `ADMIN_EMAILS`.
- Solo funciona con `TEST_AUTH_STUB=1` (lo pone el runner) y una `DATABASE_URL` local (`localhost`/`127.0.0.1`); nunca contra producción.
- La CI (`session-tests` en `.github/workflows/ci.yml`) las corre en cada push sobre una base PostgreSQL vacía que se descarta al terminar.
- Detén antes cualquier servidor que use el puerto 8000.
