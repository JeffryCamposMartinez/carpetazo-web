// SEO: los buscadores (Google, Bing…) reciben una página con el contenido ya escrito para cartas y vendedores, y un sitemap con todo lo público.
// Solo se usa información pública: cartas visibles con stock en carpetas públicas y visibles, y vendedores con alguna carpeta pública.
import express from 'express';
import { prisma } from '../core/db.js';
import { restrictions } from '../moderation/services.js';
import { isAllowedProxyImageUrl, isUuid } from '../core/validation.js';

const router = express.Router();
const SITE = 'https://carpetazo.cl';
const TCG_LABELS = { Pokemon: 'Pokémon', 'Mitos y Leyendas': 'Mitos y Leyendas', OnePiece: 'One Piece', Magic: 'Magic', YuGiOh: 'Yu-Gi-Oh!', Riftbound: 'Riftbound' };
const visibleCard = { stock: { gt: 0 }, moderationState: 'visible', folder: { isPublic: true, moderationState: 'visible' } };
const USERNAME = /^[A-Za-z0-9_.-]{3,30}$/;
const OFFERS_SHOWN = 20;
const SITEMAP_MAX_CARDS = 40000; // el límite de un sitemap es 50.000 direcciones
const SITEMAP_TTL_MS = 60 * 60 * 1000;

const esc = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const clp = (value) => `$${Math.round(Number(value) || 0).toLocaleString('es-CL')}`;
const text = (value, max = 300) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const field = (data, key) => (data && typeof data === 'object' ? text(data[key], 120) : '');
const cut = (value, max) => (value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value);

