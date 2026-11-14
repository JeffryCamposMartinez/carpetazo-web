# Ficha del local (bloque 1 de tiendas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Las tiendas con plan Tienda publican su local (dirección, horarios con «abierto ahora», medios de pago, juegos que compran y venden, fotos y política de cambios) en su perfil público, y las personas pueden filtrar vendedores por «Tiendas» y «Abiertas ahora».

**Architecture:** Tabla nueva `StoreProfile` 1:1 con `User` (migración aditiva). Lógica compartida y validación en `backend/core/storeProfile.js` (incluye el cálculo de «abierto ahora» en hora de Chile, que la web también usa en su copia pura `frontend/src/utils/storeHours.js`). Rutas en `backend/routes/stores.js`. El perfil público (`GET /api/users/:username`) suma `store` solo si la cuenta tiene el plan Tienda y la ficha está activa. Panel: pestaña nueva «Mi tienda» en `Dashboard.jsx` con el editor en `frontend/src/components/store/`.

**Tech Stack:** Express + Prisma (PostgreSQL), React + Vite + Tailwind, Vitest, pruebas de sesión `backend/tests/run.cjs`.

**Spec:** `docs/superpowers/specs/2026-11-14-tiendas-design.md` (sección «1. Ficha del local»)

## Global Constraints
- Exclusivo del plan Tienda: función de plan `storeTools: true` solo en `PLANS.store` (`backend/core/plans.js`). Sin el plan: el editor muestra cómo obtenerlo y lo público no aparece; nada se borra.
- Fase 1: propiedad en el servidor (solo el dueño edita su ficha), validación de tipos/largos/rangos con `backend/core/validation.js`, serialización pública con lista blanca, errores genéricos, `routeLimiter` en escrituras, cuerpos acotados (`express.json({ limit: '24kb' })`).
- Migración solo aditiva: `backend/prisma/migrations/20261115000001_store_profiles/migration.sql`.
- Horarios en la zona `America/Santiago`; hasta 2 tramos por día; excepciones por fecha (máx. 30 futuras).
- Medios de pago: `cash`, `transfer`, `debit`, `credit`. Juegos: los nombres de TCG del sitio `['Pokémon', 'Mitos y Leyendas', 'Magic', 'Yu-Gi-Oh!', 'One Piece', 'Lorcana', 'Digimon', 'Riftbound']`.
- Fotos: máx. 6, solo URLs aceptadas por `isAllowedStoredImageUrl`; subida con `type: 'store'` en `/api/users/upload-image` (carpeta del propio usuario).
- Textos: dirección ≤ 150, referencia ≤ 150, nota de compra ≤ 300, política ≤ 2000, nota de excepción ≤ 80 caracteres; sin caracteres de control.
- Mapa: solo botones a Google Maps (`https://www.google.com/maps/search/?api=1&query=`) y Waze (`https://waze.com/ul?q=`), con la dirección codificada; sin mapa incrustado.
- Estilo de la web: azul `#12315f`/`#1e40af` y amarillo `#facc15`, `LiquidTabs` donde haya opción activa, móvil primero.
- Commits con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; al terminar, subir y desplegar (backend primero).

## Review Focus
- Una tienda que baja del plan Tienda: su ficha deja de verse en el perfil y en «Tiendas» al instante, pero sigue guardada y vuelve al reactivar.
- Horarios que cruzan la medianoche (p. ej. 18:00–01:00) y el día con excepción «cerrado»: «abierto ahora» debe responder bien a las 00:30.
- Una ficha con datos maliciosos (HTML, `javascript:` en fotos, horarios 25:00, 40 excepciones) se rechaza con 400 y no se guarda nada a medias.
- El perfil público de un vendedor sin plan Tienda no expone ninguna dirección exacta (ni aunque tenga una ficha guardada de antes).
- Filtro «Abiertas ahora» con una tienda sin horarios cargados: no aparece como abierta.

---

