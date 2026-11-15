# Carpetazo Intelligence — Informe de la Etapa 4 (Analítica)

Fecha: 2026-11-15. Incluye lo pendiente de la Etapa 3. **La recolección sigue APAGADA.**

## Pendientes de la Etapa 3

| Pendiente | Resultado |
|---|---|
| Mercado Pago: forma real del pago | Confirmada en la referencia oficial: `GET /v1/payments/{id}` trae `status`, `transaction_amount`, `transaction_amount_refunded`, `date_approved`, `external_reference`; `GET /authorized_payments/{id}` trae `preapproval_id`, `external_reference` y `payment.id`. El libro ya vincula el cobro con la suscripción por `external_reference` **o** por `preapproval_id`. Prueba nueva. Sigue sin probarse contra un cobro real: revisar con el primero. |
| Política de Privacidad | **No publicada.** Borrador en `04-borrador-privacidad.md`. La sección 12 de la política promete 30 días de aviso, y subir la versión obliga a todos a aceptar de nuevo. |
| Instrumentación de flujos | Agregados: `search` (carpeta), `scan_started/succeeded/failed`, `plans_viewed`, `plan_checkout_started`, `cart_add`, `card_shared`, `folder_shared`. **Faltan:** búsqueda del catálogo público, `search_result_click`, `checkout_started`, formularios, `folder_viewed`, `card_viewed`, `profile_viewed`, `store_followed`, `store_event_signup`, login/registro. Esos embudos y paneles muestran 0 hasta instrumentarlos. |
| Interruptor de encendido | Hecho: Moderación → Inteligencia → Resumen (con auditoría). |

## Qué se construyó

**Backend** (`core/intelligenceQueries.js`, `routes/intelligence.js`; solo administradores, nivel 3):
`overview`, `traffic`, `pages`, `product`, `revenue`, `funnels`, `retention`, `health`, `explore` (+ `explore.csv`, `explore/options`), `settings` (GET/PUT).

Protecciones: rango validado (máx. 400 días, formato estricto), caché de 60 s, máximo 3 consultas simultáneas (503 si hay más), límite de 90 peticiones/min, el explorador solo acepta evento del catálogo × agrupación × medida de una lista blanca (no hay SQL libre), el CSV neutraliza fórmulas y queda en la auditoría, el encendido queda en la auditoría.

**Frontend** (Moderación → grupo «Inteligencia», 7 vistas): Resumen ejecutivo (14 cifras con valor, variación, periodo anterior, minigráfico para visitas/visitantes/sesiones, fuente y enlace al detalle), Audiencia (tráfico, origen, canal, dispositivo, navegador, sistema, zona horaria, explorador de páginas, retención D1/D7/D30), Producto, Embudos (5), Negocio, Salud técnica, Explorador de datos. Selector de periodo Hoy/Ayer/7/30/90 días/12 meses/personalizado. Gráficos SVG propios, sin librerías.

## Reglas de honestidad aplicadas

- Sin datos → «—» y un aviso con «desde cuándo se mide»; nunca 0 fingido ni estimaciones.
- Periodo que empieza antes de la primera medición → marcado «Parcial».
- Ingresos: solo pagos `approved` menos reembolsos. El «ingreso mensual estimado» está rotulado como estimado (suma de precios de suscripciones activas), separado del dinero cobrado.
- Usuarios/carpetas/cartas/pedidos pasados: rotulados «reconstruido de fechas de registro» (lo borrado no aparece).
- Embudos: una persona = su cuenta, o su navegador si no inició sesión; un paso cuenta solo si ocurrió después del anterior.

## Pruebas

- `intelligence.test.cjs` (35 comprobaciones, base y servidor reales): permisos (401/403/200), rangos inválidos, **visitas 5 ≠ visitantes 3 ≠ sesiones 4** con datos conocidos, frontera de día 23:30/00:30 de Chile, periodo parcial, fuentes, páginas, búsquedas por juego, embudo ordenado (3→1→1) con unión navegador-cuenta, **ingresos = 9.980** (aprobado + aprobado con reembolso; rechazado, reembolsado y sin verificar no suman), Web Vitals, errores, retención, explorador y su lista blanca (3 intentos rechazados), CSV con fórmula neutralizada y auditado, encendido solo por administrador.
- `analytics.test.cjs`: 42 comprobaciones (se agregó el vínculo por `preapproval_id`).
- Frontend: compila; 54 pruebas (8 nuevas: cada vista se dibuja sin datos, sin `NaN`/`undefined`).
- Suite completa del backend: 2136 correctas. Fallos que **no son de esta etapa**: la prioridad por plan (6, ya conocidos), «asignar un plan avisa…» y `GET /api/stores/me/team → 200` para una persona normal (revisar, es del módulo de tiendas). En la corrida completa, los bloques finales reciben 429 (límite global), por eso aparecen más fallos; corridos aparte pasan.

## No verificado

- **No se vio en pantalla con datos reales**: sin medición encendida no hay datos que mostrar; la vista se probó con la prueba de renderizado y compilación, no con revisión visual en navegador. Conviene mirarla en cuanto haya datos.
- Retención y embudos con volumen alto (rendimiento): las consultas usan los índices existentes y el límite de concurrencia, pero no se midieron con millones de eventos.

## Siguiente

Etapa 5 (anomalías y diagnósticos con evidencia), Etapa 6 (publicar la política con 30 días de aviso, instrumentar lo que falta, encender), Etapa 7 (validación).
