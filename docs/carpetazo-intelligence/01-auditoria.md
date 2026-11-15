# Carpetazo Intelligence — Etapa 1: Auditoría

Fecha: 2026-11-15. Alcance: backend, base de datos, frontend, Moderación, permisos, legal y todo lo que hoy mide el sitio. Se leyó el código; no se inventó nada. Lo que no existe está marcado como **futuro**.

## 1. Tamaño del proyecto

| Capa | Dato |
|---|---|
| Backend | Express + Prisma + PostgreSQL, 246 endpoints en 41 routers (≈9.000 líneas de rutas), 62 migraciones |
| Base de datos | 56 modelos (usuarios, carpetas, cartas, pedidos, planes, tienda, catálogo TCG, moderación, escáner…) |
| Frontend | React 19 + Vite, 19 páginas y 1 ruta dinámica por vendedor (`/:sellerUsername`), sin librería de gráficos |
| Moderación | `/moderacion`, 17 pestañas en 4 grupos; permisos por nivel (1 soporte, 2 moderador, 3 administrador, 99 propietario) |
| Infraestructura | 1 VPS con Coolify, 1 PostgreSQL, sin cola ni Redis, imágenes en Cloudflare R2 |

## 2. Lo que YA se mide hoy (y sus límites)

| Fuente | Qué guarda | Límite para este proyecto |
|---|---|---|
| `MetricDay` | Contadores anónimos por día: `plans_view`, `plan_cta`, `share_card`, `share_folder`, `search_popular`, `search_empty`, `search_no_offers` | Solo «cuántas veces», sin sesión, usuario, página ni dispositivo. Imposible armar embudos ni retención |
| `FolderVisitDay` + `Folder.totalVisits/weeklyVisits` | Visitas a carpetas por día y origen (directo / interno / externo) | Solo carpetas. Sin visitante único, sin usuario |
| `ErrorEvent` | Errores de servidor, web y HTTP agrupados por huella, con conteo | Sin latencia, sin navegador, sin usuario afectado |
| `ScanEvent` / `ScanUsage` / `ScanChoice` | Revisión de imágenes (proveedor, veredicto, ms) y elecciones del escáner | Solo moderación de imágenes y escáner |
| `Subscription`, `BillingEvent`, `PlanGrant`, `SubscriptionPayment` | Suscripciones con plan, precio CLP, estado (`pending/active/past_due/paused/canceled`), fechas y cancelación programada; eventos del webhook; concesiones manuales | **`SubscriptionPayment` existe pero ningún código la escribe**: el webhook solo sincroniza el estado de la suscripción (`syncPreapproval`). Alcanza para suscriptores, MRR estimado (activas × precio) y cancelaciones; **no** para ingresos confirmados, pagos rechazados ni reembolsos |
| `User.createdAt/lastSeenAt`, `Folder`, `Card`, `Wishlist(Item)`, `Order`, `InPersonSale`, tienda (`StoreEvent`, `StoreBuyRequest`, `StoreFollow`, `StoreCouponUse`…) | Fechas de creación y estados | Permiten **reconstruir** series de crecimiento hacia atrás |
| `/api/admin/ops/*`, pestaña «Operación» y «Métricas» | Errores recientes, un embudo simple, ranking de búsquedas, métricas de moderación | Es lo que se amplía; no se reemplaza |

**No existe hoy:** tabla de eventos, sesiones, visitantes únicos, página de entrada/salida, UTM/referencias, dispositivo/navegador, tiempo activo, profundidad de scroll, Core Web Vitals, latencia por endpoint, GeoIP, formularios iniciados/abandonados, clics.

## 3. Inventario de funcionalidades y qué información produce cada una

Solo funcionalidades **actuales**. «Hoy» = ya queda en la base; «Falta» = hay que instrumentarlo.

| Ruta / área | Funcionalidad actual | Hoy | Falta (evento) |
|---|---|---|---|
| `/` Inicio | Portada, carrusel, atajos, bienvenida | Nada propio | `page_view`, clic en CTA y atajos, visibilidad del carrusel |
| `/bienvenida` | Landing de vendedores / registro | Nada | vista, clic «Crear cuenta», inicio de login |
| Registro / login | Google, correo, aceptación de términos, usuario | `User.createdAt`, `TermsAcceptance` | `signup_started`, `signup_completed`, `login`, fallos de auth |
| `/dashboard` | Carpetas, Deseadas, Solicitudes, Historial, **Mi tienda** (12 secciones) | Carpetas, pedidos, tienda en sus tablas | `folder_create_opened`, pestañas visitadas |
| `/carpeta/:id` | Edición: agregar (catálogo/escáner/CSV), venta presencial, ajustes | `Card.createdAt`, `InPersonSale` | `card_added` (origen: búsqueda/escáner/CSV), `card_removed`, formulario abandonado |
| `/c/:folderId` | Catálogo público, carrito, pedido (WhatsApp/mensaje/retiro), cupones | `FolderVisitDay`, `Order` | `folder_view` con visitante, `cart_add`, `checkout_started`, `order_created` |
| `/cartas`, `/cartas/catalogo` | Buscador y catálogo TCG, filtros, escáner | `MetricDay` (búsquedas), `ScanChoice` | `search` (con juego, filtros, nº de resultados), `search_result_click`, `filter_used`, `scan_started/succeeded/failed` |
| `/carta/:id`, `/catalogo/:id` | Ficha de carta, precios, ofertas | `CardPriceSnapshot` | `card_view`, `card_share`, `wishlist_add` |
| `/vendedores`, `/:usuario` | Directorio y perfil público (tienda, eventos, seguir) | Visitas no | `profile_view`, `profile_share`, `store_follow`, `message_started` |
| `/mensajes` | Chat entre usuarios | `Message` | `chat_opened`, `message_sent` (sin contenido) |
| `/planes` | Planes y compra (Mercado Pago) | `MetricDay` (`plans_view`, `plan_cta`), `Subscription`, `SubscriptionPayment` | `checkout_started`, `checkout_abandoned` |
| `/perfil` | Cuenta, verificación de identidad, Estudio de perfil | `IdentityVerification`, `User` | `verification_started/submitted` |
| `/sugerencias` | Reclamos y sugerencias | `Feedback` | `feedback_started/sent` |
| `/terminos`, `/privacidad` | Legal | — | `page_view` |
| `/moderacion` | 17 pestañas de moderación | `ModerationAudit` | (se audita, no se mide el uso del equipo) |
| Mi tienda (bloques 1–8) | Ficha, eventos, retiros, caja, cupones, equipo, informe | Sus tablas propias | `store_*` por flujo |