### Task 1: Modelo, plan y validación de la ficha

**Files:**
- Modify: `backend/prisma/schema.prisma` (modelo `StoreProfile` y relación en `User`)
- Create: `backend/prisma/migrations/20261115000001_store_profiles/migration.sql`
- Modify: `backend/core/plans.js` (`storeTools: true` en `store`, `false` en el resto, incluido `test`)
- Modify: `backend/core/entitlements.js` (`FEATURE_MESSAGES.storeTools = 'Las herramientas de tienda están disponibles en el plan Tienda.'`)
- Create: `backend/core/storeProfile.js`
- Test: `backend/tests/storeProfile.unit.test.js`

**Interfaces:**
- Produces:
  - Prisma `StoreProfile { id String @id @default(uuid()), userId String @unique, enabled Boolean @default(false), address String @default(""), reference String @default(""), comuna String @default(""), region String @default(""), hours Json? , exceptions Json?, paymentMethods String[] @default([]), buyGames String[] @default([]), sellGames String[] @default([]), buyNote String @default(""), photos String[] @default([]), policy String @default(""), pickupHours Int @default(48), createdAt DateTime @default(now()), updatedAt DateTime @updatedAt }` con `user User @relation(fields: [userId], references: [id], onDelete: Cascade)` e índice `@@index([enabled, comuna])`.
  - `parseStoreProfile(body: object): { ok: true, data } | { ok: false, error: string }` — valida y normaliza todo el cuerpo (deduce `region` con `regionOfComuna`).
  - `isOpenAt(hours, exceptions, date: Date): { open: boolean, closesAt: string|null, opensAt: string|null }` — hora de Chile vía `Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago' })`.
  - `toPublicStore(profile): object|null` — lista blanca: `address, reference, comuna, region, hours, exceptions (solo futuras), paymentMethods, buyGames, sellGames, buyNote, photos, policy, openNow` ; `null` si `!enabled`.
  - Formato `hours`: `{ mon: [{ open: 'HH:MM', close: 'HH:MM' }], tue: [...], …, sun: [] }`; `exceptions`: `[{ date: 'YYYY-MM-DD', closed: boolean, ranges?: [...], note?: string }]`.

- [ ] **Step 1: Write the failing tests** (`node:test`, como `tests/visionEngine.unit.test.js`)

```js
test('parseStoreProfile acepta una ficha válida y deduce la región', () => {
  const r = parseStoreProfile({ enabled: true, address: 'Arauco 123', comuna: 'Chillán', hours: { mon: [{ open: '10:00', close: '20:00' }] }, paymentMethods: ['cash', 'debit'], buyGames: ['Pokémon'], photos: [] });
  assert.equal(r.ok, true); assert.equal(r.data.region, 'Ñuble');
});
test('rechaza horas imposibles, más de 2 tramos, comuna inventada, pagos o juegos desconocidos, fotos ajenas y más de 30 excepciones', () => {
  for (const bad of [{ hours: { mon: [{ open: '25:00', close: '20:00' }] } }, { hours: { mon: [1, 2, 3].map(() => ({ open: '10:00', close: '11:00' })) } }, { comuna: 'Gotham' }, { paymentMethods: ['bitcoin'] }, { buyGames: ['Fortnite'] }, { photos: ['javascript:alert(1)'] }, { exceptions: Array.from({ length: 31 }, (_, i) => ({ date: `2099-01-${String((i % 28) + 1).padStart(2, '0')}`, closed: true })) }, { address: 'x'.repeat(151) }, { policy: '<b>\u0000</b>' }])
    assert.equal(parseStoreProfile({ comuna: 'Chillán', ...bad }).ok, false, JSON.stringify(bad));
});
test('isOpenAt: dentro, fuera, cruzando medianoche y día cerrado por excepción', () => {
  const hours = { fri: [{ open: '18:00', close: '01:00' }], sat: [], mon: [{ open: '10:00', close: '20:00' }] };
  // 2026-11-13 es viernes; 2026-11-14 sábado (hora de Chile, UTC-3)
  assert.equal(isOpenAt(hours, [], new Date('2026-11-13T22:00:00Z')).open, true);   // vie 19:00
  assert.equal(isOpenAt(hours, [], new Date('2026-11-14T03:30:00Z')).open, true);   // sáb 00:30, tramo del viernes
  assert.equal(isOpenAt(hours, [], new Date('2026-11-14T05:00:00Z')).open, false);  // sáb 02:00
  assert.equal(isOpenAt(hours, [{ date: '2026-11-16', closed: true }], new Date('2026-11-16T15:00:00Z')).open, false); // lunes feriado
  assert.equal(isOpenAt(null, [], new Date()).open, false);
});
test('toPublicStore no devuelve nada si la ficha está apagada y nunca expone campos internos', () => {
  assert.equal(toPublicStore({ enabled: false, address: 'x' }), null);
  const pub = toPublicStore({ id: 'i', userId: 'u', enabled: true, address: 'Arauco 123', comuna: 'Chillán', hours: {}, exceptions: [], paymentMethods: [], buyGames: [], sellGames: [], photos: [], policy: '', buyNote: '', reference: '', region: 'Ñuble' });
  assert.equal('userId' in pub || 'id' in pub, false);
});
```

