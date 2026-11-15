# Carpetazo Intelligence — Etapa 2: Diseño técnico

Fecha: 2026-11-15. Basado en `01-auditoria.md`. **Nada de esto está implementado todavía.** Las decisiones marcadas con ⚖ necesitan tu aprobación.

## 1. Principios

1. Se integra en **Moderación**, nueva pestaña principal «Inteligencia». Nada de app aparte.
2. Solo **administradores (nivel 3)**, separado de las colas de moderación.
3. **Sin infraestructura nueva**: PostgreSQL actual, un proceso Node. Sin Redis, sin ClickHouse, sin servicios de terceros. Se justifica abajo y se revisa al crecer.
4. **Datos reales o nada.** Lo reconstruido desde registros se rotula «reconstruido»; lo medido, «medido desde <fecha>»; lo estimado, «estimado».
5. **Mínimo dato personal**: sin IP, sin contraseñas, tokens, cookies, pagos ni contenido de mensajes. Sin cookies de seguimiento.

## 2. Modelo de datos (migraciones solo aditivas)

| Tabla | Qué guarda | Notas |
|---|---|---|
| `AnalyticsEvent` | Evento crudo: `id` (UUID del cliente, único = deduplica), `name`, `at`, `visitorId`, `sessionId`, `userId?` , `path`, `props` (JSON ≤ 1 KB), `device`, `browser`, `os`, `viewport`, `source`, `medium`, `campaign`, `tzGuess` | Solo-añadir. Índices `(at)` BRIN, `(name, at)`, `(sessionId, at)`, `(path, at)`. Retención configurable (por defecto **90 días**) |
| `AnalyticsSession` | Resumen por sesión: inicio, fin, entrada, salida, páginas, eventos, activa s, `userId?`, fuente, dispositivo | Se actualiza al cerrar la ventana de 30 min de inactividad |
| `AnalyticsDaily` | Agregado por día: `(day, metric, dim1, dim2, value)` | Alimenta casi todos los paneles. Retención **25 meses** |
| `BusinessDaily` | Foto diaria de cifras de negocio: usuarios, carpetas, cartas, deseadas, suscriptores por plan, MRR estimado | Se llena hacia atrás **solo con lo reconstruible por fechas** (registros, carpetas, cartas, pedidos, suscripciones) |
| `PaymentLedger` ⚖ | Pagos individuales de Mercado Pago (id, estado, monto, fecha, suscripción) | Permite «ingresos confirmados». Ver etapa 3 |
| `AnalyticsSettings` | Retención, activar/pausar, umbrales de alertas, opt-out global | Una fila |
| `AnalyticsAnomaly` | Hallazgos: métrica, ventana, valor esperado vs observado, evidencia, estado | Solo lectura para el panel |
| `AnalyticsSavedReport` | Informes personalizados guardados (definición JSON) | |

Se reutilizan `MetricDay` (contadores existentes), `FolderVisitDay`, `ErrorEvent` y `ModerationAudit` (auditoría de accesos y exportaciones, con acciones `analytics.view` y `analytics.export`).

## 3. Recolección

**Frontend** (`frontend/src/analytics/`): un módulo pequeño (`track(name, props)`) con:
- `visitorId` aleatorio en `localStorage` (sin cookie, sin huella digital); `sessionId` que se renueva tras 30 min sin actividad.
- Cola en memoria; se envía en lotes cada 5 s y al ocultar la pestaña con `navigator.sendBeacon` a `POST /api/analytics/collect`.
- `page_view` automático en cada cambio de ruta (el sitio es una SPA), tiempo activo por página (solo pestaña visible y con actividad), profundidad de scroll por hitos (25/50/75/100 %), Web Vitals (LCP, INP, CLS, TTFB), errores de JavaScript, UTM y `document.referrer`.
- Respeta **Do Not Track / Global Privacy Control** y un interruptor «No medir mi uso» en la cuenta y en el pie (⚖).
- Nunca bloquea la interfaz; si falla, descarta.

