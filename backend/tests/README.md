# Pruebas de rutas con sesión

Verifican propiedad (propio vs ajeno), validación, pedidos, reseñas y borrado de cuenta.

- `npm run test:session` levanta la API en el puerto 8000 con Firebase simulado (`tests/register.mjs`, token `test-<uid>`), corre `batchA`, `chats` y `fraud`, y la apaga.
- Solo funciona con `TEST_AUTH_STUB=1` (lo pone el runner) y una `DATABASE_URL` local; nunca contra producción.
- Las pruebas usan los usuarios y carpetas de la base de desarrollo (UIDs fijos al inicio de cada archivo) y limpian lo que crean. Si la base local cambia, ajustar esos UIDs.
- Detén antes cualquier servidor que use el puerto 8000.