const page = ({ title, description, url, image, jsonLd, body }) => `<!doctype html>
<html lang="es-CL"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Carpetazo.cl"><meta property="og:locale" content="es_CL">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(url)}">
${image ? `<meta property="og:image" content="${esc(image)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${esc(image)}">` : ''}
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>` : ''}
</head><body>${body}</body></html>`;

const notFound = (res) => res.status(404).set({ 'Cache-Control': 'public, max-age=60' }).type('text/plain').send('No encontrada');
const sendPage = (res, html) => res.set({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=900' }).send(html);

// Página de una carta: todas las ofertas visibles de la misma carta y juego
router.get('/api/seo/card/:id', async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res);
    const card = await prisma.card.findFirst({
      where: { id: req.params.id, ...visibleCard },
      select: { tcgId: true, name: true, imageUrl: true, data: true, folder: { select: { tcg: true } } }
    });
    if (!card) return notFound(res);
    const tcg = card.folder.tcg;
    const offers = await prisma.card.findMany({
      where: { ...visibleCard, tcgId: card.tcgId, folder: { ...visibleCard.folder, tcg } },
      orderBy: [{ price: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: OFFERS_SHOWN,
      select: { id: true, price: true, stock: true, folder: { select: { name: true, user: { select: { name: true, username: true, publicComuna: true } } } } }
    });
    const prices = offers.map((offer) => offer.price).filter((price) => Number.isFinite(price) && price > 0);
    const low = prices.length ? Math.min(...prices) : null;
    const high = prices.length ? Math.max(...prices) : null;
    const game = TCG_LABELS[tcg] || tcg;
    const set = field(card.data, 'set');
    const rarity = field(card.data, 'rarity');
    const name = text(card.name, 120);
    const url = `${SITE}/carta/${offers[0]?.id || req.params.id}`; // todas las copias de la misma carta apuntan a la oferta más barata
    const sellers = new Set(offers.map((offer) => offer.folder.user?.username || offer.folder.name)).size;
    const title = cut(`${name}${set ? ` (${set})` : ''} - ${game}${low ? ` desde ${clp(low)}` : ''} | Carpetazo`, 70);
    const description = cut(`Compra ${name} de ${game}${set ? `, edición ${set}` : ''} en Chile. ${offers.length} ${offers.length === 1 ? 'oferta' : 'ofertas'} de ${sellers} ${sellers === 1 ? 'vendedor' : 'vendedores'}${low ? ` desde ${clp(low)}` : ''}.`, 160);
    const image = card.imageUrl && isAllowedProxyImageUrl(card.imageUrl) ? card.imageUrl : null;
    const jsonLd = {
      '@context': 'https://schema.org', '@type': 'Product', name, ...(image ? { image } : {}), url,
      description: cut(`${name} - carta de ${game}${set ? `, ${set}` : ''}${rarity ? `, ${rarity}` : ''}.`, 200),
      category: `Cartas coleccionables - ${game}`,
      ...(low ? { offers: { '@type': 'AggregateOffer', priceCurrency: 'CLP', lowPrice: Math.round(low), highPrice: Math.round(high), offerCount: offers.length, availability: 'https://schema.org/InStock' } } : {})
    };
    const list = offers.map((offer) => {
      const seller = offer.folder.user;
      const who = text(seller?.name || seller?.username || 'Vendedor', 60);
      const place = seller?.publicComuna ? `, ${esc(text(seller.publicComuna, 60))}` : '';
      return `<li>${offer.price ? esc(clp(offer.price)) : 'Precio a consultar'} - ${seller?.username ? `<a href="${SITE}/${encodeURIComponent(seller.username)}">${esc(who)}</a>` : esc(who)}${place} (${offer.stock} ${offer.stock === 1 ? 'disponible' : 'disponibles'})</li>`;
    }).join('');
    const details = [['Juego', game], ['Edición', set], ['Rareza', rarity], ['Número', field(card.data, 'number')], ['Tipo', field(card.data, 'type')]]
      .filter(([, value]) => value).map(([label, value]) => `<li>${esc(label)}: ${esc(value)}</li>`).join('');
    return sendPage(res, page({
      title, description, url, image, jsonLd,
      body: `<header><a href="${SITE}/">Carpetazo.cl</a> - <a href="${SITE}/cartas">Cartas</a></header><main><h1>${esc(name)}</h1>${image ? `<img src="${esc(image)}" alt="${esc(name)}" width="300">` : ''}<ul>${details}</ul><h2>Ofertas en Carpetazo</h2><ul>${list}</ul></main>`
    }));
  } catch (error) {
    console.error('Error armando la página SEO de una carta:', error);
    return res.status(500).type('text/plain').send('Error interno');
  }
});

// Página de un vendedor: perfil público y sus carpetas públicas (nunca contacto ni datos privados)
router.get('/api/seo/seller/:username', async (req, res) => {
  try {
    if (!USERNAME.test(req.params.username)) return notFound(res);
    const user = await prisma.user.findFirst({
      where: { username: req.params.username, NOT: { role: 'deleted' } },
      select: {
        id: true, username: true, name: true, bio: true, photoURL: true, publicComuna: true,
        folders: { where: { isPublic: true, moderationState: 'visible' }, orderBy: { totalVisits: 'desc' }, take: 30, select: { id: true, name: true, tcg: true, _count: { select: { cards: true } } } }
      }
    });
    if (!user || !user.folders.length || (await restrictions.restrictionsFor(user.id)).has('ban')) return notFound(res);
    const name = text(user.name || user.username, 60);
    const url = `${SITE}/${encodeURIComponent(user.username)}`;
    const games = [...new Set(user.folders.map((folder) => TCG_LABELS[folder.tcg] || folder.tcg))];
    const title = `${cut(name, 36)} - Vendedor de cartas ${games[0]} | Carpetazo`;
    const bio = text(user.bio, 200);
    const description = cut(bio || `Cartas de ${games.join(', ')} a la venta de ${name} en Carpetazo, el mercado de cartas TCG en Chile.`, 160);
    const image = user.photoURL && isAllowedProxyImageUrl(user.photoURL) ? user.photoURL : null;
    const jsonLd = { '@context': 'https://schema.org', '@type': 'ProfilePage', url, mainEntity: { '@type': 'Person', name, url, ...(image ? { image } : {}) } };
    const list = user.folders.map((folder) => `<li><a href="${SITE}/c/${folder.id}">${esc(text(folder.name, 80))}</a> - ${esc(TCG_LABELS[folder.tcg] || folder.tcg)} (${folder._count.cards} cartas)</li>`).join('');
    return sendPage(res, page({
      title, description, url, image, jsonLd,
      body: `<header><a href="${SITE}/">Carpetazo.cl</a> - <a href="${SITE}/vendedores">Vendedores</a></header><main><h1>${esc(name)}</h1>${bio ? `<p>${esc(bio)}</p>` : ''}<h2>Carpetas a la venta</h2><ul>${list}</ul></main>`
    }));
  } catch (error) {
    console.error('Error armando la página SEO de un vendedor:', error);
    return res.status(500).type('text/plain').send('Error interno');
  }
});

// Sitemap con las páginas fijas, los vendedores, las carpetas públicas y una dirección por carta distinta a la venta
const STATIC_PAGES = [['/', 'daily', '1.0'], ['/carpetas', 'daily', '0.9'], ['/cartas', 'daily', '0.9'], ['/vendedores', 'daily', '0.8'], ['/bienvenida', 'monthly', '0.5'], ['/terminos', 'yearly', '0.2'], ['/privacidad', 'yearly', '0.2']];
let sitemapCache = { at: 0, xml: '' };
let sitemapPending = null;

const buildSitemap = async () => {
  const [sellers, folders, cards] = await Promise.all([
    prisma.user.findMany({ where: { username: { not: null }, NOT: { role: 'deleted' }, folders: { some: { isPublic: true, moderationState: 'visible' } } }, select: { username: true }, take: 5000 }),
    prisma.folder.findMany({ where: { isPublic: true, moderationState: 'visible', cards: { some: { stock: { gt: 0 }, moderationState: 'visible' } } }, orderBy: { totalVisits: 'desc' }, take: 5000, select: { id: true, updatedAt: true } }),
    // La oferta más barata de cada carta distinta: es la misma dirección que declaran como canónica las páginas de carta
    prisma.$queryRaw`SELECT DISTINCT ON (c."tcgId", f."tcg") c."id", c."updatedAt"
      FROM "Card" c JOIN "Folder" f ON f."id" = c."folderId"
      WHERE c."stock" > 0 AND c."moderationState" = 'visible' AND f."isPublic" = true AND f."moderationState" = 'visible'
      ORDER BY c."tcgId", f."tcg", c."price" ASC NULLS LAST, c."createdAt" DESC
      LIMIT ${SITEMAP_MAX_CARDS}`
  ]);
  const entry = (loc, extra = '') => `<url><loc>${esc(loc)}</loc>${extra}</url>`;
  const day = (date) => `<lastmod>${new Date(date).toISOString().slice(0, 10)}</lastmod>`;
  const urls = [
    ...STATIC_PAGES.map(([path, freq, priority]) => entry(`${SITE}${path}`, `<changefreq>${freq}</changefreq><priority>${priority}</priority>`)),
    ...sellers.filter((seller) => USERNAME.test(seller.username)).map((seller) => entry(`${SITE}/${encodeURIComponent(seller.username)}`, '<changefreq>daily</changefreq><priority>0.7</priority>')),
    ...folders.map((folder) => entry(`${SITE}/c/${folder.id}`, `${day(folder.updatedAt)}<changefreq>daily</changefreq><priority>0.6</priority>`)),
    ...cards.map((card) => entry(`${SITE}/carta/${card.id}`, `${day(card.updatedAt)}<changefreq>daily</changefreq><priority>0.5</priority>`))
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
};

router.get('/api/seo/sitemap.xml', async (_req, res) => {
  try {
    if (Date.now() - sitemapCache.at > SITEMAP_TTL_MS) {
      sitemapPending ||= buildSitemap().then((xml) => { sitemapCache = { at: Date.now(), xml }; }).finally(() => { sitemapPending = null; });
      if (!sitemapCache.xml) await sitemapPending; // la primera vez se espera; después se entrega el anterior mientras se renueva
      else sitemapPending.catch(() => {});
    }
    res.set({ 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' }).send(sitemapCache.xml);
  } catch (error) {
    console.error('Error armando el sitemap:', error);
    res.status(500).type('text/plain').send('Error interno');
  }
});

export default router;
