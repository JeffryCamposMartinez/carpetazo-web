# Herramientas para tiendas (plan Tienda) — diseño

## Intención
Que pagar el plan Tienda ($9.990) valga la pena por la cantidad de herramientas útiles para una tienda de cartas real: mostrar su local, llenar su local (eventos), comprar colecciones, vender con retiro, cobrar en mostrador, fidelizar clientes, ganar confianza y administrar el negocio. (Jeffry: «si una tienda paga, que tenga muchas herramientas y utilidades».)

## Metas, no metas y anti-metas
- **Metas:** los 8 bloques de abajo, exclusivos del plan Tienda; cada bloque útil por sí solo y publicable apenas esté listo; móvil primero.
- **No metas:** pagos en línea (la compra protegida es otro proyecto, ver `docs/compra-protegida.md`); varias sucursales por tienda; mapa incrustado; app nativa.
- **Anti-metas:** filtrar datos personales (dirección exacta de vendedores comunes, identidad de quienes buscan una carta); que un empleado pueda tocar cosas fuera de lo que su rol permite; cobrar o descontar algo calculado en el navegador; notificaciones que molesten (spam).

## Restricciones
- Fase 1 de seguridad en todo (propiedad, validación en servidor, serialización pública con lista blanca, errores genéricos, límites con `routeLimiter`, operaciones compuestas en transacción).
- Estructura del repo (CLAUDE.md): un router nuevo `backend/routes/stores.js` (y los que hagan falta por tema, sin importarse entre sí), lógica compartida en `backend/core/store*.js`; frontend en `frontend/src/components/store/` y archivos de menos de ~400 líneas.
- Migraciones solo aditivas (tablas o columnas nuevas, nunca borrar).
- Si la tienda deja el plan Tienda, todo lo de tienda se **oculta**, no se borra; vuelve al reactivar.

## Enfoques considerados (elegido: B)
- A. Guardar los datos del local dentro de `publicTheme` del usuario: rápido, sin migración, pero sin validación fuerte ni búsqueda (abiertas ahora, por comuna).
- **B. Ficha de tienda propia (tabla `StoreProfile` 1:1 con la cuenta)** — elegida por Jeffry: valida cada dato, permite buscar y es la base de los otros 7 bloques.
- C. Tienda como entidad separada con sucursales: demasiado para el volumen actual; se puede evolucionar desde B.

## Bloques (en orden de construcción y publicación)

### 1. Ficha del local
`StoreProfile`: activa sí/no; dirección (calle y número, referencia), comuna (validada; región deducida); horarios por día (hasta 2 tramos por día) y excepciones por fecha (cerrado / otro horario, con nota; máx. 30 futuras); medios de pago (efectivo, transferencia, débito, crédito); juegos que compra y que vende (lista cerrada de TCG del sitio) y nota de compra; hasta 6 fotos del local (subida igual que las demás imágenes, solo URLs propias); política de cambios y garantías (texto); horas de retiro (para el bloque 4).
- Perfil público y catálogo de la tienda: bloque «Tienda física» con «Abierto ahora / Cierra a las…» (calculado con la hora de Chile), dirección con botones Google Maps y Waze, pagos, compra/venta, fotos y pestaña «Política de cambios».
- Vendedores: filtro «Tiendas» y «Abiertas ahora».
- Edición en el panel: nueva sección **«Mi tienda»** con subpestañas (una por bloque).

### 2. Eventos y torneos
`StoreEvent` (título, juego, inicio, término opcional, cupos opcionales, precio de inscripción en pesos, formato, descripción, estado programado/cancelado/terminado, nota de resultados) y `StoreEventSignup` (inscrito / lista de espera, una por persona).
- Público: próximos eventos en el perfil, «Inscribirme» con sesión, cupos restantes; lista de espera automática.
- Recordatorio 24 h antes por push y correo a inscritos (tarea programada, una vez por evento).
- La inscripción se paga en el local (sin pagos en línea).

