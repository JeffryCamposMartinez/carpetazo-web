# Dominio propio para las imágenes (img.carpetazo.cl)

Hoy las imágenes se sirven por `https://pub-1ba0fdf5c93c4412abbc2b234780b3c6.r2.dev`. Esa dirección sirve para pruebas: tiene límites de tráfico, no usa la caché de Cloudflare y no se puede controlar. Un dominio propio da más velocidad (caché en la red de Cloudflare), menos operaciones de lectura facturables y la libertad de cambiar de proveedor sin romper las direcciones.

## Estado del código (ya preparado, sin efecto hasta activarlo)
- `R2_PUBLIC_URL` define la dirección pública actual. Toda la web nueva la usa (`r2PublicUrl`, subidas, catálogo).
- `R2_PUBLIC_URL_LEGACY` (opcional, varias separadas por coma) es la dirección anterior: el backend la sigue aceptando para validar imágenes y para borrar archivos viejos mientras la base tenga direcciones antiguas.
- El CSP de la web (`frontend/index.html` y `frontend/nginx.conf`) ya permite `https://img.carpetazo.cl` en `img-src`.
- `backend/scripts/db/rewrite_image_host.cjs` reescribe las direcciones guardadas en la base. Por defecto solo cuenta; con `--apply` cambia. En la base de desarrollo muestra, por ejemplo, 23.582 `TcgProduct.imageUrl`, además de fotos de perfil y de listas de deseadas.

## Lo que falta y es decisión tuya: dónde vive el DNS
`carpetazo.cl` usa los servidores de nombres de Hostinger (`*.dns-parking.com`). Un dominio propio de R2 **exige que el dominio esté en Cloudflare**. Dos caminos:

**A. Pasar el DNS de carpetazo.cl a Cloudflare (recomendado).**
1. En Cloudflare: Agregar sitio → `carpetazo.cl` (plan gratis). Cloudflare importa los registros que encuentre; compara uno por uno con los de Hostinger (A de `@`, `api`, `coolify`, MX y TXT del correo, etc.) y agrega los que falten **antes** de cambiar nada.
2. En Hostinger (dominios): cambia los servidores de nombres a los que indique Cloudflare. Tarda desde minutos hasta unas horas; el correo y la web deben seguir funcionando todo el tiempo si los registros quedaron iguales.
3. En R2 → bucket `carpetazo-imagenes` → Configuración → **Dominios personalizados** → agregar `img.carpetazo.cl`. Cloudflare crea el registro y el certificado solo.
4. Reglas de caché opcionales (Reglas → Reglas de caché): caché larga para `img.carpetazo.cl/*` (las imágenes casi nunca cambian).

**B. Dejar el DNS donde está.** Entonces no hay dominio propio de R2. Habría que servir las imágenes por un proxy con caché en el VPS (`img.carpetazo.cl` apuntando al VPS). Funciona, pero gasta el ancho de banda y el disco del VPS. No lo recomiendo.

## Activación (cuando `img.carpetazo.cl` ya sirva una imagen de prueba)
1. Probar: `https://img.carpetazo.cl/Carpetazo.cl/Sin_Imagen/Carpetazo_TCG_Sin_Imagen.webp` debe abrir la imagen.
2. Hacer respaldo: `node scripts/db/backup_db.cjs`.
3. En Coolify (backend): `R2_PUBLIC_URL=https://img.carpetazo.cl` y `R2_PUBLIC_URL_LEGACY=https://pub-1ba0fdf5c93c4412abbc2b234780b3c6.r2.dev`; reiniciar.
4. Reescribir la base, primero en seco: `node scripts/db/rewrite_image_host.cjs https://pub-1ba0fdf5c93c4412abbc2b234780b3c6.r2.dev https://img.carpetazo.cl` y luego con `--apply`.
5. Cambiar `NO_IMAGE_CARD_URL` en `frontend/src/utils/cardShape.js` y, en el motor del escáner, la variable que use la dirección pública para el espejo (revisar `visor`).
6. Publicar la web y comprobar fotos de perfil, cartas y banners. Cuando todo esté estable unos días, quitar `R2_PUBLIC_URL_LEGACY` y el host `r2.dev` del CSP.

## Reversa
Volver `R2_PUBLIC_URL` a la dirección de `r2.dev` y ejecutar el script con las direcciones al revés. Los archivos en R2 nunca se mueven ni se borran en este proceso.