- [ ] **Step 2: Run** `node --test tests/storeProfile.unit.test.js` (en `backend/`) — Expected: FAIL (módulo no existe).
- [ ] **Step 3: Implement** el modelo, la migración SQL (CREATE TABLE "StoreProfile" … + índice único `userId`, índice `(enabled, comuna)`, FK con `ON DELETE CASCADE`), `storeTools` en planes, el mensaje del plan y `backend/core/storeProfile.js` con las tres funciones. Para tramos que cruzan medianoche, un tramo con `close <= open` pertenece al día de apertura y sigue abierto hasta `close` del día siguiente.
- [ ] **Step 4: Run** `node --test tests/storeProfile.unit.test.js` — Expected: PASS. Run `npx prisma migrate deploy && npx prisma generate` contra la base local (5433) — Expected: migración aplicada.
- [ ] **Step 5: Commit** `feat(tiendas): modelo y validación de la ficha del local`

### Task 2: Rutas de la ficha y perfil público

**Files:**
- Create: `backend/routes/stores.js` (montado en `backend/server.js` junto a las demás rutas)
- Modify: `backend/routes/users.js` (en `GET /api/users/:username`, agregar `store: toPublicStore(...)` solo con plan Tienda)
- Modify: `backend/routes/uploads.js` (acepta `type: 'store'`, guarda en la carpeta del usuario como `card`, mismo tamaño máximo)
- Modify: `backend/routes/sellers.js` (`GET /api/sellers?kind=store&open=1`)
- Test: `backend/tests/stores.test.cjs` (y agregar `'stores'` a la lista de `backend/tests/run.cjs`)

**Interfaces:**
- Consumes: `parseStoreProfile`, `toPublicStore`, `isOpenAt` (Task 1); `getEffectivePlan(db, userId)` y `assertFeature(plan, 'storeTools')` (`backend/core/entitlements.js`).
- Produces:
  - `GET /api/stores/me` (sesión) → `{ success, store: <ficha completa del dueño o null>, allowed: boolean }` (`allowed` = tiene `storeTools`).
  - `PUT /api/stores/me` (sesión, `routeLimiter(60*1000, 30)`, `express.json({ limit: '24kb' })`) → 403 `plan_feature_locked` sin el plan; 400 con `error` de `parseStoreProfile`; 200 `{ success, store }` con upsert.
  - Perfil público: campo `store` (objeto de `toPublicStore` o `null`).
  - `GET /api/sellers?kind=store` solo cuentas con plan Tienda y ficha activa; `&open=1` además filtra con `isOpenAt` (en memoria sobre la página, máx. 200 tiendas).