## 4. Cobertura de las preguntas de negocio (secciones A–H del encargo)

| Bloque | Responde con datos que **ya existen** | Necesita eventos nuevos |
|---|---|---|
| A. Usuarios | Total, registros por día, tipo de plan, antigüedad, `lastSeenAt` (aprox. de activos) | DAU/WAU/MAU reales, retención, conversión visitante→registro, reactivación |
| B. Carpetas | Creadas, públicas/privadas, cartas por carpeta, visitas por día, abandono (sin cartas) | Compartidas, crecimiento diario de cartas añadidas vs eliminadas (se reconstruye lo añadido, no lo eliminado) |
| C. Catálogo | Distribución por juego/edición/idioma/rareza, propietarios por carta (`Card`), deseadas (`WishlistItem`), demanda (`storeDemand`), imágenes faltantes | Cartas más consultadas, más buscadas, compartidas |
| D. Wishlist | Listas, ítems, usuarios, cartas más deseadas | Conversión a colección (se puede cruzar con `Card`) |
| E. Búsquedas | `search_popular`, `search_empty`, `search_no_offers` (solo conteo por texto) | Tasa de éxito, tiempo hasta resultado, abandono, filtros |
| F. Perfiles/social | `StoreFollow`, `Message`, reseñas | Visitas a perfil, compartidos, tráfico generado |
| G. Monetización | Suscriptores por plan, MRR/ARR **estimados** desde suscripciones activas, altas, cancelaciones, churn y ARPU a partir de fechas de suscripción | **Libro de pagos real** (pagos aprobados, rechazados, reembolsos) leyendo los pagos de Mercado Pago, y el embudo Free→Pro (visita a Planes → compra) |
| H. Marketing | Nada | Referencias, UTM, canales, landing, retención por fuente |
| Técnico | `ErrorEvent` (errores) | Latencia por endpoint, Web Vitals, errores por navegador, consultas lentas |

## 5. Hallazgos que condicionan el diseño

1. **Datos retroactivos:** solo se pueden reconstruir hechos que dejaron fila con fecha (registros, carpetas, cartas añadidas, pedidos, pagos, listas). **No** se pueden reconstruir visitas, sesiones, páginas, clics ni retención de uso. La interfaz debe decir «recopilando desde <fecha>».
2. **No hay librería de gráficos** y el sitio cuida el peso: los gráficos se dibujan con SVG propio, sin dependencias nuevas.
3. **Privacidad:** la Política de Privacidad afirma «no usamos cookies de publicidad ni de analítica de terceros». Una analítica propia, sin cookies y sin terceros, es compatible, pero hay que **actualizar el texto** (nueva versión legal) y ofrecer una forma de no ser medido. La Ley 21.719 de protección de datos personales entra en vigencia el 1 de diciembre de 2026: conviene revisar el diseño con un abogado. Esto no es asesoría legal.
4. **Permisos:** `requireStaff(3)` ya separa a administradores. La analítica irá solo en nivel 3 y separada de las acciones de moderación de contenido.
5. **País/región:** el API no está detrás de un proveedor que entregue país. Sin una base GeoIP no se puede dar país; se puede dar una aproximación por zona horaria e idioma del navegador. No se guardará la IP.
6. **Rendimiento:** una sola base. Los eventos no pueden escribirse uno por uno en la ruta de cada petición; se agrupan en memoria y se insertan en lote.
7. **Ingresos:** hoy no hay registro de pagos individuales. Para cumplir «ingresos = transacciones confirmadas» hay que sumar al webhook el tema de pagos (`payment` / `authorized_payment`) y consultar cada pago a Mercado Pago, o hacer una conciliación periódica. Mientras no exista, el panel mostrará **MRR estimado** rotulado como estimado, nunca como ingreso confirmado.
8. **Tests existentes:** hay 21 fallas previas no relacionadas (prioridad por plan, QA 13/14, SEG 19/20); el trabajo nuevo no debe sumar fallas.

## 6. Qué NO existe hoy (funcionalidades futuras, no se instrumentan)

Seguidores de perfiles de usuario (solo existen seguidores de **tiendas**), compartir perfil/carpeta con registro del destino, reembolsos desde la plataforma (se gestionan en Mercado Pago), segmentos de marketing propios, anuncios pagados con identificador de campaña (las UTM se leerán de la URL si llegan).
