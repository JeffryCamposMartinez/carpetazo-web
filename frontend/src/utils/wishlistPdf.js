import { apiUrl } from '../services/api';
import { formatWhatsAppNumber } from './contact';
import { wishlistFinishOf, wishlistImageFallback } from './cardFinish';

// PDF de la lista de deseos para compartir (por ejemplo en un grupo de WhatsApp). Páginas oscuras de la identidad de Carpetazo
// (azul marino, amarillo y el logo) con cada carta en una tarjeta blanca: foto grande con foco de luz y sombra, cuántas copias se buscan,
// el precio que se pagaría (si se dejó visible), el idioma y la nota que escribió quien busca. jsPDF se descarga solo al exportar.
const NAVY = [18, 49, 95];
const INK = [11, 30, 66];
const BLUE = [30, 64, 175];
const YELLOW = [250, 204, 21];
const WHITE = [255, 255, 255];
const SKY = [191, 209, 245];
const MUTED = [100, 116, 139];
const WHATSAPP = [37, 211, 102];
const NOTE_BG = [255, 246, 209];
const NOTE_INK = [92, 64, 8];
const NOTE_LABEL = [166, 104, 4];
const SPOT = [226, 235, 252];
const SITE_URL = 'https://carpetazo.cl';

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 12;
// Dos columnas y dos filas por página: cada carta ocupa casi todo el ancho de su mitad, y en el celular se lee sin hacer zoom
const COLS = 2;
const CARD_W = 76;
const GAP_X = 10;
const GRID_X = (PAGE_W - (COLS * CARD_W + (COLS - 1) * GAP_X)) / 2;
const IMG_H = 70; // zona de la foto; la de nombre y nota se ajusta a lo que haya que escribir
const ROW_GAP = 4.5;
const FOOTER_H = 12;
const FIRST_HEADER_H = 50;
const SLIM_HEADER_H = 14;
const LANGUAGES = ['Inglés', 'Español', 'Japonés'];
const LOGO_URL = '/images/logos/logo_completo.webp';
const THUMB_CONCURRENCY = 6;

// Helvetica del PDF solo trae Latin-1: tildes y eñes salen bien; las comillas y guiones tipográficos se reemplazan y lo demás se omite
const pdfText = (value) => String(value ?? '')
  .replace(/[–—]/g, '-')
  .replace(/[‘’]/g, "'")
  .replace(/[“”]/g, '"')
  .replace(/…/g, '...')
  .replace(/[·•]/g, '-')
  .replace(/[^ -ÿ]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const loadImage = (src) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('No se pudo cargar la imagen'));
  image.src = src;
});

// Imagen del mismo sitio (el logo) -> PNG con su proporción
const loadLogo = async () => {
  try {
    const image = await loadImage(LOGO_URL);
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext('2d').drawImage(image, 0, 0);
    return { data: canvas.toDataURL('image/png'), ratio: image.naturalWidth / image.naturalHeight };
  } catch (_error) {
    return null;
  }
};

// Foto de una carta en JPEG: pasa por el proxy del sitio, que es el único que puede leer imágenes de otros dominios.
// Las de TCGplayer vienen chicas (_200w): se pide la de 400 px, que se ve bien en grande.
const loadThumb = async (imageUrl, widthPx, quality) => {
  if (!imageUrl) return null;
  try {
    const wanted = String(imageUrl).replace('_200w.', '_400w.');
    const source = /^(data:|blob:)/.test(wanted) ? wanted : apiUrl(`/proxy-image?url=${encodeURIComponent(wanted)}`);
    const response = await fetch(source);
    if (!response.ok) return null;
    const bitmap = await createImageBitmap(await response.blob());
    const scale = Math.min(1, widthPx / bitmap.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return { data: canvas.toDataURL('image/jpeg', quality), ratio: bitmap.width / bitmap.height };
  } catch (_error) {
    return null;
  }
};

const loadThumbs = async (items, onProgress) => {
  // Con listas largas las fotos se achican un poco para que el PDF siga siendo liviano de enviar
  const widthPx = items.length > 60 ? 380 : 520;
  const quality = items.length > 60 ? 0.74 : 0.8;
  const thumbs = new Map();
  let cursor = 0;
  let done = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      thumbs.set(item.id, await loadThumb(item.imageUrl || wishlistImageFallback(item), widthPx, quality));
      done += 1;
      onProgress?.(done, items.length);
    }
  };
  await Promise.all(Array.from({ length: THUMB_CONCURRENCY }, worker));
  return thumbs;
};