- [ ] **Step 1: Write the failing tests** en `backend/tests/stores.test.cjs` siguiendo el estilo de `tests/scanner.test.cjs` (`ok(nombre, condición, detalle)`):
  - `GET /stores/me` sin sesión → 401.
  - `PUT /stores/me` con usuario de plan Free → 403 y `code === 'plan_feature_locked'`.
  - Con usuario de plan Tienda (asignado con `PlanGrant` en el test, como hace `tests/plans.test.cjs`): ficha válida → 200; ficha con `comuna: 'Gotham'` → 400 y la ficha anterior queda intacta.
  - `GET /users/<tienda>` → `store.address === 'Arauco 123'` y sin `userId`, `id` ni `email` en `store`.
  - Se revoca el plan → `GET /users/<tienda>` → `store === null`; `GET /stores/me` sigue devolviendo la ficha (no se borró).
  - Vendedor común con ficha guardada en la base (insertada directo con Prisma) → `store === null` en su perfil.
  - `GET /sellers?kind=store` incluye la tienda y no al vendedor común; `kind=otra` → 400.
  - `POST /users/upload-image` con `type: 'store'` y una imagen válida → URL en la carpeta del usuario.
- [ ] **Step 2: Run** `CZ_ONLY=stores node tests/run.cjs` (base local en 5433) — Expected: FAIL (rutas no existen).
- [ ] **Step 3: Implement** las rutas y cambios listados; el upsert de la ficha y la lectura del plan van en el mismo request; los mensajes de error al cliente son los de `parseStoreProfile` (cortos, sin detalles internos).
- [ ] **Step 4: Run** `CZ_ONLY=stores,privateData,security,fuzzer node tests/run.cjs` y `node --check routes/stores.js routes/users.js routes/sellers.js routes/uploads.js` — Expected: sin `FALLA` y sin hallazgos del fuzzer.
- [ ] **Step 5: Commit** `feat(tiendas): rutas de la ficha del local, perfil público y filtro de tiendas`

### Task 3: «Abierto ahora» y servicios en la web

**Files:**
- Create: `frontend/src/utils/storeHours.js` (copia pura de `isOpenAt` y `formatHours(hours): Array<{ day: 'Lunes'…, text: '10:00–20:00' | 'Cerrado' }>`)
- Modify: `frontend/src/services/api.js` (`getMyStore()`, `saveMyStore(data)`)
- Test: `frontend/src/utils/storeHours.test.js`

**Interfaces:**
- Produces: `isOpenAt(hours, exceptions, date) → { open, closesAt, opensAt }` (mismo contrato que el backend), `formatHours(hours)`, `api.getMyStore() → GET /stores/me`, `api.saveMyStore(data) → PUT /stores/me`.

