// Lista de cartas escrita a mano, una por línea: «2x Charizard ex», «Charizard ex x2», «3 Pikachu» o solo el nombre.
const LINE_RE = [/^(\d{1,3})\s*[xX×]?\s+(.+)$/, /^(.+?)\s+[xX×]\s*(\d{1,3})$/];

export const parseCardLines = (text) => String(text || '')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)
  .slice(0, 200)
  .map((line) => {
    const lead = line.match(LINE_RE[0]);
    if (lead) return { name: lead[2].trim().slice(0, 120), quantity: Math.max(1, Number(lead[1])) };
    const tail = line.match(LINE_RE[1]);
    if (tail) return { name: tail[1].trim().slice(0, 120), quantity: Math.max(1, Number(tail[2])) };
    return { name: line.slice(0, 120), quantity: 1 };
  });

export const totalCards = (items) => items.reduce((sum, i) => sum + (i.quantity || 1), 0);

export const BUY_STATUS = { pending: 'Esperando oferta', offered: 'Oferta recibida', accepted: 'Aceptada', rejected: 'Rechazada', cancelled: 'Cancelada' };
