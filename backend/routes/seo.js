// SEO: los buscadores (Google, Bing…) reciben una página con el contenido ya escrito para cartas y vendedores, y un sitemap con todo lo público.
// Solo se usa información pública: cartas visibles con stock en carpetas públicas y visibles, y vendedores con alguna carpeta pública.
import express from 'express';
import { prisma } from '../core/db.js';
import { sameCardMatch } from '../core/listing.js';
import { restrictions } from '../moderation/services.js';
import { isAllowedProxyImageUrl, isUuid } from '../core/validation.js';
import { PRODUCT_ID, catalogPath, loadCatalogCard, slugOf } from '../core/catalogPage.js';
import { botFamily, bumpMetric } from '../core/metrics.js';

const router = express.Router();
const SITE = 'https://carpetazo.cl';
const API = process.env.PUBLIC_API_URL || 'https://api.carpetazo.cl';
const TCG_LABELS = { Pokemon: 'Pokémon', 'Mitos y Leyendas': 'Mitos y Leyendas', OnePiece: 'One Piece', Magic: 'Magic', YuGiOh: 'Yu-Gi-Oh!', Riftbound: 'Riftbound', Lorcana: 'Disney Lorcana', Digimon: 'Digimon Card Game' };
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

// `image` es la foto real (datos estructurados); `shareImage` es la tarjeta con marca que ven WhatsApp, Instagram, Telegram y Facebook
const page = ({ title, description, url, image, shareImage, jsonLd, body }) => `<!doctype html>
<html lang="es-CL"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Carpetazo.cl"><meta property="og:locale" content="es_CL">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(url)}">
${shareImage ? `<meta property="og:image" content="${esc(shareImage)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:type" content="image/jpeg"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${esc(shareImage)}">` : image ? `<meta property="og:image" content="${esc(image)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${esc(image)}">` : ''}
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
      where: { ...visibleCard, ...sameCardMatch(card), folder: { ...visibleCard.folder, tcg } },
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
      shareImage: `${API}/api/og/card/${req.params.id}/image.jpg?v=${Math.round(low || 0)}-${offers.length}`,
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
      shareImage: `${API}/api/og/seller/${encodeURIComponent(user.username)}/image.jpg?v=${user.folders.length}`,
      body: `<header><a href="${SITE}/">Carpetazo.cl</a> - <a href="${SITE}/vendedores">Vendedores</a></header><main><h1>${esc(name)}</h1>${bio ? `<p>${esc(bio)}</p>` : ''}<h2>Carpetas a la venta</h2><ul>${list}</ul></main>`
    }));
  } catch (error) {
    console.error('Error armando la página SEO de un vendedor:', error);
    return res.status(500).type('text/plain').send('Error interno');
  }
});

// Página de una carpeta pública: sus cartas con stock, con enlace a cada una
const FOLDER_CARDS_SHOWN = 100;
router.get('/api/seo/folder/:id', async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res);
    const folder = await prisma.folder.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, description: true, tcg: true, isPublic: true, moderationState: true, user: { select: { name: true, username: true } } }
    });
    if (!folder || !folder.isPublic || folder.moderationState !== 'visible') return notFound(res);
    const where = { folderId: folder.id, stock: { gt: 0 }, moderationState: 'visible' };
    const [cards, count] = await Promise.all([
      prisma.card.findMany({ where, orderBy: { createdAt: 'desc' }, take: FOLDER_CARDS_SHOWN, select: { id: true, name: true, price: true, imageUrl: true, data: true } }),
      prisma.card.count({ where })
    ]);
    if (!count) return notFound(res); // sin cartas a la venta no hay nada que indexar
    const game = TCG_LABELS[folder.tcg] || folder.tcg;
    const owner = text(folder.user?.name || folder.user?.username || 'Carpetazo', 60);
    const name = text(folder.name, 80);
    const url = `${SITE}/c/${folder.id}`;
    const prices = cards.map((card) => card.price).filter((price) => Number.isFinite(price) && price > 0);
    const title = `${cut(name, 40)} - ${count} cartas de ${game} | Carpetazo`;
    const description = cut(text(folder.description, 120) || `${count} ${count === 1 ? 'carta' : 'cartas'} de ${game} a la venta de ${owner}${prices.length ? `, desde ${clp(Math.min(...prices))}` : ''}. Compra en Chile con Carpetazo.`, 160);
    const image = cards.map((card) => card.imageUrl).find((link) => link && isAllowedProxyImageUrl(link)) || null;
    const jsonLd = {
      '@context': 'https://schema.org', '@type': 'CollectionPage', name, url, ...(image ? { image } : {}),
      mainEntity: { '@type': 'ItemList', numberOfItems: count, itemListElement: cards.slice(0, 50).map((card, index) => ({ '@type': 'ListItem', position: index + 1, url: `${SITE}/carta/${card.id}`, name: text(card.name, 120) })) }
    };
    const list = cards.map((card) => `<li><a href="${SITE}/carta/${card.id}">${esc(text(card.name, 120))}</a>${field(card.data, 'set') ? ` (${esc(field(card.data, 'set'))})` : ''} - ${card.price ? esc(clp(card.price)) : 'Precio a consultar'}</li>`).join('');
    const seller = folder.user?.username ? `<a href="${SITE}/${encodeURIComponent(folder.user.username)}">${esc(owner)}</a>` : esc(owner);
    return sendPage(res, page({
      title, description, url, image, jsonLd,
      body: `<header><a href="${SITE}/">Carpetazo.cl</a> - <a href="${SITE}/carpetas">Carpetas</a></header><main><h1>${esc(name)}</h1><p>${esc(game)} - ${count} ${count === 1 ? 'carta' : 'cartas'} - ${seller}</p><ul>${list}</ul></main>`
    }));
  } catch (error) {
    console.error('Error armando la página SEO de una carpeta:', error);
    return res.status(500).type('text/plain').send('Error interno');
  }
});