- [ ] **Step 1: Write the failing tests** con los mismos 5 casos de `isOpenAt` del Task 1 y: `formatHours({ mon: [{ open: '10:00', close: '14:00' }, { open: '15:00', close: '20:00' }] })[0].text === '10:00–14:00 y 15:00–20:00'`, y día sin tramos → `'Cerrado'`.
- [ ] **Step 2: Run** `npx vitest run src/utils/storeHours.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement** `storeHours.js` y los dos métodos de `api.js`.
- [ ] **Step 4: Run** `npx vitest run` — Expected: PASS (todas, incluidas las existentes).
- [ ] **Step 5: Commit** `feat(tiendas): horarios y «abierto ahora» en la web`

### Task 4: Editor «Mi tienda» en el panel

**Files:**
- Create: `frontend/src/components/store/StoreTab.jsx` (contenedor: carga, guardado, aviso de plan)
- Create: `frontend/src/components/store/StoreProfileForm.jsx` (datos del local, pagos, juegos, política)
- Create: `frontend/src/components/store/StoreHoursEditor.jsx` (7 días, hasta 2 tramos, copiar a todos los días, excepciones)
- Create: `frontend/src/components/store/StorePhotosEditor.jsx` (hasta 6 fotos con `api.uploadImage` y `type: 'store'`)
- Modify: `frontend/src/pages/Dashboard.jsx` (pestaña `'tienda'` con ícono `storefront`, enlace `/dashboard?tab=tienda`)
- Test: `frontend/src/components/store/StoreHoursEditor.test.jsx`

**Interfaces:**
- Consumes: `api.getMyStore`, `api.saveMyStore`, `api.uploadImage` (Task 3); `ComunaSelect` de `components/ui/ComunaSelect.jsx`; `LiquidTabs`.
- Produces: `<StoreTab />` sin props (usa la sesión).

- [ ] **Step 1: Write the failing test**: `StoreHoursEditor` con `value={{ mon: [{ open: '10:00', close: '20:00' }] }}` → «Copiar a todos los días» llama `onChange` con los 7 días iguales; agregar un tercer tramo no es posible (el botón desaparece con 2 tramos).
- [ ] **Step 2: Run** `npx vitest run src/components/store` — Expected: FAIL.
- [ ] **Step 3: Implement** los cuatro componentes (cada uno < 400 líneas) y la pestaña. Sin plan Tienda: tarjeta con lo que incluye y botón a `/planes`. Guardado con mensaje de éxito o el error del servidor; botón deshabilitado mientras guarda.
- [ ] **Step 4: Run** `npx vitest run && npx vite build` — Expected: PASS y build sin errores.
- [ ] **Step 5: Commit** `feat(tiendas): editor «Mi tienda» en el panel`

### Task 5: Ficha pública en el perfil y filtro en Vendedores

**Files:**
- Create: `frontend/src/components/store/StorePublicCard.jsx` (abierto ahora, dirección con botones Maps/Waze, horarios desplegables, pagos, compra/venta, fotos con `CardLightbox`, pestaña «Política de cambios»)
- Modify: `frontend/src/pages/SellerProfile.jsx` (muestra `StorePublicCard` si `profile.store`)
- Modify: `frontend/src/pages/PublicCatalog.jsx` (misma `StorePublicCard`, en versión compacta `compact`, si el perfil del dueño trae `store`)
- Modify: `frontend/src/pages/SellersPage.jsx` (`LiquidTabs` «Todos / Tiendas» y casilla «Abiertas ahora» → `kind=store&open=1`)
- Test: `frontend/src/components/store/StorePublicCard.test.jsx`

**Interfaces:**
- Consumes: `isOpenAt`, `formatHours` (Task 3); campo `store` del perfil público (Task 2).
- Produces: `<StorePublicCard store={object} compact={boolean} />` (`compact`: solo abierto ahora, dirección y botones de mapa).

- [ ] **Step 1: Write the failing tests**: con `store.address = 'Arauco 123'` y `comuna = 'Chillán'`, el enlace de Google Maps es `https://www.google.com/maps/search/?api=1&query=Arauco%20123%2C%20Chill%C3%A1n%2C%20Chile` y el de Waze `https://waze.com/ul?q=Arauco%20123%2C%20Chill%C3%A1n%2C%20Chile`; ambos con `rel="noopener noreferrer"` y `target="_blank"`; con `store = null` no renderiza nada.
- [ ] **Step 2: Run** `npx vitest run src/components/store/StorePublicCard.test.jsx` — Expected: FAIL.
- [ ] **Step 3: Implement** el componente y los cambios de página.
- [ ] **Step 4: Run** `npx vitest run && npx vite build && npx oxlint` — Expected: PASS, build ok, sin errores nuevos del lint.
- [ ] **Step 5: Commit, subir y desplegar** `feat(tiendas): ficha pública del local y filtro de tiendas` — backend primero (migración), luego frontend; verificar `GET /api/users/<tienda>` y `GET /api/sellers?kind=store` en producción.
