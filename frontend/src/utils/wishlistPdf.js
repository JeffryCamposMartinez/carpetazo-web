import { apiUrl } from '../services/api';
import { formatWhatsAppNumber } from './contact';

// PDF de la lista de deseos para compartir (por ejemplo en un grupo de WhatsApp): cada carta en grande, con su nombre, cuántas copias se buscan,
// el precio que pagarías (si lo dejaste visible) y la nota que escribiste, para que quien la tenga sepa justo qué se busca.
// Lleva la identidad de Carpetazo (azul, amarillo y el logo). jsPDF se descarga solo al exportar.
const NAVY = [18, 49, 95];
const NAVY_DEEP = [11, 30, 66];
const BLUE = [30, 64, 175];
const YELLOW = [250, 204, 21];
const PAGE_BG = [238, 243, 252];
const PANEL = [246, 249, 255];
const SHADOW = [208, 218, 238];
const WHITE = [255, 255, 255];
const WHATSAPP = [37, 211, 102];
const NOTE_BG = [255, 246, 209];
const NOTE_INK = [92, 64, 8];
const NOTE_LABEL = [166, 104, 4];
const SITE_URL = 'https://carpetazo.cl';
const MUTED = [100, 116, 139];

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 12;
// Dos columnas y dos filas por página: cada carta ocupa casi todo el ancho de su mitad, y en el celular se lee sin hacer zoom
const COLS = 2;
const CARD_W = 74; // marco de cada carta
const IMG_H = 79; // zona de la imagen
const INFO_H = 30; // zona de nombre, edición y nota
const FRAME_H = IMG_H + INFO_H;
const GAP_X = 14;
const GRID_X = (PAGE_W - (COLS * CARD_W + (COLS - 1) * GAP_X)) / 2;
const ROW_GAP = 4.5;
const FOOTER_H = 11;
const FIRST_HEADER_H = 40;
const SLIM_HEADER_H = 16;
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

// Nombre del archivo: palabras con mayúscula inicial, separadas por espacios (sin guiones, números ni signos)
const fileLabel = (value) => String(value || '').replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim();

const clp = (value) => `$${Math.round(Number(value)).toLocaleString('es-CL')}`;

