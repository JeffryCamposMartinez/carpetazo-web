# Carpetazo Intelligence — Informe de la Etapa 3 (Infraestructura)

Fecha: 2026-11-15. Commit `defa5bc`, desplegado en producción (backend y frontend). **La recolección está APAGADA** hasta que un administrador la encienda.

## Qué se construyó

| Pieza | Archivos | Qué hace |
|---|---|---|
| Base de datos | `prisma/migrations/20261116000001_analytics_core` | Tablas `AnalyticsEvent`, `AnalyticsSession`, `AnalyticsDaily`, `BusinessDaily`, `PaymentLedger`, `AnalyticsSettings` (fila única, `enabled=false`, retención 90 días) |
| Catálogo de eventos | `backend/core/analyticsCatalog.js`, copia en `frontend/src/analytics/eventCatalog.js` | 41 eventos con propiedades permitidas y su tipo. Un evento o propiedad fuera del catálogo se descarta. Una prueba exige que las dos copias coincidan |
| Recolección | `backend/core/analytics.js`, `backend/routes/analytics.js` | `GET /api/analytics/config` y `POST /api/analytics/collect` (público, anónimo, limitado). Cola en memoria con guardado por lotes cada 2 s; deduplicación por id; sesiones calculadas en el servidor |
| Eventos del servidor | `routes/users.js`, `folders.js`, `orders.js`, `billing.js` | `signup_completed`, `folder_created`, `card_added`, `order_created`, `subscription_confirmed`, `subscription_canceled` (no se pueden falsear desde el navegador) |
| Latencia por endpoint | `backend/core/apiTiming.js` | Acumula en memoria por ruta con parámetros y guarda cada minuto un agregado (conteo, suma y máximo de ms, lentas > 1 s, 4xx, 5xx). No guarda un registro por petición |
| Trabajo nocturno | `backend/core/analyticsJobs.js` | 03:30 de Chile: consolida el día anterior, toma la foto de negocio, reconstruye lo reconstruible y aplica la retención. Idempotente |
| Libro de pagos | `backend/core/paymentLedger.js` + webhook | Cada pago se consulta a Mercado Pago. Solo `approved` suma ingresos, menos lo reembolsado |
| Rastreador web | `frontend/src/analytics/tracker.js`, `useTracking.js`, `App.jsx`, `Footer.jsx` | Vista de página, tiempo activo, scroll (25/50/75/100), Web Vitals (LCP, CLS, INP, TTFB, FCP), errores de JavaScript, clics `data-track`, lotes cada 5 s y al ocultar la página |
| Privacidad | `Footer.jsx` | Botón «No medir mi uso». También respeta «No rastrear» y Global Privacy Control |

## Decisiones aplicadas (las tuyas)

Sin cookies y con exclusión · libro de pagos de Mercado Pago · país aproximado (zona horaria del navegador, sin GeoIP) · eventos crudos 90 días y agregados 25 meses.

## Privacidad: lo que sí y no se guarda

Se guarda: identificador aleatorio del navegador, sesión, ruta agrupada (`/carpeta/:id`, nunca ids ni nombres de usuario), dispositivo / navegador / sistema resumidos, fuente de tráfico (dominio de origen y UTM), zona horaria, y `userId` solo con sesión iniciada.
**No se guarda:** IP, User-Agent completo, cookies, contraseñas, tokens, correos, enlaces ni números largos en propiedades, contenido de mensajes, datos de pago. Al eliminar una cuenta se borran sus eventos.

## Pruebas ejecutadas

- **8 unitarias** (`analytics.unit.test.js`): clasificación de fuentes, agrupación de rutas, validación de eventos, propiedades sin correos/enlaces/teléfonos, catálogo servidor = web, pagos (solo `approved` suma).
- **41 con servidor y base reales** (`analytics.test.cjs`): parte apagada; «No rastrear» y GPC no guardan nada; un lote válido guarda 3 eventos y su sesión (1 página, 3 eventos, 20 s activos); reenviar un lote **no duplica** eventos ni infla la sesión; 4 visitas de 1 visitante en 2 sesiones no se confunden; eventos del servidor no entran desde la web; robots e identificadores inválidos se ignoran; 51 eventos → 400, cuerpo grande → 413, JSON roto → 400; **23:30 y 00:30 de Chile caen en días distintos**; el consolidado no duplica; la retención borra solo lo vencido; reconstrucción rotulada y sin totales inventados; usuarios nuevos reconstruidos = usuarios con fecha de registro; trabajo nocturno una vez al día; libro de pagos (idempotente, reembolso, rechazo, forma inesperada).
- Frontend: compila y pasa sus 46 pruebas. La regresión de pedidos, tienda y planes mantiene solo las 6 fallas previas de «prioridad por plan».
- Producción: `config` responde `enabled:false`; `collect` responde 204 y no guarda.

## Lo que NO está terminado (y por eso la etapa no está cerrada del todo)

1. **Mercado Pago:** no pude leer su documentación de pagos de suscripción (403). El libro solo cuenta como ingreso lo que `GET /v1/payments/{id}` confirme como `approved`, y todo lo inesperado queda «unverified» sin sumar. **No está probado contra Mercado Pago real.** Con el primer cobro real conviene revisar que el pago aparezca en el libro con el monto y estado correctos. Si el aviso de suscripción no llega con el tema que esperamos, hay que ajustar el tema desde el panel de Mercado Pago (`payment` y `subscription_authorized_payment`).
2. **Instrumentación de flujos:** hoy se mide de forma automática la navegación completa y 6 hechos del servidor. Faltan los eventos de cada flujo (búsqueda con resultados, escáner, carrito, clic en planes, formularios iniciados/abandonados, compartir…). Se instrumentan en la Etapa 4, junto con el módulo que los usa.
3. **Política de Privacidad:** el texto actual dice «no usamos cookies … de analítica de terceros». La analítica propia es compatible, pero hay que **agregar una sección** que describa qué se mide, la retención y el botón de exclusión. Publicarla obliga a todos a aceptar la nueva versión, por eso **no la cambié sin tu autorización**. Propongo el texto en la Etapa 6 y **no enciendas la recolección hasta publicarlo**.
4. **Encendido:** todavía no hay pantalla en Moderación para encender o apagar la recolección ni ver datos. Eso es la Etapa 6 (integración). Mientras tanto queda apagada.
5. **Sin datos retroactivos:** visitas, sesiones y retención de uso empiezan a medirse desde el día en que se encienda. Lo reconstruible (registros, carpetas, cartas que siguen existiendo, pedidos, suscripciones) se rotula «reconstruido».

## Siguiente: Etapa 4 (Analítica)

Instrumentar los flujos que faltan e implementar las consultas y vistas: audiencia, páginas, productos, búsquedas, monetización, embudos, cohortes y el explorador con lista blanca, todo en la nueva sección de Moderación (nivel 3).