// Nombre del archivo: palabras con mayúscula inicial, separadas por espacios (sin guiones, números ni signos)
const fileLabel = (value) => String(value || '').replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim();

const clp = (value) => `$${Math.round(Number(value)).toLocaleString('es-CL')}`;

// «Prize Pack Series Cards - Inglés» -> edición y, aparte, el idioma si lo trae
const splitDetail = (detail) => {
  const text = pdfText(detail || '');
  const parts = text.split(/\s-\s/);
  const last = parts[parts.length - 1];
  if (parts.length > 1 && LANGUAGES.includes(last)) return { set: parts.slice(0, -1).join(' - '), language: last };
  return { set: text, language: LANGUAGES.includes(text) ? text : '' };
};

// items: cartas de la lista ya filtradas. filterLabel: texto del filtro aplicado ("Mitos y Leyendas" o "Todos los juegos").
// phone: WhatsApp de quien busca; con él, tocar una carta del PDF abre su chat con un mensaje listo diciendo que la tiene.
export async function buildWishlistPdf({ items, filterLabel = 'Todos los juegos', listName = '', phone = '', onProgress }) {
  if (!items.length) throw new Error('No hay cartas para exportar');
  const { jsPDF } = await import('jspdf');
  const [logo, thumbs] = await Promise.all([loadLogo(), loadThumbs(items, onProgress)]);

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setProperties({ title: 'Cartas que busco' });
  const dateLabel = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  const fill = (color) => doc.setFillColor(...color);
  const ink = (color) => doc.setTextColor(...color);
  const opacity = (value) => doc.setGState(new doc.GState({ opacity: value }));
  const font = (style, size) => { doc.setFont('helvetica', style); doc.setFontSize(size); };
  const filtered = filterLabel !== 'Todos los juegos';
  const whatsapp = (() => { const number = formatWhatsAppNumber(phone); return number.length >= 10 && number.length <= 15 ? number : ''; })();
  const contactUrl = (item) => {
    const wanted = Number(item.quantity) || 1;
    const name = Array.from(String(item.name || '')).filter((char) => char.charCodeAt(0) > 31).join('').trim().slice(0, 100);
    const text = `Hola, vi tu lista de Carpetazo.cl y tengo la carta *${name}* que buscas${wanted > 1 ? ` (${wanted} copias)` : ''}. ¿Te interesa?`;
    return `https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}`;
  };
  const copies = items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
  const withNotes = items.filter((item) => String(item.note || '').trim()).length;

  // Texto que cabe en `width` mm: hasta `maxLines` líneas, con «...» si se corta (usa la fuente activa)
  const fitLines = (text, width, maxLines) => {
    const lines = doc.splitTextToSize(pdfText(text), width);
    if (lines.length <= maxLines) return lines;
    const cut = lines.slice(0, maxLines);
    let last = cut[maxLines - 1];
    while (last.length > 1 && doc.getTextWidth(`${last}...`) > width) last = last.slice(0, -1);
    cut[maxLines - 1] = `${last.trimEnd()}...`;
    return cut;
  };

  // ---- Fondo de cada página: degradado vertical de azul marino profundo a azul, círculos suaves y el logo como marca de agua
  const WATERMARK_W = 118;
  const watermark = logo ? { w: WATERMARK_W, h: WATERMARK_W / logo.ratio } : null;
  if (watermark) { watermark.x = (PAGE_W - watermark.w) / 2; watermark.y = (PAGE_H - watermark.h) / 2 + 8; }
  const paintPage = () => {
    const bands = 150;
    for (let band = 0; band < bands; band += 1) {
      const t = band / (bands - 1);
      fill([Math.round(7 + 13 * t), Math.round(20 + 34 * t), Math.round(46 + 62 * t)]);
      doc.rect(0, (PAGE_H / bands) * band, PAGE_W, PAGE_H / bands + 0.5, 'F');
    }
    opacity(0.07);
    fill(YELLOW);
    doc.circle(PAGE_W + 6, 70, 52, 'F');
    doc.circle(-10, PAGE_H - 60, 48, 'F');
    fill(SKY);
    doc.circle(PAGE_W - 30, PAGE_H - 20, 30, 'F');
    opacity(1);
    if (watermark) {
      opacity(0.05);
      doc.addImage(logo.data, 'PNG', watermark.x, watermark.y, watermark.w, watermark.h);
      opacity(1);
    }
  };

  // Logo sobre un recuadro blanco: se lee igual sobre el azul oscuro
  const drawLogo = (x, y, size) => {
    opacity(0.28);
    fill(INK);
    doc.roundedRect(x + 0.6, y + 0.9, size, size, size * 0.22, size * 0.22, 'F');
    opacity(1);
    fill(WHITE);
    doc.roundedRect(x, y, size, size, size * 0.22, size * 0.22, 'F');
    if (!logo) return;
    const box = size * 0.8;
    const width = logo.ratio >= 1 ? box : box * logo.ratio;
    const height = logo.ratio >= 1 ? box / logo.ratio : box;
    doc.addImage(logo.data, 'PNG', x + (size - width) / 2, y + (size - height) / 2, width, height);
  };

  // Pastilla de texto: devuelve su ancho
  const pill = (x, y, height, label, background, color, size = 8, backgroundOpacity = 1) => {
    font('bold', size);
    const width = doc.getTextWidth(label) + height * 1.15;
    if (backgroundOpacity < 1) opacity(backgroundOpacity);
    fill(background);
    doc.roundedRect(x, y, width, height, height / 2, height / 2, 'F');
    if (backgroundOpacity < 1) opacity(1);
    ink(color);
    doc.text(label, x + width / 2, y + height / 2 + size * 0.125, { align: 'center' });
    return width;
  };

  // ---- Cabecera de la primera página: logo, título en dos colores, tres cifras y la invitación a escribir
  const firstHeader = () => {
    drawLogo(MARGIN, 9, 21);
    font('bold', 29);
    const lead = 'Busco estas ';
    ink(WHITE);
    doc.text(lead, MARGIN + 27, 21.5);
    ink(YELLOW);
    doc.text('cartas', MARGIN + 27 + doc.getTextWidth(lead), 21.5);
    const heading = [listName, filtered && filterLabel].filter(Boolean).join('  -  ');
    font('normal', 10);
    ink(SKY);
    doc.text(pdfText(heading || dateLabel), MARGIN + 27, 28.5);
    if (heading) { font('normal', 8.5); ink([130, 160, 215]); doc.text(pdfText(dateLabel), PAGE_W - MARGIN, 14, { align: 'right' }); }

    // Cifras en tarjetas translúcidas: número grande y rótulo
    const tiles = [[items.length, items.length === 1 ? 'carta' : 'cartas'], [copies, copies === 1 ? 'copia' : 'copias']];
    if (withNotes) tiles.push([withNotes, 'con nota']);
    let tileX = MARGIN;
    const tileY = 35.5;
    tiles.forEach(([value, label]) => {
      font('bold', 15);
      const numberW = doc.getTextWidth(String(value));
      font('normal', 8);
      const width = numberW + doc.getTextWidth(label) + 11;
      opacity(0.13);
      fill(WHITE);
      doc.roundedRect(tileX, tileY, width, 10.5, 3.2, 3.2, 'F');
      opacity(1);
      font('bold', 15);
      ink(YELLOW);
      doc.text(String(value), tileX + 4, tileY + 7.5);
      font('normal', 8);
      ink(SKY);
      doc.text(label, tileX + 4 + numberW + 2.2, tileY + 7.2);
      tileX += width + 3;
    });

    // Invitación: cada carta del PDF abre el WhatsApp de quien la busca
    if (whatsapp) {
      font('bold', 8.6);
      const label = 'Toca la carta que tengas';
      const width = doc.getTextWidth(label) + 17;
      const x = PAGE_W - MARGIN - width;
      opacity(0.3);
      fill(INK);
      doc.roundedRect(x + 0.5, tileY + 0.9, width, 10.5, 5.25, 5.25, 'F');
      opacity(1);
      fill(WHATSAPP);
      doc.roundedRect(x, tileY, width, 10.5, 5.25, 5.25, 'F');
      fill(WHITE);
      doc.circle(x + 6, tileY + 5.25, 2.9, 'F');
      fill(WHATSAPP);
      doc.circle(x + 6, tileY + 5.25, 1.5, 'F');
      doc.triangle(x + 3.4, tileY + 9.2, x + 4.6, tileY + 6.9, x + 6, tileY + 8.4, 'F');
      ink(WHITE);
      doc.text(label, x + 11, tileY + 6.4);
    }
    fill(YELLOW);
    doc.rect(0, FIRST_HEADER_H, PAGE_W, 1.2, 'F');
  };
  const slimHeader = () => {
    drawLogo(MARGIN, 2.6, 9.2);
    font('bold', 13);
    ink(WHITE);
    doc.text('Busco ', MARGIN + 13, 9.7);
    ink(YELLOW);
    doc.text('estas cartas', MARGIN + 13 + doc.getTextWidth('Busco '), 9.7);
    fill(YELLOW);
    doc.rect(0, SLIM_HEADER_H, PAGE_W, 0.8, 'F');
  };

  // ---- Medidas de cada tarjeta: líneas del nombre y de la nota, y alto de la zona de texto
  const measure = (item) => {
    font('bold', 9.8);
    const nameLines = fitLines(item.name, CARD_W - 8, 2);
    const note = String(item.note || '').trim();
    font('italic', 8);
    const noteLines = note ? fitLines(note, CARD_W - 15, 3) : [];
    const { set, language } = splitDetail(item.detail);
    const infoH = 2.6 + 1.1 + 2 + nameLines.length * 4.1 + (set || language ? 4.4 : 0) + (noteLines.length ? 2.2 + 5.6 + noteLines.length * 3.5 : 0) + 2.6;
    return { nameLines, noteLines, set, language, infoH };
  };

  // Franja diagonal amarilla con el acabado (Reverse Holofoil…) en la esquina inferior izquierda de la foto; (x, by) es esa esquina
  const drawFinishRibbon = (label, x, by, w, h) => {
    const text = pdfText(label);
    if (!text) return;
    const d = Math.min(w, h) * 0.2; // distancia de la franja a cada borde
    const t = 4.2; // grosor
    const s = Math.SQRT1_2;
    const ux = s; const uy = s; // sentido de la franja (abajo a la derecha)
    const nx = s; const ny = -s; // hacia el interior de la carta
    const ax = x - ux * t; const ay = by - 2 * d - uy * t;
    const bx = x + 2 * d + ux * t; const by2 = by + uy * t;
    const hx = nx * t / 2; const hy = ny * t / 2;
    doc.saveGraphicsState();
    doc.rect(x, by - h, w, h, null);
    doc.clip();
    doc.discardPath();
    fill(YELLOW);
    doc.lines([[bx - ax, by2 - ay], [-2 * hx, -2 * hy], [ax - bx, ay - by2]], ax + hx, ay + hy, [1, 1], 'F', true);
    font('bold', 6.2);
    ink(NAVY);
    doc.text(text, x + d - nx * 0.8, by - d - ny * 0.8, { align: 'center', angle: -45 });
    doc.restoreGraphicsState();
  };

  // ---- Una tarjeta: foto con foco de luz y sombra, cantidad, precio, nombre, edición, idioma y nota
  const drawCard = (item, layout, x, top, frameH) => {
    opacity(0.32);
    fill(INK);
    doc.roundedRect(x + 0.9, top + 1.6, CARD_W, frameH, 5, 5, 'F');
    opacity(0.14);
    doc.roundedRect(x + 1.8, top + 3, CARD_W, frameH, 5, 5, 'F');
    opacity(1);
    fill(WHITE);
    doc.roundedRect(x, top, CARD_W, frameH, 5, 5, 'F');

    // Zona de la foto: panel azul clarito con un foco de luz detrás de la carta
    const pad = 2.4;
    const boxW = CARD_W - pad * 2;
    const boxH = IMG_H - pad * 2;
    fill(SPOT);
    doc.roundedRect(x + pad, top + pad, boxW, boxH, 3.4, 3.4, 'F');
    opacity(0.55);
    fill(WHITE);
    doc.circle(x + CARD_W / 2, top + IMG_H / 2, boxW * 0.42, 'F');
    opacity(0.5);
    doc.circle(x + CARD_W / 2, top + IMG_H / 2, boxW * 0.3, 'F');
    opacity(1);
    const thumb = thumbs.get(item.id);
    if (thumb) {
      const ratio = thumb.ratio;
      const maxW = boxW - 7;
      const maxH = boxH - 6;
      const width = ratio > maxW / maxH ? maxW : maxH * ratio;
      const height = ratio > maxW / maxH ? maxW / ratio : maxH;
      const ix = x + pad + (boxW - width) / 2;
      const iy = top + pad + (boxH - height) / 2;
      opacity(0.25);
      fill(INK);
      doc.roundedRect(ix + 0.8, iy + 1.3, width, height, 2.2, 2.2, 'F');
      opacity(0.12);
      doc.roundedRect(ix + 1.6, iy + 2.4, width, height, 2.2, 2.2, 'F');
      opacity(1);
      doc.addImage(thumb.data, 'JPEG', ix, iy, width, height);
      drawFinishRibbon(wishlistFinishOf(item), ix, iy + height, width, height);
    } else {
      font('bold', 11);
      ink(MUTED);
      doc.text(doc.splitTextToSize(pdfText(item.name), boxW - 10).slice(0, 4), x + CARD_W / 2, top + IMG_H / 2 - 4, { align: 'center' });
    }

    // Cantidad: un círculo amarillo con aro blanco dentro de la esquina del panel
    const radius = 6.4;
    const cx = x + CARD_W - pad - radius - 1.6;
    const cy = top + pad + radius + 1.6;
    opacity(0.25);
    fill(INK);
    doc.circle(cx + 0.4, cy + 0.9, radius + 1.2, 'F');
    opacity(1);
    fill(WHITE);
    doc.circle(cx, cy, radius + 1.2, 'F');
    fill(YELLOW);
    doc.circle(cx, cy, radius, 'F');
    font('bold', 14);
    ink(NAVY);
    doc.text(`x${Number(item.quantity) || 1}`, cx, cy + 2, { align: 'center' });

    // Precio que se pagaría (solo si se dejó visible)
    if (item.priceVisible && item.maxPrice != null && Number(item.maxPrice) > 0) {
      pill(x + pad + 2.4, top + IMG_H - pad - 9.4, 6.8, `Pago hasta ${clp(item.maxPrice)}`, NAVY, WHITE, 8);
    }

    // Texto: una barrita amarilla, el nombre, la edición con el idioma y la nota
    const textX = x + 4;
    const textW = CARD_W - 8;
    let ty = top + IMG_H + 2.6;
    fill(YELLOW);
    doc.roundedRect(textX, ty, 9, 1.1, 0.55, 0.55, 'F');
    ty += 1.1 + 2 + 3.2;
    font('bold', 9.8);
    ink(NAVY);
    layout.nameLines.forEach((line, index) => doc.text(line, textX, ty + index * 4.1));
    ty += (layout.nameLines.length - 1) * 4.1;
    if (layout.set || layout.language) {
      ty += 4.1;
      let setX = textX;
      if (layout.language) {
        font('bold', 6.6);
        const tagW = doc.getTextWidth(layout.language.toUpperCase()) + 4;
        fill(BLUE);
        doc.roundedRect(textX, ty - 2.9, tagW, 3.9, 1.95, 1.95, 'F');
        ink(WHITE);
        doc.text(layout.language.toUpperCase(), textX + tagW / 2, ty - 0.15, { align: 'center' });
        setX += tagW + 1.8;
      }
      if (layout.set) {
        font('normal', 7.4);
        ink(MUTED);
        doc.text(fitLines(layout.set, textW - (setX - textX), 1)[0], setX, ty);
      }
    }
    if (layout.noteLines.length) {
      const boxH = 5.6 + layout.noteLines.length * 3.5;
      const boxY = top + frameH - 2.6 - boxH;
      fill(NOTE_BG);
      doc.roundedRect(textX - 0.4, boxY, textW + 0.8, boxH, 2, 2, 'F');
      fill(YELLOW);
      doc.roundedRect(textX - 0.4, boxY, 1.8, boxH, 0.9, 0.9, 'F');
      font('bold', 6.2);
      ink(NOTE_LABEL);
      doc.text('NOTA', textX + 3.4, boxY + 3.3);
      font('italic', 8);
      ink(NOTE_INK);
      layout.noteLines.forEach((line, index) => doc.text(line, textX + 3.4, boxY + 6.6 + index * 3.5));
    }

    // Tocar la carta abre el WhatsApp de quien la busca con el mensaje ya escrito
    if (whatsapp) doc.link(x, top, CARD_W, frameH, { url: contactUrl(item) });
  };

  // ---- Rótulo del juego: una banda translúcida con una barra amarilla, el nombre y la cantidad
  const gameBanner = (name, count) => {
    const h = 8;
    opacity(0.14);
    fill(WHITE);
    doc.roundedRect(MARGIN, y, PAGE_W - MARGIN * 2, h, 4, 4, 'F');
    opacity(1);
    fill(YELLOW);
    doc.roundedRect(MARGIN, y, 3.2, h, 1.6, 1.6, 'F');
    font('bold', 11);
    ink(WHITE);
    doc.text(pdfText(name), MARGIN + 8, y + 5.5);
    const label = `${count} ${count === 1 ? 'carta' : 'cartas'}`;
    font('bold', 8);
    pill(PAGE_W - MARGIN - 3 - (doc.getTextWidth(label) + 5.8 * 1.15), y + 1.1, 5.8, label, YELLOW, NAVY, 8);
  };

  // ---- Recorrido: las cartas se reparten en filas de dos; cada fila tiene el alto que pide su texto más largo
  paintPage();
  firstHeader();
  let y = FIRST_HEADER_H + 8;
  const limit = PAGE_H - FOOTER_H;
  const newPage = () => { doc.addPage(); paintPage(); slimHeader(); y = SLIM_HEADER_H + 7; };

  const groups = [];
  items.forEach((item) => {
    const name = item.game || 'Sin juego';
    let group = groups.find((entry) => entry.name === name);
    if (!group) { group = { name, items: [] }; groups.push(group); }
    group.items.push(item);
  });

  groups.forEach((group) => {
    const layouts = new Map(group.items.map((item) => [item.id, measure(item)]));
    if (groups.length > 1) {
      if (y + 10.5 + IMG_H + 28 > limit) newPage();
      gameBanner(group.name, group.items.length);
      y += 10.5;
    }
    for (let start = 0; start < group.items.length; start += COLS) {
      const row = group.items.slice(start, start + COLS);
      const frameH = IMG_H + Math.max(...row.map((item) => layouts.get(item.id).infoH));
      if (y + frameH > limit) newPage();
      row.forEach((item, column) => drawCard(item, layouts.get(item.id), GRID_X + column * (CARD_W + GAP_X), y, frameH));
      y += frameH + ROW_GAP;
    }
  });

  // ---- Pie de todas las páginas: banda translúcida con el sitio, el texto de contacto y el número de página
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    // Solo el logo de la cabecera lleva al sitio: la marca de agua del fondo y el pie no se pueden tocar por error
    if (page === 1) doc.link(MARGIN, 9, 21, 21, { url: SITE_URL });
    else doc.link(MARGIN, 2.6, 9.2, 9.2, { url: SITE_URL });
    opacity(0.14);
    fill(WHITE);
    doc.roundedRect(MARGIN, PAGE_H - 10, PAGE_W - MARGIN * 2, 6.6, 3.3, 3.3, 'F');
    opacity(1);
    font('bold', 8.6);
    ink(YELLOW);
    doc.text('carpetazo.cl', MARGIN + 5, PAGE_H - 5.5);
    font('normal', 8);
    ink(SKY);
    doc.text(whatsapp ? 'Toca la carta que tengas y escríbeme por WhatsApp' : 'El mercado de cartas TCG de Chile', PAGE_W / 2, PAGE_H - 5.5, { align: 'center' });
    if (pages > 1) { font('bold', 8); ink(WHITE); doc.text(`${page} / ${pages}`, PAGE_W - MARGIN - 5, PAGE_H - 5.5, { align: 'right' }); }
  }

  const filterPart = [listName, filtered && filterLabel].map(fileLabel).filter(Boolean).map((part) => ` ${part}`).join('');
  return { doc, fileName: `Cartas Que Busco${filterPart}.pdf` };
}

// Crea el PDF y lo descarga. Devuelve una función para compartir el archivo tal cual (sin enlace) si el dispositivo puede, o null.
// Compartir un archivo descargado desde el navegador del móvil le agrega al mensaje un enlace "blob:" inútil.
export async function exportWishlistPdf(options) {
  const { doc, fileName } = await buildWishlistPdf(options);
  doc.save(fileName);
  const file = new File([doc.output('blob')], fileName, { type: 'application/pdf' });
  return navigator.canShare?.({ files: [file] }) ? () => navigator.share({ files: [file] }).catch(() => {}) : null;
}
