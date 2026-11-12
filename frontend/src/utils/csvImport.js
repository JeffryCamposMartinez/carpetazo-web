// Lee un CSV de cartas (exportación de TCGplayer, TCGmatch o la propia de Carpetazo) y lo deja como filas
// { line, productId, name, set, number, quantity, language, condition, finish, price } para importar a una carpeta.
// Las columnas se reconocen por su nombre (en inglés o español); el precio solo se toma de columnas en pesos, nunca en dólares.

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 20000;

const HEADERS = {
  productId: ['productid', 'tcgplayerid', 'tcgplayerproductid', 'idtcgplayer', 'idproducto', 'codigo'],
  name: ['productname', 'name', 'cardname', 'nombre', 'nombredelacarta', 'carta', 'simplename'],
  set: ['setname', 'set', 'edicion', 'expansion', 'coleccion'],
  number: ['cardnumber', 'number', 'collectornumber', 'numero', 'numerodecarta'],
  quantity: ['quantity', 'qty', 'count', 'cantidad', 'totalquantity', 'stock'],
  language: ['language', 'idioma', 'lang'],
  condition: ['condition', 'estado', 'cond'],
  finish: ['printing', 'finish', 'acabado', 'foil', 'variant', 'variante'],
  price: ['precioclp', 'preciocl', 'precio', 'priceclp'],
};

const plain = (text) => String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const squash = (text) => plain(text).replace(/ /g, '');

const LANGUAGES = [[/^(en|english|ingles)/, 'English'], [/^(es|spanish|espanol|castellano)/, 'Spanish'], [/^(ja|jp|japanese|japones)/, 'Japanese']];
const languageOf = (value) => { const text = plain(value); return LANGUAGES.find(([pattern]) => pattern.test(text))?.[1] || ''; };

// Estado de TCGplayer (Near Mint…) o de Carpetazo (1 a 5) → 1 a 5; vacío si no se reconoce
const conditionOf = (value) => {
  const text = plain(value);
  if (/^[1-5]$/.test(text)) return Number(text);
  if (/^(near mint|nm|mint|perfecta)\b/.test(text)) return 5;
  if (/^(lightly played|slightly played|lp|sp|excelente|excellent)\b/.test(text)) return 4;
  if (/^(moderately played|mp|played|good|buena)\b/.test(text)) return 3;
  if (/^(heavily played|hp|poor|regular)\b/.test(text)) return 2;
  if (/^(damaged|dmg|danada)\b/.test(text)) return 1;
  return null;
};

// El inventario de vendedor de TCGplayer junta estado y acabado en una columna («Near Mint Foil»): lo que sobra del estado es el acabado
const finishFromCondition = (value) => plain(value).replace(/^(near mint|lightly played|moderately played|heavily played|damaged|unopened)\s*/, '').replace(/(^|\s)\w/g, (match) => match.toUpperCase());

// Texto CSV → matriz de celdas (comillas dobles, saltos de línea dentro de comillas y separador , ; o tabulación)
const parseCells = (text) => {
  const first = text.split(/\r?\n/, 1)[0];
  const separator = [',', ';', '\t'].map((char) => [char, first.split(char).length]).sort((a, b) => b[1] - a[1])[0][0];
  const table = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i += 1; } else if (char === '"') quoted = false; else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === separator) { row.push(cell); cell = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell); cell = '';
      if (row.some((value) => value.trim())) table.push(row);
      row = [];
    } else cell += char;
  }
  row.push(cell);
  if (row.some((value) => value.trim())) table.push(row);
  return table;
};

export const parseCardsCsv = (rawText, size = rawText.length) => {
  if (size > MAX_BYTES) return { error: 'El archivo es muy grande (máximo 5 MB).' };
  const table = parseCells(String(rawText).replace(/^﻿/, ''));
  if (table.length < 2) return { error: 'El archivo no tiene cartas.' };
  const heads = table[0].map(squash);
  const column = (field) => { for (const alias of HEADERS[field]) { const index = heads.indexOf(alias); if (index >= 0) return index; } return -1; };
  const at = Object.fromEntries(Object.keys(HEADERS).map((field) => [field, column(field)]));
  if (at.productId < 0 && at.name < 0) return { error: 'No reconocimos las columnas. El archivo necesita el nombre de la carta o su ID de TCGplayer.' };
  if (table.length - 1 > MAX_ROWS) return { error: `El archivo tiene más de ${MAX_ROWS.toLocaleString('es-CL')} filas.` };

  const get = (cells, field) => (at[field] >= 0 ? String(cells[at[field]] ?? '').trim() : '');
  const rows = table.slice(1).map((cells, index) => {
    const productId = get(cells, 'productId');
    const quantity = parseInt(get(cells, 'quantity'), 10);
    if (quantity === 0) return null; // inventario de TCGplayer: filas publicadas sin existencias
    const price = Number(get(cells, 'price').replace(/[^\d.]/g, ''));
    return {
      line: index + 2,
      ...(/^\d+$/.test(productId) ? { productId: Number(productId) } : {}),
      name: get(cells, 'name').slice(0, 300), set: get(cells, 'set').slice(0, 200), number: get(cells, 'number').slice(0, 30),
      quantity: quantity > 0 ? Math.min(quantity, 100000) : 1,
      ...(languageOf(get(cells, 'language')) ? { language: languageOf(get(cells, 'language')) } : {}),
      condition: conditionOf(get(cells, 'condition')),
      finish: (get(cells, 'finish') || (at.finish < 0 ? finishFromCondition(get(cells, 'condition')) : '')).slice(0, 40),
      price: at.price >= 0 && price > 0 && price <= 100000000 ? price : null,
    };
  }).filter((row) => row && (row.productId || row.name));
  if (!rows.length) return { error: 'No encontramos cartas en el archivo.' };
  return { rows, withIds: rows.filter((row) => row.productId).length, copies: rows.reduce((sum, row) => sum + row.quantity, 0) };
};
