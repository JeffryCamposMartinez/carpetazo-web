// Las cartas de Yu-Gi-Oh! son más angostas (59:86) y casi rectas: se redondean apenas, lo justo para tapar las esquinas blancas de las fotos.
const YUGIOH_RADIUS = '2.5% / 1.75%';
export const isYugioh = (tcg) => /^yu-?gi-?oh!?$/i.test(String(tcg || '').trim());
export const cardRatio = (tcg, fallback = '63 / 88') => (isYugioh(tcg) ? '59 / 86' : fallback);
// Esquinas apenas redondeadas solo para Yu-Gi-Oh!; en los demás juegos se deja el redondeo que ya tenía cada pantalla
// Si la imagen queda más chica que el marco, se estira un poco para llenarlo (objectFit: fill)
export const cardCorners = (tcg) => (isYugioh(tcg) ? { borderRadius: YUGIOH_RADIUS, objectFit: 'fill' } : undefined);
// Todas las cartas de Yu-Gi-Oh! usan el mismo marco (59:86) y la imagen se estira hasta llenarlo de lado a lado y de arriba abajo
// (algunas fotos son un poco más bajas que otras: así no quedan espacios vacíos ni tarjetas de distinto alto en una fila)
export const cardFit = (tcg) => (isYugioh(tcg) ? { borderRadius: YUGIOH_RADIUS, objectFit: 'fill', width: '100%', height: '100%' } : undefined);
// Para marcos con tamaño fijo y la imagen puesta con margen: en Yu-Gi-Oh! la imagen se estira hasta ocupar todo el contenedor, de lado a lado y de arriba abajo
export const cardFill = (tcg) => (isYugioh(tcg) ? { borderRadius: YUGIOH_RADIUS, objectFit: 'fill', inset: 0, width: '100%', height: '100%' } : undefined);
