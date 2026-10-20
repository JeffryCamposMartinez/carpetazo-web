// Vista previa al compartir el enlace de una carpeta (WhatsApp, Telegram, Facebook…): esos programas no ejecutan el JavaScript del sitio,
// así que el servidor web les entrega esta página con las etiquetas Open Graph y la miniatura de la carpeta.
import express from 'express';
import { folderPreviewImage, loadFolderPreview, PREVIEW_H, PREVIEW_W } from '../core/folderPreview.js';
import { cardShareImage, loadCardPreview, loadSellerPreview, sellerShareImage } from '../core/sharePreview.js';
import { isAllowedProxyImageUrl } from '../core/validation.js';

const router = express.Router();
const SITE = 'https://carpetazo.cl';
const API = process.env.PUBLIC_API_URL || 'https://api.carpetazo.cl';
const TCG_LABELS = { Pokemon: 'Pokémon', 'Mitos y Leyendas': 'Mitos y Leyendas', OnePiece: 'One Piece', Magic: 'Magic', YuGiOh: 'Yu-Gi-Oh!', Riftbound: 'Riftbound', Lorcana: 'Disney Lorcana', Digimon: 'Digimon Card Game' };
const DEFAULT_PREVIEW = {
  title: 'Carpetazo - El mercado de Cartas TCG en Chile',
  description: 'Compra, vende y gestiona tus colecciones de cartas en Chile.',
  image: `${SITE}/images/4k/pokemon.png`,
  url: `${SITE}/`
};

const esc = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const page = ({ title, description, image, url, width, height }) => `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Carpetazo.cl">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(image)}">
${width ? `<meta property="og:image:width" content="${width}"><meta property="og:image:height" content="${height}"><meta property="og:image:type" content="image/jpeg">` : ''}
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${esc(image)}">
<meta http-equiv="refresh" content="0;url=${esc(url)}"></head><body><a href="${esc(url)}">${esc(title)}</a></body></html>`;

router.get('/api/og/folder/:id', async (req, res) => {
  res.set({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300', 'X-Robots-Tag': 'noindex' });
  try {
    const data = await loadFolderPreview(req.params.id);
    if (!data) return res.send(page(DEFAULT_PREVIEW));
    const { folder, count, signature, shown } = data;
    // Quien pide la página pedirá enseguida la imagen: se empieza a armar ya (si estaba lista, no cuesta nada)
    folderPreviewImage(signature, shown).catch(() => {});
    const owner = folder.user?.name || folder.user?.username || 'Carpetazo';
    return res.send(page({
      title: folder.name,
      description: `${count} ${count === 1 ? 'carta' : 'cartas'} de ${TCG_LABELS[folder.tcg] || folder.tcg} - ${owner}`,
      image: `${API}/api/og/folder/${folder.id}/image.jpg?v=${signature}`,
      url: `${SITE}/c/${folder.id}`,
      width: PREVIEW_W,
      height: PREVIEW_H
    }));
  } catch (error) {
    console.error('Error armando la vista previa de la carpeta:', error);
    return res.send(page(DEFAULT_PREVIEW));
  }
});

router.get('/api/og/folder/:id/image.jpg', async (req, res) => {
  try {
    const data = await loadFolderPreview(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: 'No encontrada' });
    const image = await folderPreviewImage(data.signature, data.shown);
    res.set({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400', 'X-Robots-Tag': 'noindex' });
    return res.send(image);
  } catch (error) {
    console.error('Error creando la miniatura de la carpeta:', error);
    return res.status(500).json({ success: false, message: 'No se pudo crear la imagen' });
  }
});

// Imagen para compartir una carta o un vendedor. Si no se puede armar, se entrega la foto original en vez de dejar el enlace sin imagen.
const sendShareImage = (load, render, fallback) => async (req, res) => {
  const headers = { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400', 'X-Robots-Tag': 'noindex' };
  let data = null;
  try {
    data = await load(req);
    if (!data) return res.status(404).json({ success: false, message: 'No encontrada' });
    return res.set(headers).send(await render(data.signature, data.data));
  } catch (error) {
    console.error('Error creando la imagen para compartir:', error);
    const original = data && fallback(data.data);
    if (original && isAllowedProxyImageUrl(original)) return res.redirect(302, original);
    return res.status(500).json({ success: false, message: 'No se pudo crear la imagen' });
  }
};
router.get('/api/og/card/:id/image.jpg', sendShareImage((req) => loadCardPreview(req.params.id), cardShareImage, (data) => data.imageUrl));
router.get('/api/og/seller/:username/image.jpg', sendShareImage((req) => loadSellerPreview(req.params.username), sellerShareImage, (data) => data.photoURL));

export default router;
