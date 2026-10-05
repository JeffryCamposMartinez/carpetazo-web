// Utilidades de color: color promedio de una imagen, complementario y texto legible sobre un fondo.

export const getAverageRGB = (imgEl, width, height) => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(imgEl, 0, 0, width, height);
  try {
    const data = ctx.getImageData(0, 0, width, height).data;
    let r = 0; let g = 0; let b = 0; let count = 0;
    for (let i = 0; i < data.length; i += 400) {
      r += data[i]; g += data[i + 1]; b += data[i + 2]; count += 1;
    }
    return { r: Math.floor(r / count), g: Math.floor(g / count), b: Math.floor(b / count) };
  } catch {
    return { r: 26, g: 43, b: 75 };
  }
};

export const rgbToHsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0; let s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    if (max === g) h = (b - r) / d + 2;
    if (max === b) h = (r - g) / d + 4;
    h /= 6;
  }
  return [h * 360, s, l];
};

export const getComplementaryHex = (r, g, b) => {
  let [h, s, l] = rgbToHsl(r, g, b);
  h = (h + 180) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let rp = 0; let gp = 0; let bp = 0;
  if (h < 60) { rp = c; gp = x; }
  else if (h < 120) { rp = x; gp = c; }
  else if (h < 180) { gp = c; bp = x; }
  else if (h < 240) { gp = x; bp = c; }
  else if (h < 300) { rp = x; bp = c; }
  else { rp = c; bp = x; }
  const toHex = (value) => Math.round((value + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(rp)}${toHex(gp)}${toHex(bp)}`;
};

// Color de texto legible sobre un fondo (blanco u oscuro según su luminosidad)
export const readableOn = (hex = '#000000') => {
  const clean = String(hex).replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const value = Number.parseInt(full.slice(0, 6), 16);
  if (!Number.isFinite(value)) return '#ffffff';
  const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#0b1b33' : '#ffffff';
};