// items: cartas de la lista ya filtradas. filterLabel: texto del filtro aplicado ("Mitos y Leyendas" o "Todos los juegos").
// phone: WhatsApp de quien busca; con él, tocar una carta del PDF abre su chat con un mensaje listo diciendo que la tiene.
export async function buildWishlistPdf({ items, filterLabel = 'Todos los juegos', listName = '', phone = '', onProgress }) {
  if (!items.length) throw new Error('No hay cartas para exportar');
  const { jsPDF } = await import('jspdf');
  const [logo, thumbs] = await Promise.all([loadLogo(), loadThumbs(items, onProgress)]);

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setProperties({ title: 'Cartas que busco' });
  const now = new Date();
  const dateLabel = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long', year: 'numeric' }).format(now);
  const fill = (color) => doc.setFillColor(...color);
  const ink = (color) => doc.setTextColor(...color);
  const opacity = (value) => doc.setGState(new doc.GState({ opacity: value }));
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

  // Texto que cabe en `width` mm: hasta `maxLines` líneas, con «...» si se corta
  const fitLines = (text, width, maxLines) => {
    const lines = doc.splitTextToSize(pdfText(text), width);
    if (lines.length <= maxLines) return lines;
    const cut = lines.slice(0, maxLines);
    let last = cut[maxLines - 1];
    while (last.length > 1 && doc.getTextWidth(`${last}...`) > width) last = last.slice(0, -1);
    cut[maxLines - 1] = `${last.trimEnd()}...`;
    return cut;
  };

  // Marca de agua: el logo grande y muy suave, centrado detrás de las cartas (sin enlace)
  const WATERMARK_W = 124;
  const watermark = logo ? { w: WATERMARK_W, h: WATERMARK_W / logo.ratio } : null;
  if (watermark) { watermark.x = (PAGE_W - watermark.w) / 2; watermark.y = (PAGE_H - watermark.h) / 2 + 6; }
  const paintPage = () => {
    fill(PAGE_BG);
    doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
    if (!watermark) return;
    opacity(0.09);
    doc.addImage(logo.data, 'PNG', watermark.x, watermark.y, watermark.w, watermark.h);
    opacity(1);
  };

  // Franja con degradado vertical (de azul marino profundo a azul), hecha con tiras finas
  const gradientBand = (height) => {
    const steps = Math.ceil(height / 0.6);
    for (let step = 0; step < steps; step += 1) {
      const t = step / Math.max(1, steps - 1);
      fill(NAVY_DEEP.map((from, index) => Math.round(from + (BLUE[index] * 0.55 + NAVY[index] * 0.45 - from) * t)));
      doc.rect(0, step * 0.6, PAGE_W, 0.7, 'F');
    }
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

  const pill = (x, y, height, label, background, color, size = 8.5, backgroundOpacity = 1) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size);
    const width = doc.getTextWidth(label) + height * 1.1;
    if (backgroundOpacity < 1) opacity(backgroundOpacity);
    fill(background);
    doc.roundedRect(x, y, width, height, height / 2, height / 2, 'F');
    if (backgroundOpacity < 1) opacity(1);
    ink(color);
    doc.text(label, x + width / 2, y + height / 2 + size * 0.12, { align: 'center' });
    return width;
  };

  const firstHeader = () => {
    gradientBand(FIRST_HEADER_H);
    // Círculos decorativos en amarillo, muy suaves
    opacity(0.1);
    fill(YELLOW);
    doc.circle(PAGE_W - 6, 4, 27, 'F');
    doc.circle(PAGE_W - 44, FIRST_HEADER_H - 2, 9, 'F');
    opacity(1);
    fill(YELLOW);
    doc.rect(0, FIRST_HEADER_H, PAGE_W, 1.8, 'F');
    drawLogo(MARGIN, 8, 21);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(27);
    ink(WHITE);
    doc.text('Busco estas cartas', MARGIN + 27, 19.5);
    const heading = [listName, filtered && filterLabel].filter(Boolean).join(' - ');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    ink([191, 209, 245]);
    doc.text(heading ? pdfText(heading) : 'Si tienes alguna, escríbeme', MARGIN + 27, 26.5);
    // Cifras: cartas, copias y, si hay, cuántas llevan nota
    let chipX = MARGIN;
    const chipY = 31.5;
    chipX += pill(chipX, chipY, 6.4, `${items.length} ${items.length === 1 ? 'carta' : 'cartas'}`, YELLOW, NAVY) + 2.5;
    chipX += pill(chipX, chipY, 6.4, `${copies} ${copies === 1 ? 'copia' : 'copias'}`, WHITE, WHITE, 8.5, 0.16) + 2.5;
    if (withNotes) pill(chipX, chipY, 6.4, `${withNotes} con nota`, WHITE, WHITE, 8.5, 0.16);
    // Invitación a escribir (cada carta del PDF abre el WhatsApp de quien la busca)
    if (whatsapp) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      const label = 'Toca la carta que tengas';
      const width = doc.getTextWidth(label) + 16;
      const x = PAGE_W - MARGIN - width;
      fill(WHATSAPP);
      doc.roundedRect(x, 9, width, 9.5, 4.75, 4.75, 'F');
      fill(WHITE);
      doc.circle(x + 5.2, 13.75, 2.4, 'F');
      fill(WHATSAPP);
      doc.circle(x + 5.2, 13.75, 1.3, 'F');
      ink(WHITE);
      doc.text(label, x + 9.5, 15.1);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      ink([191, 209, 245]);
      doc.text(pdfText(dateLabel), PAGE_W - MARGIN, 14, { align: 'right' });
    }
  };
  const slimHeader = () => {
    gradientBand(SLIM_HEADER_H);
    fill(YELLOW);
    doc.rect(0, SLIM_HEADER_H, PAGE_W, 1, 'F');
    drawLogo(MARGIN, 3.2, 9.6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    ink(WHITE);
    doc.text('Busco estas cartas', MARGIN + 13, 10.2);
  };

  paintPage();
  firstHeader();
  let y = FIRST_HEADER_H + 7;
  const limit = PAGE_H - FOOTER_H;
  const newPage = () => { doc.addPage(); paintPage(); slimHeader(); y = SLIM_HEADER_H + 7; };

  // Cartas agrupadas por juego (solo se rotula cada juego si la lista mezcla varios)
  const groups = [];
  items.forEach((item) => {
    const name = item.game || 'Sin juego';
    let group = groups.find((entry) => entry.name === name);
    if (!group) { group = { name, items: [] }; groups.push(group); }
    group.items.push(item);
  });

  const drawCard = (item, x, top) => {
    // Marco blanco con una sombra suave en dos capas
    fill(SHADOW);
    opacity(0.55);
    doc.roundedRect(x + 0.9, top + 1.4, CARD_W, FRAME_H, 4.5, 4.5, 'F');
    opacity(1);
    fill(WHITE);
    doc.roundedRect(x, top, CARD_W, FRAME_H, 4.5, 4.5, 'F');

    // Zona de la imagen: un panel clarito y la carta lo más grande posible
    const pad = 2.6;
    const boxW = CARD_W - pad * 2;
    const boxH = IMG_H - pad * 2;
    fill(PANEL);
    doc.roundedRect(x + pad, top + pad, boxW, boxH, 3, 3, 'F');
    const thumb = thumbs.get(item.id);
    if (thumb) {
      const ratio = thumb.ratio;
      const width = ratio > boxW / boxH ? boxW - 1 : (boxH - 1) * ratio;
      const height = ratio > boxW / boxH ? (boxW - 1) / ratio : boxH - 1;
      doc.addImage(thumb.data, 'JPEG', x + pad + (boxW - width) / 2, top + pad + (boxH - height) / 2, width, height);
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      ink(MUTED);
      doc.text(doc.splitTextToSize(pdfText(item.name), boxW - 10).slice(0, 4), x + CARD_W / 2, top + IMG_H / 2 - 4, { align: 'center' });
    }

    // Cantidad: un círculo amarillo sobre la esquina de la carta
    const radius = 7;
    const cx = x + CARD_W - 3;
    const cy = top + 3;
    fill(WHITE);
    doc.circle(cx, cy, radius + 1.3, 'F');
    fill(YELLOW);
    doc.circle(cx, cy, radius, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14.5);
    ink(NAVY);
    doc.text(`x${Number(item.quantity) || 1}`, cx, cy + 2.1, { align: 'center' });

    // Precio que se pagaría (solo si se dejó visible)
    if (item.priceVisible && item.maxPrice != null && Number(item.maxPrice) > 0) {
      pill(x + pad + 2, top + IMG_H - pad - 9, 6.6, `Hasta ${clp(item.maxPrice)}`, NAVY, WHITE, 8.2);
    }

    // Nombre (hasta dos líneas) y edición
    let ty = top + IMG_H + 4.6;
    const textX = x + 4;
    const textW = CARD_W - 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.6);
    ink(NAVY);
    const nameLines = fitLines(item.name, textW, 2);
    nameLines.forEach((line, index) => doc.text(line, textX, ty + index * 4.1));
    ty += (nameLines.length - 1) * 4.1;
    const detail = pdfText(item.detail || '');
    if (detail) {
      ty += 3.8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.4);
      ink(MUTED);
      doc.text(fitLines(detail, textW, 1)[0], textX, ty);
    }

    // Nota de quien busca: en un recuadro amarillo con borde, para que se note
    const note = String(item.note || '').trim();
    if (note) {
      const available = top + FRAME_H - 2.4 - (ty + 2.2);
      const maxLines = Math.max(1, Math.min(3, Math.floor((available - 5.4) / 3.5)));
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      const lines = fitLines(note, textW - 7, maxLines);
      const boxH = 5.4 + lines.length * 3.5;
      const boxY = top + FRAME_H - 2.4 - boxH;
      fill(NOTE_BG);
      doc.roundedRect(textX - 0.5, boxY, textW + 1, boxH, 1.8, 1.8, 'F');
      fill(YELLOW);
      doc.roundedRect(textX - 0.5, boxY, 1.7, boxH, 0.85, 0.85, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.2);
      ink(NOTE_LABEL);
      doc.text('NOTA', textX + 3, boxY + 3.2);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      ink(NOTE_INK);
      lines.forEach((line, index) => doc.text(line, textX + 3, boxY + 6.4 + index * 3.5));
    }

    // Tocar la carta abre el WhatsApp de quien la busca con el mensaje ya escrito
    if (whatsapp) doc.link(x, top, CARD_W, FRAME_H, { url: contactUrl(item) });
  };

  groups.forEach((group) => {
    if (groups.length > 1) {
      if (y + 11 + FRAME_H > limit) newPage();
      // Rótulo del juego: una línea con una pastilla al centro
      fill([200, 212, 238]);
      doc.rect(MARGIN, y + 4, PAGE_W - MARGIN * 2, 0.4, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      const label = `${pdfText(group.name)}  -  ${group.items.length} ${group.items.length === 1 ? 'carta' : 'cartas'}`;
      const width = doc.getTextWidth(label) + 12;
      fill(BLUE);
      doc.roundedRect((PAGE_W - width) / 2, y, width, 8.4, 4.2, 4.2, 'F');
      fill(YELLOW);
      doc.circle((PAGE_W - width) / 2 + 4.6, y + 4.2, 1.1, 'F');
      ink(WHITE);
      doc.text(label, PAGE_W / 2 + 1.6, y + 5.6, { align: 'center' });
      y += 14.5; // deja lugar al círculo de copias, que sobresale por arriba de la primera fila
    }

    for (let start = 0; start < group.items.length; start += COLS) {
      if (y + FRAME_H > limit) newPage();
      group.items.slice(start, start + COLS).forEach((item, column) => drawCard(item, GRID_X + column * (CARD_W + GAP_X), y));
      y += FRAME_H + ROW_GAP;
    }
  });

  // Pie en todas las páginas
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    // Solo el logo de la cabecera lleva al sitio: la marca de agua del fondo y el pie no se pueden tocar por error
    if (page === 1) doc.link(MARGIN, 8, 21, 21, { url: SITE_URL });
    else doc.link(MARGIN, 3.2, 9.6, 9.6, { url: SITE_URL });
    fill([200, 212, 238]);
    doc.rect(MARGIN, PAGE_H - 10.4, PAGE_W - MARGIN * 2, 0.35, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    ink(BLUE);
    doc.text('carpetazo.cl', MARGIN, PAGE_H - 5.6);
    doc.setFont('helvetica', 'normal');
    ink(MUTED);
    doc.text(whatsapp ? 'Toca la carta que tengas y escríbeme por WhatsApp' : pdfText(dateLabel), PAGE_W / 2, PAGE_H - 5.6, { align: 'center' });
    if (pages > 1) doc.text(`${page} / ${pages}`, PAGE_W - MARGIN, PAGE_H - 5.6, { align: 'right' });
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