// Página de una carta del catálogo (/catalogo/<id>/<nombre>): la tenga alguien a la venta o no. Es lo que encuentra quien busca la carta en Google.
router.get('/api/seo/catalog/:productId', async (req, res) => {
  try {
    if (!PRODUCT_ID.test(req.params.productId)) return notFound(res);
    const found = await loadCatalogCard(prisma, Number(req.params.productId));
    if (!found) return notFound(res);
    bumpMetric('catalog_crawl', botFamily(req.get('user-agent')));
    const { card, offers, low, high, others } = found;
    const name = text(card.name, 120);
    const url = `${SITE}${card.path}`;
    const details = [['Juego', card.gameLabel], ['Edición', card.set], ['Número', card.number], ['Rareza', card.rarity]].filter(([, value]) => value);
    const where = [card.set, card.gameLabel].filter(Boolean).join(', ');
    const title = cut(`${name}${card.set ? ` (${card.set})` : ''} - ${card.gameLabel}${low ? ` desde ${clp(low)}` : ''} | Carpetazo`, 70);
    const description = cut(offers.length
      ? `${name}${where ? ` (${where})` : ''}: ${offers.length} ${offers.length === 1 ? 'oferta' : 'ofertas'} en Chile desde ${clp(low)}. Compra cartas ${card.gameLabel} a vendedores chilenos en Carpetazo.`
      : `${name}${where ? ` (${where})` : ''}. Datos de la carta y aviso cuando un vendedor chileno la publique en Carpetazo, el mercado de cartas TCG en Chile.`, 160);
    const image = card.imageUrl && /^https:\/\//.test(card.imageUrl) ? card.imageUrl : null;
    const jsonLd = {
      '@context': 'https://schema.org', '@type': 'Product', name, sku: String(card.productId), url, ...(image ? { image } : {}),
      description: cut(`${name} - carta de ${card.gameLabel}${card.set ? `, ${card.set}` : ''}${card.rarity ? `, ${card.rarity}` : ''}.`, 200),
      category: `Cartas coleccionables - ${card.gameLabel}`,
      ...(low ? { offers: { '@type': 'AggregateOffer', priceCurrency: 'CLP', lowPrice: Math.round(low), highPrice: Math.round(high), offerCount: offers.length, availability: 'https://schema.org/InStock' } } : {})
    };
    const offerList = offers.map((offer) => {
      const seller = offer.seller;
      const who = text(seller.name || seller.username || 'Vendedor', 60);
      return `<li>${offer.price ? esc(clp(offer.price)) : 'Precio a consultar'} - ${seller.username ? `<a href="${SITE}/${encodeURIComponent(seller.username)}">${esc(who)}</a>` : esc(who)}${seller.comuna ? `, ${esc(text(seller.comuna, 60))}` : ''} (<a href="${SITE}/carta/${offer.id}">ver oferta</a>)</li>`;
    }).join('');
    const otherList = others.map((other) => `<li><a href="${SITE}${other.path}">${esc(text(other.name, 120))}</a>${other.set ? ` (${esc(text(other.set, 80))})` : ''}</li>`).join('');
    return sendPage(res, page({
      title, description, url, image, jsonLd,
      body: `<header><a href="${SITE}/">Carpetazo.cl</a> - <a href="${SITE}/cartas">Cartas</a></header><main><h1>${esc(name)}</h1>${image ? `<img src="${esc(image)}" alt="${esc(name)}" width="300">` : ''}<ul>${details.map(([label, value]) => `<li>${esc(label)}: ${esc(value)}</li>`).join('')}</ul>${card.text ? `<p>${esc(card.text)}</p>` : ''}<h2>${offers.length ? 'Ofertas en Carpetazo' : 'Nadie la vende por ahora'}</h2>${offers.length ? `<ul>${offerList}</ul>` : `<p>Agrégala a tu lista de deseadas y te avisamos cuando un vendedor la publique.</p>`}${others.length ? `<h2>Otras versiones</h2><ul>${otherList}</ul>` : ''}</main>`
    }));
  } catch (error) {
    console.error('Error armando la página SEO de una carta del catálogo:', error);
    return res.status(500).type('text/plain').send('Error interno');
  }
});

