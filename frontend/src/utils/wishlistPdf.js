import { apiUrl } from '../services/api';
import { formatWhatsAppNumber } from './contact';

// PDF de la lista de deseos para compartir (por ejemplo en un grupo de WhatsApp): cada carta en grande, con su nombre y cuántas copias se buscan.
// Lleva la identidad de Carpetazo (azul, amarillo y el logo). jsPDF se descarga solo al exportar.
const NAVY = [18, 49, 95];
const BLUE = [30, 64, 175];
const YELLOW = [250, 204, 21];
const PAGE_BG = [238, 243, 252];
const SHADOW = [214, 223, 240];
const WHITE = [255, 255, 255];
const SITE_URL = 'https://carpetazo.cl';
const MUTED = [100, 116, 139];

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 12;
// Dos columnas y dos filas por página: cada carta ocupa casi todo el ancho de su mitad, y en el celular se lee sin hacer zoom
const COLS = 2;
const CARD_W = 74; // marco de cada carta
const CARD_H = 101;
const GAP_X = 14;
const GRID_X = (PAGE_W - (COLS * CARD_W + (COLS - 1) * GAP_X)) / 2;
const NAME_H = 8.5;
const ROW_GAP = 4;
const FOOTER_H = 12;
const FIRST_HEADER_H = 32;
const SLIM_HEADER_H = 15;
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
      thumbs.set(item.id, await loadThumb(item.imageUrl, widthPx, quality));
      done += 1;
      onProgress?.(done, items.length);
    }
  };
  await Promise.all(Array.from({ length: THUMB_CONCURRENCY }, worker));
  return thumbs;
};