**Backend:**
- `POST /api/analytics/collect`: valida contra el **catálogo de eventos**, límite por conexión (`routeLimiter`), cuerpo ≤ 32 KB y ≤ 50 eventos, deduplica por `id`, descarta propiedades no permitidas. Responde `204`.
- Los eventos del servidor se emiten desde los puntos donde ocurren los hechos (registro, carpeta creada, carta añadida, pedido, pago, error, escáner), con `userId`, sin pasar por el navegador: son los que sirven para **ingresos, conversiones y cohortes** porque no se pueden falsear ni bloquear.
- **Cola en memoria con vaciado por lotes** (cada 2 s o 200 eventos, `createMany`). Si el proceso muere se pierden como máximo los eventos de ese intervalo; es aceptable para analítica y no para dinero (el dinero sale de `PaymentLedger`, no de eventos).
- Latencia por endpoint: un middleware mide la duración y la acumula en memoria por `(método, ruta normalizada, estado)` en ventanas de 1 minuto → `AnalyticsDaily` (no un evento por petición).
- **Catálogo de eventos** (`backend/core/analyticsCatalog.js` y copia en el frontend, con una prueba que exige que sean idénticos): nombre, descripción, origen (web/servidor), propiedades permitidas con tipo y máximo. Un evento fuera del catálogo se rechaza.

Eventos iniciales (≈45): navegación (`page_view`, `page_leave`, `scroll_depth`, `web_vital`, `js_error`), cuenta (`signup_started`, `signup_completed`, `login`, `login_failed`), carpetas (`folder_created`, `folder_viewed`, `folder_shared`, `card_added`, `card_removed`), búsqueda y catálogo (`search`, `search_result_click`, `filter_used`, `card_viewed`, `card_shared`, `wishlist_item_added`), escáner (`scan_started`, `scan_succeeded`, `scan_failed`), pedidos (`cart_add`, `checkout_started`, `order_created`), planes (`plans_viewed`, `checkout_started_plan`, `subscription_confirmed`, `subscription_canceled`), perfiles y tienda (`profile_viewed`, `store_followed`, `event_signup`, `pickup_reserved`), formularios (`form_started`, `form_completed`, `form_abandoned`) y `ui_click` para botones etiquetados con `data-track`.

## 4. Agregación y consultas

- **Trabajo nocturno** (a las 03:30, hora de Chile, mismo mecanismo de tareas ya usado por el catálogo): consolida el día anterior en `AnalyticsDaily` y `BusinessDaily`, cierra sesiones, aplica la **retención** (borra eventos crudos vencidos) y corre la detección de anomalías. Además, una consolidación liviana del día en curso cada 10 min para «Tiempo real» y «Hoy».
- Los paneles leen **solo agregados** y las tablas de analítica; **nunca** consultan en vivo las tablas transaccionales grandes (`Card`, `Message`). Las cifras de negocio salen de `BusinessDaily` (calculada de noche).
- Cada endpoint del panel: paginación, rango máximo 366 días, `statement_timeout` de 8 s, caché en memoria de 60 s por consulta y por administrador, límite de frecuencia.
- Embudos, cohortes y recorridos se calculan sobre `AnalyticsSession`/`AnalyticsEvent` con ventanas acotadas y resultados cacheados.

## 5. Explorador e informes sin SQL libre

El explorador y el constructor de informes trabajan con una **lista blanca**: métricas (`visitas`, `visitantes únicos`, `sesiones`, `eventos`, `conversiones`…), dimensiones (`día`, `página`, `dispositivo`, `navegador`, `fuente`, `juego TCG`, `evento`…) y filtros con valores validados. El servidor traduce a consultas parametrizadas fijas; el navegador nunca envía SQL. Exportación CSV con tope de filas, auditada.

## 6. Inteligencia (anomalías y diagnósticos)

- **Método simple y explicable**: se compara cada métrica con su valor esperado = promedio y desviación de las mismas jornadas (mismo día de la semana) de las últimas 4–8 semanas; se alerta cuando se aleja más de N desviaciones **y** supera un mínimo de volumen (para no alarmar con 3 visitas).
- Cada hallazgo guarda: qué pasó, cuándo, métricas involucradas, la evidencia (cifras y ventanas), causas posibles a investigar y acciones sugeridas, con una etiqueta explícita **observación / correlación / hipótesis**. **Nunca** «causalidad demostrada» salvo cambios medidos de forma controlada, que hoy no existen.
- Reglas de ejemplo: visitas ↑ y cartas añadidas ↓; registros ↓; errores ↑; búsquedas sin resultados ↑; páginas con muchas visitas y poca interacción; latencia ↑.
- Alertas: dentro del panel y, opcionalmente, por correo a administradores (ya existe el envío).
- Hasta tener ≥ 4 semanas de datos no se generan anomalías de tendencia (se explica en pantalla).

## 7. Interfaz dentro de Moderación

Se agrega un **grupo principal «Inteligencia»** junto a los actuales (Cola de trabajo, Personas, Catálogo, Sistema). Los 20 módulos del encargo se agrupan en 6 secciones de navegación para no crear 20 pestañas:

| Sección | Módulos del encargo |
|---|---|
| **Resumen** | 1 Resumen ejecutivo («CARPETAZO INTELLIGENCE»), 2 Tiempo real |
| **Audiencia** | 3 Tráfico y navegación, 4 Páginas, 5 Usuarios, 14 Retención, 12 Marketing |
| **Producto** | 6 Carpetas, 7 Cartas y catálogo, 8 Wishlist, 9 Búsquedas, 10 Interacciones sociales |
| **Negocio** | 11 Monetización, 13 Funnels |
| **Salud técnica** | 15 Rendimiento, 16 Errores, 17 Anomalías |
| **Herramientas** | 18 Explorador, 19 Informes, 20 Configuración |

Se respetan las 17 pestañas actuales; «Métricas» y «Operación» se enlazan desde Inteligencia en lugar de duplicarse.

**Diseño visual:** superficies planas, jerarquía por tipografía y alineación, tablas densas y legibles, **gráficos SVG propios** (líneas, barras, matriz de retención, embudo, diagrama de recorridos), sin degradados, sin brillos, sin vidrio, sin tarjetas por reflejo. Cada gráfico responde una pregunta y muestra su comparación con el período anterior. Estados vacíos que dicen «medido desde <fecha>». Responsive con tablas desplazables.

## 8. Seguridad y privacidad

- Todos los endpoints `/api/admin/intelligence/*` con `authenticateToken` + `requireStaff(3)` y chequeo en el servidor; la web solo oculta lo que no corresponde.
- `ModerationAudit` registra apertura de informes sensibles y toda exportación (quién, qué, filtros, filas).
- Sin IP, sin cookies; `visitorId` aleatorio y reiniciable; `userId` solo en eventos de sesión iniciada. Los paneles muestran agregados; el detalle por persona solo para administradores y no incluye contenido de mensajes ni datos de pago.
- Retención de eventos crudos configurable (90 días por defecto); borrado por cuenta eliminada.
- Se debe actualizar la **Política de Privacidad** (nueva versión legal) para describir la analítica propia, qué se mide, la retención y cómo no ser medido. ⚖ Conviene revisarlo con un abogado por la Ley 21.719 (vigente desde el 1 de diciembre de 2026).

## 9. Plan por etapas y criterios de «terminado»

| Etapa | Entrega | Terminado cuando |
|---|---|---|
| 3 Infraestructura | Migraciones, catálogo, `track()` + `/collect`, cola por lotes, sesiones, middleware de latencia, trabajo nocturno, retención, `PaymentLedger` y su webhook | Eventos reales llegan, no se duplican, pruebas de sesiones/visitantes/zonas horarias, sin bajar el rendimiento |
| 4 Analítica | Los módulos de Audiencia, Producto, Negocio y Salud técnica, filtros, embudos, cohortes, explorador | Cada cifra coincide con su fuente en pruebas; sin datos simulados |
| 5 Inteligencia | Anomalías, diagnósticos, alertas | Reglas probadas con series sintéticas **solo en pruebas** |
| 6 Integración | Grupo «Inteligencia» en Moderación, permisos, auditoría | Las 17 pestañas actuales siguen funcionando |
| 7 Validación | Seguridad, carga, exactitud, revisión visual en celular y escritorio | Informe final con pruebas ejecutadas |

## 10. Justificación de «sin infraestructura nueva»

Con unos cientos o miles de visitas al día, PostgreSQL con inserciones por lote, índices y agregación nocturna basta con holgura: 10.000 eventos/día ≈ 300.000/mes ≈ 0,3 GB/mes de crudos. Si Carpetazo superara ~5–10 millones de eventos/mes, el siguiente paso razonable sería particionar la tabla por mes y, después, evaluar un almacén columnar. No se justifica antes.

## 11. Decisiones que necesito de ti ⚖

1. **Medición y privacidad:** ¿sin cookies, con `visitorId` en el navegador, respetando «No rastrear» y con interruptor de exclusión (recomendado), o prefieres un aviso de consentimiento previo al primer evento?
2. **Ingresos confirmados:** ¿autorizas agregar el registro real de pagos de Mercado Pago (`PaymentLedger` + tema de pagos del webhook)? Sin esto, el panel mostrará solo «MRR estimado».
3. **País/región:** ¿te basta la aproximación por zona horaria e idioma, o prefieres incorporar una base GeoIP (más precisa, guarda país derivado de la IP sin almacenar la IP)?
4. **Retención de eventos crudos:** ¿90 días (recomendado) u otro plazo?