// Sitemap con las páginas fijas, los vendedores, las carpetas públicas y una dirección por carta distinta a la venta
const STATIC_PAGES = [['/', 'daily', '1.0'], ['/carpetas', 'daily', '0.9'], ['/cartas', 'daily', '0.9'], ['/vendedores', 'daily', '0.8'], ['/planes', 'monthly', '0.7'], ['/bienvenida', 'monthly', '0.5'], ['/terminos', 'yearly', '0.2'], ['/privacidad', 'yearly', '0.2']];
let sitemapCache = { at: 0, xml: '' };
let sitemapPending = null;

const buildSitemap = async () => {
  const [sellers, folders, cards] = await Promise.all([
    prisma.user.findMany({ where: { username: { not: null }, NOT: { role: 'deleted' }, folders: { some: { isPublic: true, moderationState: 'visible' } } }, select: { username: true }, take: 5000 }),
    prisma.folder.findMany({ where: { isPublic: true, moderationState: 'visible', cards: { some: { stock: { gt: 0 }, moderationState: 'visible' } } }, orderBy: { totalVisits: 'desc' }, take: 5000, select: { id: true, updatedAt: true } }),
    // La oferta más barata de cada carta distinta: es la misma dirección que declaran como canónica las páginas de carta
    prisma.$queryRaw`SELECT DISTINCT ON (k."tcg", k."key") k."id", k."updatedAt"
      FROM (
        SELECT c."id", c."updatedAt", c."price", c."createdAt", f."tcg",
          COALESCE(lower(c."name") || '|' || (c."data"->>'set') || '|' || (c."data"->>'number'), c."tcgId") AS "key"
        FROM "Card" c JOIN "Folder" f ON f."id" = c."folderId"
        WHERE c."stock" > 0 AND c."moderationState" = 'visible' AND f."isPublic" = true AND f."moderationState" = 'visible'
      ) k
      ORDER BY k."tcg", k."key", k."price" ASC NULLS LAST, k."createdAt" DESC
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

// --- Sitemaps de las cartas del catálogo: un índice y archivos de hasta CATALOG_CHUNK direcciones (el límite de cada sitemap es 50.000)
const CATALOG_CHUNK = 40000;
const CATALOG_TTL_MS = 6 * 60 * 60 * 1000;
const catalogChunks = new Map(); // número -> { at, xml }
let catalogTotal = { at: 0, value: 0 };
const catalogWhere = { kind: 'card', imageKey: { not: null } };

const catalogCount = async () => {
  if (Date.now() - catalogTotal.at > 60 * 60 * 1000 || catalogTotal.value === 0) {
    const value = await prisma.catalogCard.count({ where: catalogWhere });
    // Un catálogo vacío no se mantiene en caché: permite que las primeras cartas
    // agregadas aparezcan inmediatamente en el índice y en el sitemap.
    catalogTotal = value > 0 ? { at: Date.now(), value } : { at: 0, value: 0 };
    return value;
  }
  return catalogTotal.value;
};

router.get('/api/seo/sitemap-index.xml', async (_req, res) => {
  try {
    const files = Math.ceil((await catalogCount()) / CATALOG_CHUNK);
    const entries = [`${SITE}/sitemap-main.xml`, ...Array.from({ length: files }, (_, i) => `${SITE}/sitemap-catalogo-${i + 1}.xml`)];
    res.set({ 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' })
      .send(`<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.map((loc) => `<sitemap><loc>${esc(loc)}</loc></sitemap>`).join('\n')}\n</sitemapindex>\n`);
  } catch (error) {
    console.error('Error armando el índice de sitemaps:', error);
    res.status(500).type('text/plain').send('Error interno');
  }
});

router.get('/api/seo/sitemap-catalogo/:n.xml', async (req, res) => {
  try {
    const n = Number.parseInt(req.params.n, 10);
    if (!/^[1-9]\d{0,2}$/.test(req.params.n) || n > Math.ceil((await catalogCount()) / CATALOG_CHUNK)) return notFound(res);
    let chunk = catalogChunks.get(n);
    if (!chunk || Date.now() - chunk.at > CATALOG_TTL_MS) {
      const rows = await prisma.catalogCard.findMany({ where: catalogWhere, orderBy: { productId: 'asc' }, skip: (n - 1) * CATALOG_CHUNK, take: CATALOG_CHUNK, select: { productId: true, name: true, updatedAt: true } });
      const urls = rows.map((row) => `<url><loc>${esc(`${SITE}/catalogo/${row.productId}/${slugOf(row.name)}`)}</loc><lastmod>${row.updatedAt.toISOString().slice(0, 10)}</lastmod><changefreq>weekly</changefreq><priority>0.4</priority></url>`);
      chunk = { at: Date.now(), xml: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n` };
      catalogChunks.set(n, chunk);
    }
    res.set({ 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=21600' }).send(chunk.xml);
  } catch (error) {
    console.error('Error armando el sitemap del catálogo:', error);
    res.status(500).type('text/plain').send('Error interno');
  }
});

export default router;
