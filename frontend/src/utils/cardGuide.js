// Marco guía de la cámara: dónde debe quedar la carta (coordenadas 0..1 sobre la imagen del vídeo) y si la carta detectada calza con él.
const CARD = 63 / 88 // proporción de una carta TCG

// ar = ancho/alto del vídeo
export const guideRect = (ar) => {
  let fw = 0.62
  let fh = (fw * ar) / CARD
  if (fh > 0.75) { fh = 0.75; fw = (fh * CARD) / ar }
  return { x: (1 - fw) / 2, y: (1 - fh) / 2, w: fw, h: fh }
}

// Tolerante: la mano nunca deja la carta exacta. Centro cerca del centro y tamaño parecido al del marco.
export const isAligned = (corners, guide) => {
  if (!corners) return false
  const xs = corners.map((p) => p[0])
  const ys = corners.map((p) => p[1])
  const w = Math.max(...xs) - Math.min(...xs)
  const h = Math.max(...ys) - Math.min(...ys)
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2
  return Math.abs(cx - 0.5) < 0.1 && Math.abs(cy - 0.5) < 0.1 && w / guide.w > 0.75 && w / guide.w < 1.2 && h / guide.h > 0.75 && h / guide.h < 1.2
}