const slug = (value) => pdfText(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// items: cartas de la lista ya filtradas. filterLabel: texto del filtro aplicado ("Mitos y Leyendas" o "Todos los juegos").
// phone: WhatsApp de quien busca; con él, tocar una carta del PDF abre su chat con un mensaje listo diciendo que la tiene.
export async function buildWishlistPdf({ items, filterLabel = 'Todos los juegos', phone = '', onProgress }) {
  if (!items.length) throw new Error('No hay cartas para exportar');
  const { jsPDF } = await import('jspdf');
  const [logo, thumbs] = await Promise.all([loadLogo(), loadThumbs(items, onProgress)]);

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const now = new Date();
  const dateLabel = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long', year: 'numeric' }).format(now);
  const fill = (color) => doc.setFillColor(...color);
  const ink = (color) => doc.setTextColor(...color);
  const filtered = filterLabel !== 'Todos los juegos';
  const whatsapp = (() => { const number = formatWhatsAppNumber(phone); return number.length >= 10 && number.length <= 15 ? number : ''; })();
  const contactUrl = (item) => {
    const wanted = Number(item.quantity) || 1;
    const name = Array.from(String(item.name || '')).filter((char) => char.charCodeAt(0) > 31).join('').trim().slice(0, 100);
    const text = `Hola, vi tu lista de Carpetazo.cl y tengo la carta *${name}* que buscas${wanted > 1 ? ` (${wanted} copias)` : ''}. ¿Te interesa?`;
    return `https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}`;
  };
  const copies = items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);

  // Marca de agua: el logo grande y muy suave, centrado detrás de las cartas (sin enlace)
  const WATERMARK_W = 124;
  const watermark = logo ? { w: WATERMARK_W, h: WATERMARK_W / logo.ratio } : null;
  if (watermark) { watermark.x = (PAGE_W - watermark.w) / 2; watermark.y = (PAGE_H - watermark.h) / 2 + 6; }
  const paintPage = () => {
    fill(PAGE_BG);
    doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
    if (!watermark) return;
    doc.setGState(new doc.GState({ opacity: 0.12 }));
    doc.addImage(logo.data, 'PNG', watermark.x, watermark.y, watermark.w, watermark.h);
    doc.setGState(new doc.GState({ opacity: 1 }));
  };

  // Logo sobre un recuadro blanco: se lee igual sobre el azul oscuro
  const drawLogo = (x, y, size) => {
    fill(WHITE);
    doc.roundedRect(x, y, size, size, size * 0.2, size * 0.2, 'F');
    if (!logo) return;
    const box = size * 0.8;
    const width = logo.ratio >= 1 ? box : box * logo.ratio;
    const height = logo.ratio >= 1 ? box / logo.ratio : box;
    doc.addImage(logo.data, 'PNG', x + (size - width) / 2, y + (size - height) / 2, width, height);
  };

  const firstHeader = () => {
    fill(NAVY);
    doc.rect(0, 0, PAGE_W, FIRST_HEADER_H, 'F');
    fill(YELLOW);
    doc.rect(0, FIRST_HEADER_H, PAGE_W, 1.6, 'F');
    drawLogo(MARGIN, 7, 18);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(23);
    ink(WHITE);
    doc.text('Busco estas cartas', PAGE_W / 2, 16.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    ink([191, 209, 245]);
    const counts = `${items.length} ${items.length === 1 ? 'carta' : 'cartas'} - ${copies} ${copies === 1 ? 'copia' : 'copias'}`;
    doc.text(filtered ? `${pdfText(filterLabel)} - ${counts}` : counts, PAGE_W / 2, 24, { align: 'center' });
  };
  const slimHeader = () => {
    fill(NAVY);
    doc.rect(0, 0, PAGE_W, SLIM_HEADER_H, 'F');
    fill(YELLOW);
    doc.rect(0, SLIM_HEADER_H, PAGE_W, 0.9, 'F');
    drawLogo(MARGIN, 3, 9);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    ink(WHITE);
    doc.text('Busco estas cartas', PAGE_W / 2, 9.6, { align: 'center' });
  };

  paintPage();
  firstHeader();
  let y = FIRST_HEADER_H + 8;
  const limit = PAGE_H - FOOTER_H;
  const newPage = () => { doc.addPage(); paintPage(); slimHeader(); y = SLIM_HEADER_H + 8; };

  // Cartas agrupadas por juego (solo se rotula cada juego si la lista mezcla varios)
  const groups = [];
  items.forEach((item) => {
    const name = item.game || 'Sin juego';
    let group = groups.find((entry) => entry.name === name);
    if (!group) { group = { name, items: [] }; groups.push(group); }
    group.items.push(item);
  });

  groups.forEach((group) => {
    if (groups.length > 1) {
      if (y + 9 + CARD_H + NAME_H > limit) newPage();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      const label = pdfText(group.name);
      const width = doc.getTextWidth(label) + 10;
      fill(BLUE);
      doc.roundedRect((PAGE_W - width) / 2, y, width, 8, 4, 4, 'F');
      ink(WHITE);
      doc.text(label, PAGE_W / 2, y + 5.4, { align: 'center' });
      y += 16; // deja lugar al círculo de copias, que sobresale por arriba de la primera fila
    }

    for (let start = 0; start < group.items.length; start += COLS) {
      if (y + CARD_H + NAME_H > limit) newPage();
      group.items.slice(start, start + COLS).forEach((item, column) => {
        const x = GRID_X + column * (CARD_W + GAP_X);

        // Marco blanco con una sombra suave, y la carta adentro lo más grande posible
        fill(SHADOW);
        doc.roundedRect(x + 0.7, y + 1, CARD_W, CARD_H, 4, 4, 'F');
        fill(WHITE);
        doc.roundedRect(x, y, CARD_W, CARD_H, 4, 4, 'F');
        const thumb = thumbs.get(item.id);
        const pad = 3;
        const boxW = CARD_W - pad * 2;
        const boxH = CARD_H - pad * 2;
        if (thumb) {
          const ratio = thumb.ratio;
          const width = ratio > boxW / boxH ? boxW : boxH * ratio;
          const height = ratio > boxW / boxH ? boxW / ratio : boxH;
          doc.addImage(thumb.data, 'JPEG', x + pad + (boxW - width) / 2, y + pad + (boxH - height) / 2, width, height);
        } else {
          fill(PAGE_BG);
          doc.roundedRect(x + pad, y + pad, boxW, boxH, 3, 3, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          ink(MUTED);
          doc.text(doc.splitTextToSize(pdfText(item.name), boxW - 10).slice(0, 4), x + CARD_W / 2, y + CARD_H / 2 - 4, { align: 'center' });
        }

        // Tocar la carta abre el WhatsApp de quien la busca con el mensaje ya escrito
        if (whatsapp) doc.link(x, y, CARD_W, CARD_H + NAME_H - 1, { url: contactUrl(item) });

        // Cantidad: un círculo amarillo sobre la esquina de la carta
        const radius = 6.6;
        const cx = x + CARD_W - 3;
        const cy = y + 3;
        fill(WHITE);
        doc.circle(cx, cy, radius + 1.2, 'F');
        fill(YELLOW);
        doc.circle(cx, cy, radius, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        ink(NAVY);
        doc.text(`x${Number(item.quantity) || 1}`, cx, cy + 2, { align: 'center' });

        // Nombre, una línea
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        ink(NAVY);
        const line = doc.splitTextToSize(pdfText(item.name), CARD_W + GAP_X - 4)[0] || '';
        doc.text(line, x + CARD_W / 2, y + CARD_H + 6, { align: 'center' });
      });
      y += CARD_H + NAME_H + ROW_GAP;
    }
  });

  // Pie en todas las páginas
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    // Solo el logo de la cabecera lleva al sitio: la marca de agua del fondo y el pie no se pueden tocar por error
    if (page === 1) doc.link(MARGIN, 7, 18, 18, { url: SITE_URL });
    else doc.link(MARGIN, 3, 9, 9, { url: SITE_URL });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    ink(BLUE);
    doc.text('carpetazo.cl', MARGIN, PAGE_H - 6);
    doc.setFont('helvetica', 'normal');
    ink(MUTED);
    doc.text(whatsapp ? 'Toca la carta que tengas y escribeme por WhatsApp' : pdfText(dateLabel), PAGE_W / 2, PAGE_H - 6, { align: 'center' });
    if (pages > 1) doc.text(`${page} / ${pages}`, PAGE_W - MARGIN, PAGE_H - 6, { align: 'right' });
  }

  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const filterPart = filtered ? `-${slug(filterLabel)}` : '';
  return { doc, fileName: `busco-estas-cartas-carpetazo${filterPart}-${stamp}.pdf` };
}

// Crea el PDF y lo descarga
export async function exportWishlistPdf(options) {
  const { doc, fileName } = await buildWishlistPdf(options);
  doc.save(fileName);
}
