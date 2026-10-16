# Codex Carpetazo - Registro de Agente

## Sesión: 27 de Septiembre, 2026

### 1. Limpieza Extrema de Código (Limpieza de Repositorio)
- Se ejecutó un análisis profundo de dependencias usando scripts de Node.js.
- **Archivos eliminados:** Se borraron los archivos no utilizados irestore.rules, rontend/src/components/BottomNav.jsx y ackend/update_totals.js que no cumplían ninguna función en el sistema actual (basado en Prisma/PostgreSQL).
- **Dependencias eliminadas:** Se removieron los paquetes eact-pageflip y sharp del frontend y pg del backend. 

### 2. Rediseño del HeroCarousel (Enfoque P2P Singles)
- Se descartaron por completo las referencias visuales y de texto enfocadas a productos sellados o retail genérico.
- Se reescribió HeroCarousel.jsx para reflejar un modelo de negocio de **Marketplace P2P estricto** (Solo cartas sueltas / singles, comercio entre jugadores).
- Se implementaron 5 nuevos banners dinámicos, utilizando recursos propios (charizard.webp, luffy.webp, carpeta_v4.webp).
- Se corrigieron los problemas de desbordamiento (padding excesivo) que hacían que las etiquetas se cortaran en la parte superior.
- Se optimizó el renderizado de las cartas flotantes (sin rotaciones contrarias forzadas) para que los textos en su interior ("Carpeta de @usuario") se alinearan y visualizaran correctamente.

### 3. Sistema Global de Errores (404 Page)
- Se construyó desde cero una página global NotFound.jsx inspirada en la funcionalidad de GitHub pero con estética y temática TCG.
- Se integró el componente de error global en el enrutador principal (App.jsx usando <Route path="*" element={<NotFound />} />).
- **Diseño del 404:** Se empleó la estructura layout estandar (max-w-[1600px]) para conservar las franjas transparentes del fondo oceánico del sitio. El número '404' fue creado visualmente usando 3 cartas TCG gigantes flotantes que se elevan con interacción *hover*.
- Se removió la pantalla de error genérica estática dentro de SellerProfile.jsx e instruyó a redirigir automáticamente al nuevo componente <NotFound /> cuando un perfil de vendedor no se encuentra o no existe.

### 4. Modernización de la Barra de Navegación (Header)
- Se rediseñó por completo la sub-barra de navegación inferior dentro de Header.jsx.
- **Anterior:** Pestañas estilo "folder" cuadradas, pegadas a la línea inferior del menú oscuro, usando fondo celeste sólido que se sentía desconectado del entorno.
- **Actual:** Píldoras flotantes (ounded-full) minimalistas con centrado vertical completo (items-center), separación horizontal mejorada y transiciones sutiles (hover:bg-white/10). El enlace activo utiliza un diseño de píldora blanca con sombra que sobresale limpiamente.

### 5. Configuraciones del Sistema de Agente
- Se instaló globalmente la habilidad rontend-design de Anthropic (vía 
px skills add anthropics/skills) para mantener de forma automática consistencia de calidad en la composición visual, tipografía y diseño CSS de interfaces no genéricas.


## Sesión: 29 de Septiembre, 2026

### 1. Sistema Robusto de Fallbacks para Imágenes (SafeImage)
- Se identificó un problema crítico en la visualización de cartas sin imagen o con links rotos en el catálogo (FolderPokemon.jsx) y en las carpetas de usuario (AdminCardEdit.jsx), donde el navegador mostraba íconos de imagen rota o simplemente recuadros blancos vacíos.
- Se reemplazó el logo genérico de error por una interfaz limpia que muestra el escudo oficial de Carpetazo (/images/logos/logo_completo.webp) en escala de grises y semitransparente, junto al texto "SIN IMAGEN". (Se descartó el uso de avicon.png porque el archivo original estaba cortado en su borde superior).
- Se utilizaron medidas proporcionales (w-1/2, max-h-[50%]) para asegurar que el diseño de fallback escale a la perfección sin cortarse, ya sea en la grilla miniatura o en la vista ampliada (zoom).

### 2. Prevención de Errores por Re-renderizado de React
- Se descubrió que la manipulación directa del DOM (usando innerHTML dentro de eventos onError) era borrada por React cada vez que el usuario hacía scroll infinito y la grilla se re-renderizaba, resultando en cartas eternamente blancas.
- Además, si la API devolvía un string vacío ("") en lugar de un link de imagen válido, el evento onError del navegador nunca se disparaba, provocando un fallo visual silencioso.
- **Solución Final:** Se construyó un componente nativo llamado <SafeImage> en FolderPokemon.jsx utilizando React.memo y manejando estados locales (useState para error y carga). Este componente intercepta de forma proactiva (!src) los links nulos antes de dibujar la carta y es totalmente resistente a los ciclos de renderizado de React.
- Se implementó este componente en los 4 puntos críticos del catálogo: la grilla principal, la miniatura de la cola, el modal de zoom principal y el modal de zoom de la cola.
- En AdminCardEdit.jsx se aplicó una lógica equivalente con estado local imgError, corrigiendo además un bug (ReferenceError: imgError is not defined) para que las cartas guardadas en el inventario también hereden la protección visual.
