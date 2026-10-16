import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { similarCardName } from './cardSearch.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const indexPath = process.env.TCG_SEARCH_INDEX || path.join(here, '..', 'data', 'tcg-search-index.json.gz');
let cached;

const load = () => {
  if (cached) return cached;
  if (!fs.existsSync(indexPath)) return null;
  try { cached = JSON.parse(zlib.gunzipSync(fs.readFileSync(indexPath), { maxOutputLength: 900 * 1024 * 1024 })); return cached; } catch (error) { console.error('No se pudo cargar índice TCG:', error.message); return null; }
};

export const searchTcgIndex = ({ query, game, page = 1, limit = 60 }) => {
  const index = load();
  if (!index) return { available: false, total: 0, page, pages: 0, cards: [] };
  const q = String(query || '').trim().toLowerCase();
  const normalized = q.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const rows = index.cards.filter((card) => (!game || card.game === game) && (card.clean.includes(normalized) || similarCardName(card.name, q)));
  const start = (page - 1) * limit;
  return { available: true, version: index.version, total: rows.length, page, pages: Math.max(1, Math.ceil(rows.length / limit)), cards: rows.slice(start, start + limit) };
};
