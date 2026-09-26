# Carpetazo

Carpetazo es una plataforma para vendedores y coleccionistas de Trading Card Games. Permite crear carpetas públicas, administrar stock/precios, compartir catálogos y recibir mensajes o pedidos.

## Stack

### Frontend

- React + Vite
- Tailwind CSS
- Firebase Authentication
- API principal vía `VITE_API_URL` o, por defecto, `https://api.carpetazo.cl/api`

### Backend

- Node.js + Express
- PostgreSQL + Prisma
- Firebase Admin para validar tokens de Firebase Auth
- API pública en `https://api.carpetazo.cl/api`

## Estructura

```text
backend/                 API Express, Prisma y endpoints
frontend/                App React/Vite
.github/workflows/ci.yml Validación y deploy a VPS
```

## Desarrollo local

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Por defecto el frontend local usa `https://api.carpetazo.cl/api`. Si quieres apuntar a otro backend:

```bash
VITE_API_URL=http://localhost:8000/api npm run dev
```

### Backend

```bash
cd backend
npm install
npm run build
npm start
```

El backend necesita `DATABASE_URL` y las variables/señales propias del entorno de producción. No subas archivos `.env`.

## Deploy

El workflow `.github/workflows/ci.yml` valida frontend, backend y Prisma. En pushes a `main` intenta desplegar por SSH a la VPS.

Debes configurar estos secretos en GitHub:

- `VPS_HOST`
- `VPS_USER`
- `VPS_SSH_KEY`
- `VPS_PROJECT_PATH`
- `VPS_RESTART_COMMAND`
- `VITE_API_URL` recomendado: `https://api.carpetazo.cl/api`
- `VPS_PORT` opcional si no usas puerto 22
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_PUBLIC_URL`

El deploy ejecuta:

```bash
git pull --ff-only origin main
cd backend
# actualiza las variables R2_* en backend/.env desde GitHub Secrets
npm ci
npm run build
cd ../frontend
npm ci
npm run build
```

Después ejecuta el comando definido en `VPS_RESTART_COMMAND`, por ejemplo un reinicio con PM2 o systemd.

## Healthcheck

La API expone:

```text
GET /api/health
```

Sirve para comprobar si la VPS está viva y qué entorno/commit está corriendo.
