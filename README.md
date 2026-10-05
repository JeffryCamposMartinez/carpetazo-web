# Carpetazo

Carpetazo es una plataforma para vendedores y coleccionistas de Trading Card Games (hoy Pokémon y Mitos y Leyendas). Cada vendedor arma carpetas públicas con precio y stock; el comprador arma un pedido que llega por WhatsApp o por mensaje; el vendedor lo confirma y el stock se descuenta. Incluye mensajes, perfiles públicos, lista de cartas deseadas y reseñas de vendedores.

## Stack

- **Frontend:** React + Vite, Tailwind CSS, Firebase Authentication. API en `VITE_API_URL` o, por defecto, `https://api.carpetazo.cl/api`.
- **Backend:** Node.js + Express, PostgreSQL + Prisma, Firebase Admin (valida los tokens de sesión), Cloudflare R2 (imágenes).
- **Hosting:** VPS con Coolify (frontend, API y base de datos).

## Estructura

```text
backend/
  server.js              Entrada: seguridad, límites, términos y montaje de las rutas
  core/                  Piezas compartidas: sesión, validación, R2, correo, límites, términos
  routes/                Un router por tema (users, uploads, folders, orders, wishlist, messages, catalog…)
  moderation/            Reportes, sanciones, detección automática y escaneo de imágenes
  scripts/               Tareas manuales: db/, catalog/, r2/, pokemon/, checks/ (contrato público)
  prisma/                Esquema y migraciones
  tests/                 Pruebas con sesión (npm run test:session)
frontend/
  src/app/               App.jsx (rutas) y carga diferida de páginas
  src/pages/             Una página por ruta
  src/components/<tema>/ Componentes por tema (auth, layout, ui, folder, profile, wishlist, orders…)
  src/contexts/          Estado global (sesión)
  src/services/          API, Firebase y catálogo externo
  src/config/            Datos estáticos y opciones
  src/utils/             Funciones puras
  src/legal/             Textos y versiones legales
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

- **verify:** build del frontend, `node --check` del backend y `prisma validate`.
- **public-contract:** espera el deploy y corre `node backend/scripts/checks/check_public_contract.cjs https://api.carpetazo.cl/api`; falla si alguna respuesta pública trae correo, RUT, datos bancarios, rol, `firebaseUid` o campos privados de direcciones. Corre en cada *push*, cada 6 horas y a mano.

## Pruebas y verificación

- `npm run test:contract` (backend): las rutas públicas no filtran datos privados. Acepta la URL base como argumento.
- `npm run test:session` (backend): pruebas de rutas con sesión (propio vs ajeno, pedidos, reseñas, lista de deseos, borrado de cuenta, términos, correos y moderación). Usa una simulación de Firebase solo para pruebas y una base de **desarrollo**; ver `backend/tests/README.md`.

## Textos legales y aceptación

- `/terminos` y `/privacidad` son páginas públicas. Su contenido sale de `frontend/src/legal/content.js`, **generado** desde el documento legal del proyecto (no se edita a mano).
- `npm run build` (frontend) también genera `dist/terminos/index.html` y `dist/privacidad/index.html` con el texto completo en el HTML (`scripts/prerender-legal.mjs`), para que lo lean verificadores que no ejecutan JavaScript, como el de Google. La dirección directa es la que termina en `/` (por ejemplo `https://carpetazo.cl/privacidad/`).
- Cada cuenta debe aceptar la versión vigente (`LEGAL_CURRENT` en `backend/core/legal.js`, igual que `frontend/src/legal/versions.js`; una prueba exige que coincidan). Sin aceptación vigente el servidor rechaza cualquier escritura con `403 terms_required`. Al cambiar un texto se sube la versión en ambos archivos y todos deben aceptar de nuevo.
- Las cuentas nuevas se crean solo con Google. Quien ya tenía correo y contraseña sigue entrando así, y cualquier cuenta con Google puede crear una contraseña en su perfil.

## Reportes y moderación