### 3. Compra de colecciones («Vende tu colección»)
`StoreBuyRequest`: la persona manda a la tienda una lista de cartas (escrita, importada por CSV o agregada con el escáner), fotos (máx. 6) y nota; la tienda responde con una oferta total y nota; estados pendiente → ofertada → aceptada / rechazada / cancelada. Conversación por el chat existente. La tienda define qué juegos compra (bloque 1); el precio lo pone la tienda (sin cálculo automático).

### 4. Reserva con retiro en tienda
Nuevo tipo de pedido `via: 'pickup'` sobre el flujo de pedidos existente (que ya reserva stock): plazo de retiro según la tienda (24–72 h), código de retiro corto, estados pendiente → listo para retirar → retirado / vencido / cancelado. Al vencer se libera el stock. La tienda ve «Retiros de hoy». Solo con sesión.

### 5. Caja y stock
Sobre las ventas en persona existentes: medio de pago por venta, **cierre de caja diario** (totales por medio de pago y por día), agregar cartas a la venta con el escáner (modo búsqueda del escáner con una acción de «agregar a la venta»), alertas de poco stock (umbral configurable) y de cartas sin movimiento en N días, y **etiquetas de precio con QR** imprimibles (PDF) que llevan a la ficha de la carta.

### 6. Fidelización
- `StoreFollow`: seguir a una tienda; avisos (push/correo) de eventos nuevos y ofertas, como máximo 1 aviso por tienda al día por seguidor, con opción de dejar de seguir.
- `StoreCoupon`: código, % o monto fijo, compra mínima, vigencia, usos máximos y por persona; se aplica al crear pedidos (y opcional en ventas en persona); **el descuento se calcula y se descuenta en el servidor**, el uso se cuenta en la misma transacción.
- **Demanda**: «N personas buscan esta carta» a partir de listas de deseadas, solo conteos agregados, solo cartas con 2 o más interesados, nunca quiénes.

### 7. Confianza
- **Tienda verificada**: la tienda sube foto de la fachada con el nombre visible y, opcional, documento de la empresa; Moderación aprueba o rechaza (cola nueva en Moderación, igual que las verificaciones de identidad) → insignia «Tienda verificada». Las imágenes de verificación no son públicas.
- Política de cambios (bloque 1) y ventas completadas visibles en el perfil.

### 8. Herramientas del dueño
- **Resumen semanal por correo** (lunes): visitas, cartas más vistas, reservas, ventas, seguidores nuevos, eventos.
- **Informe de ventas** descargable (CSV) por rango de fechas: ventas en persona y pedidos completados.
- **Empleados** `StoreMember` con dos roles: *caja* (ventas en persona y retiros) y *stock* (cartas de las carpetas de la tienda). Invitación por usuario; el empleado acepta; el dueño revoca. Un único chequeo de permisos en `core/` usado por las rutas afectadas; un empleado nunca ve datos bancarios, plan, ajustes ni informes.

## Decisiones tomadas por mí (corregibles)
- Mapa con botones a Google Maps/Waze, sin mapa incrustado.
- Dirección exacta visible solo en tiendas con plan Tienda que la escriban; el resto sigue mostrando solo la comuna.
- Eventos y colecciones sin pagos en línea.
- Cupones válidos en pedidos y, si la tienda quiere, en ventas en persona.
- Avisos a seguidores: máximo 1 por tienda al día.
- Verificación con foto de fachada; documento opcional; decide Moderación.
- Empleados: solo dos roles fijos (caja y stock).

## Lo que queda para quien construye
Nombres exactos de columnas e índices, textos de la interfaz con la voz de Carpetazo, diseño visual siguiendo el estilo del sitio (azul y amarillo, LiquidTabs donde haya opción activa), pruebas por bloque (sesión: propio vs ajeno, sin plan, datos inválidos; frontend: lógica pura como «abierto ahora»), y la retención de datos de las tablas nuevas.

## Riesgos
- Bloque 8 (empleados) toca permisos en rutas existentes: se hace al final, con pruebas de propiedad exhaustivas.
- Bloque 6 (cupones) toca dinero: cálculo solo en servidor, en transacción, con pruebas de abuso (repetir, combinar, vencido, sin cupos).
- Volumen de trabajo: varias semanas en total; se publica bloque por bloque.
