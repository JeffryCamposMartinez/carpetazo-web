# Carpetazo

Carpetazo es una plataforma para vendedores y coleccionistas de Trading Card Games (hoy Pokémon y Mitos y Leyendas). Cada vendedor arma carpetas públicas con precio y stock; el comprador arma un pedido que llega por WhatsApp o por mensaje; el vendedor lo confirma y el stock se descuenta. Incluye mensajes, perfiles públicos, lista de cartas deseadas y reseñas de vendedores.

## Stack

- **Frontend:** React + Vite, Tailwind CSS, Firebase Authentication. API en `VITE_API_URL` o, por defecto, `https://api.carpetazo.cl/api`.
- **Backend:** Node.js + Express, PostgreSQL + Prisma, Firebase Admin (valida los tokens de sesión), Cloudflare R2 (imágenes).
- **Hosting:** VPS con Coolify (frontend, API y base de datos).

## Estructura

```text
backend/                 API Express (server.js), Prisma (schema y migraciones), scripts de datos
frontend/                App React/Vite
tools/                   Herramientas de escritorio (MylDbUpdater)
.github/workflows/ci.yml Validación (build, sintaxis, esquema) y contrato público
```

## Desarrollo local

```bash
# Backend (necesita backend/.env, ver .env.example)
cd backend
npm install
npm run build      # prisma generate + prisma migrate deploy
npm start          # http://localhost:8000

# Frontend (el proxy de Vite envía /api a localhost:8000)
cd frontend
npm install
npm run dev        # http://localhost:5173
```

Para apuntar el frontend a otro backend: `VITE_API_URL=http://localhost:8000/api npm run dev`. `iniciar_servidores.bat` levanta backend, frontend y ngrok en Windows.

### Variables del backend (`backend/.env`)

`DATABASE_URL`, `PORT`, `ADMIN_EMAILS`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`. Opcionales: `RATE_LIMIT_MAX`, `POKEMON_TCG_API_KEY` y **`IP_HASH_SALT`** (clave larga y secreta para el identificador anónimo de conexión que usan los controles antifraude de las reseñas; en producción debe estar definida). No subas archivos `.env`.

## Despliegue

Un *push* a `main` dispara el despliegue automático de **Coolify**: ejecuta el build del backend (`npm run build`, que aplica las migraciones pendientes con `prisma migrate deploy`) y reconstruye el frontend. GitHub Actions no despliega.

Antes de subir un cambio con migración: respaldo de la base (Coolify → Backups, o `npm run db:backup`) y revisar el SQL.

### CI (`.github/workflows/ci.yml`)

- **verify:** build del frontend, `node --check server.js` y `prisma validate`.
- **public-contract:** espera el deploy y corre `node backend/check_public_contract.cjs https://api.carpetazo.cl/api`; falla si alguna respuesta pública trae correo, RUT, datos bancarios, rol, `firebaseUid` o campos privados de direcciones. Corre en cada *push*, cada 6 horas y a mano.

## Pruebas y verificación

- `npm run test:contract` (backend): las rutas públicas no filtran datos privados. Acepta la URL base como argumento.
- `npm run test:session` (backend): pruebas de rutas con sesión (propio vs ajeno, pedidos, reseñas, lista de deseos, borrado de cuenta). Usa una simulación de Firebase solo para pruebas y una base de **desarrollo**; ver `backend/tests/README.md`.

## Base de datos

Migraciones en `backend/prisma/migrations`, siempre aditivas; ver `backend/prisma/README.md`. Respaldo: `npm run db:backup`. Moderación de reseñas reportadas o sospechosas: sección `/moderacion` (solo administradores) o `node backend/review_moderation.cjs list`.

## Healthcheck

```text
GET /api/health
```

Sirve para comprobar si la API está viva.