- Cualquier persona con sesión puede reportar usuarios, foto/banner/fondo/texto de perfil, carpetas, cartas, fotos de carta, reseñas, mensajes y cartas deseadas. Las razones salen de `backend/moderation/reportReasons.js` (el cliente solo las consulta) y las rutas están en `backend/moderation/reports.js`.
- El reporte es anónimo para el reportado. Guarda una copia del contenido al momento de reportar y se limita a 20 por hora y 60 por día por persona.
- Una imagen con motivo crítico (menores, contenido sexual) se oculta sola si la reporta una cuenta de más de 24 horas; el resto queda en cola.
- Panel `/moderacion` (solo administradores): cola por gravedad, detalle, decisión (descartar, ocultar, quitar, restaurar), notas internas y auditoría (`ModerationAudit`, solo se agrega). Cada decisión avisa por correo al dueño del contenido, sin decir quién reportó.
- El contenido oculto no se serializa en las rutas públicas; el estado de moderación solo lo ve el dueño.
- **Equipo y roles** (`User.role`): `support` solo lee, `moderator` decide y aplica medidas de hasta 30 días, `admin` (por `ADMIN_EMAILS` o rol en la base) además levanta medidas, decide apelaciones, cambia roles y ve la auditoría. Un administrador asigna los roles desde `/moderacion` → Personas y medidas.
- **Estafas** (`FraudCase`): los reportes de estafa se agrupan en un caso por vendedor; el equipo pide el descargo (72 h; 48 h con prioridad alta) y resuelve. Con 3 compradores con pedido se pausan las ventas automáticamente (reversible).
- **Sanciones** (`Sanction`): advertencia, restringir mensajes, suspender ventas, suspender cuenta y cerrar cuenta (necesita otro administrador que apruebe). Se aplican en `moderation/sanctions.js` (`createRestrictions` corta las escrituras de una cuenta suspendida) y vencen solas. La persona puede apelar 14 días desde Mi perfil → Moderación.
- **Bloqueo** entre usuarios (`UserBlock`) y **evidencias** de reportes (`Evidence`: hasta 3 imágenes, re-codificadas y guardadas en la base; solo las ve el equipo y cada vista queda en la auditoría).

- **Detección y madurez** (`moderation/automation.js`): los filtros de texto (`moderation/textSignals.js`) crean reportes automáticos en reseñas, biografías y mensajes; cada imagen subida guarda su huella visual (`moderation/perceptual.js`) y una imagen confirmada como infracción impide subir otras parecidas; quienes reportan de mala fe pesan menos. Una limpieza diaria aplica los plazos de retención (`RETENTION`; se puede apagar con `RETENTION_DISABLED=1`). Métricas e informe de un caso para autoridades en `/moderacion` (solo administradores).

- **Escaneo de imágenes** (`moderation/imageScan.js`): fotos de perfil, banner, fondo y cartas pasan por Sightengine y, si no responde o se agota su cuota, por Google Cloud Vision (SafeSearch). Variables del backend: `SIGHTENGINE_USER`, `SIGHTENGINE_SECRET`, `GOOGLE_VISION_KEY`. Opcionales: `SIGHTENGINE_MONTHLY_LIMIT` (2000), `GOOGLE_VISION_MONTHLY_LIMIT` (1000), `IMAGE_SCAN_DISABLED=1`, `IMAGE_SCAN_BUDGET_MS` (3500), `TRUST_MIN_ACCOUNT_DAYS` (7). Sin claves el escaneo queda apagado. Las imágenes del chat y las evidencias nunca se envían. En local, `EXTRA_ENV_FILE` puede apuntar a otro archivo de variables. En Google Cloud conviene un tope de cuota y una alerta de presupuesto para garantizar costo cero.

## Correos

- Se envían por SMTP con `SMTP_USER` y `SMTP_PASS` (Gmail con contraseña de aplicación) en las variables del backend; sin ellas no se envía nada. Nunca se escribe a una cuenta que no tenga aceptados los Términos vigentes. Prueba: botón en `/moderacion` → Herramientas.

## Base de datos

Migraciones en `backend/prisma/migrations`, siempre aditivas; ver `backend/prisma/README.md`. Respaldo: `npm run db:backup`. Moderación de reseñas reportadas o sospechosas: sección `/moderacion` (solo administradores) o `node backend/scripts/db/review_moderation.cjs list`.

## Healthcheck

```text
GET /api/health
```

Sirve para comprobar si la API está viva.
