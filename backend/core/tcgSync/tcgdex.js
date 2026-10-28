// Corrida de cartas en español desde TCGdex (https://api.tcgdex.net/v2/es): juego aparte «Pokémon (Español)» dentro del mismo catálogo.
// TCGdex no tiene ids de TCGplayer, así que las ediciones y cartas reciben ids propios (rangos altos, sin choque con TCGCSV) y se reconocen
// por el id de TCGdex (edición: abbreviation; carta: número dentro de la edición). Solo entran cartas que ya tienen imagen en español.
// Lo que ya existe no se toca. Mismas rutas de R2, validación y candado que la sincronización de TCGplayer.
import { prisma } from '../db.js';
import { hasR2Config } from '../r2.js';
import { normalizeTcgFile, TCG_IMPORT_FORMAT } from '../tcgCatalogImport.js';
import { itemBaseName, itemKeys, safeSegment, uniqueNames, withId, MAX_NAME } from './naming.js';
import { defaultImages, defaultUpload, pool, toIso } from './sync.js';
import { sleep } from './tcgcsv.js';

export const TCGDEX_CATEGORY = 100; // 99 es Mitos y Leyendas
export const TCGDEX_GAME = { categoryId: TCGDEX_CATEGORY, name: 'Pokémon (Español)', folder: 'Pokemon_Espanol' };
const API = process.env.TCGDEX_BASE || 'https://api.tcgdex.net/v2';
const GROUP_BASE = 9000000;
const PRODUCT_BASE = 900000000;
const CHUNK = 100;

export const tcgdexJson = async (path, retries = 3, lang = 'es') => {
  let last;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(`${API}/${lang}${path}`, { signal: AbortSignal.timeout(30000), headers: { 'User-Agent': 'Carpetazo.cl/1.0 (sincronizacion de catalogo)', Accept: 'application/json' }, redirect: 'error' });
      if (response.status === 404) return null;
      if (response.status === 429 || response.status >= 500) { last = new Error(`HTTP ${response.status}`); await sleep(2000 * 3 ** attempt); continue; }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) { last = error; await sleep(1000 * 2 ** attempt); }
  }
  throw last;
};

// Cartas de una edición de TCGdex que vale la pena guardar: con imagen en español y número
export const usableCards = (detail) => (Array.isArray(detail?.cards) ? detail.cards : [])
  .filter((card) => card?.id && card.localId && card.name && typeof card.image === 'string' && card.image.startsWith('https://assets.tcgdex.net/'));

const acquireRun = async (db, dryRun) => {
  if (dryRun) return { id: null };
  const rows = await db.$queryRaw`INSERT INTO "CatalogSyncRun" ("id","status","dryRun","source","startedAt") SELECT gen_random_uuid()::text,'running',false,'tcgdex',(now() AT TIME ZONE 'UTC') WHERE NOT EXISTS (SELECT 1 FROM "CatalogSyncRun" WHERE "source"='tcgdex' AND "status"='running' AND "startedAt" > (now() AT TIME ZONE 'UTC') - interval '75 minutes') RETURNING "id"`;
  return rows[0] || null;
};

// Cada carta en español se enlaza con su carta inglesa de TCGplayer (guarda su id y el de su edición en attributes): de ahí salen los datos y el precio.
// 1) TCGdex trae el id de TCGplayer en ~la mitad de las cartas; 2) las demás se buscan por número dentro de la edición inglesa que más votos tuvo.
export const numberKey = (value) => String(value ?? '').split('/')[0].trim().toLowerCase().replace(/^0+(?=\d)/, '');
export async function linkTcgdexToEnglish({ db = prisma, getJson = tcgdexJson, log = (message) => console.log(message), dryRun = false } = {}) {
  const spanish = await db.catalogCard.findMany({ where: { categoryId: TCGDEX_CATEGORY }, select: { productId: true, groupId: true, number: true, attributes: true } });
  const todo = spanish.filter((row) => row.attributes?.TcgdexId && !row.attributes.TcgplayerProductId && row.attributes.TcgplayerLinked !== '0');
  const direct = new Map();
  const checked = new Set(); // cartas cuyo detalle sí se pudo leer: si no calzan con ninguna inglesa quedan marcadas (TcgplayerLinked = '0') y salen como cartas solo en español
  await pool(todo, 8, async (row) => {
    try {
      const id = (await getJson(`/cards/${encodeURIComponent(row.attributes.TcgdexId)}`))?.thirdParty?.tcgplayer;
      checked.add(row.productId);
      if (Number.isInteger(id)) direct.set(row.productId, id);
    } catch { /* se reintenta en la próxima corrida */ }
  });
  const english = new Map((await db.catalogCard.findMany({ where: { categoryId: { not: TCGDEX_CATEGORY }, kind: 'card', productId: { in: [...direct.values()] } }, select: { productId: true, groupId: true } })).map((row) => [row.productId, row.groupId]));
  const links = new Map(); // productId español -> { pid, gid } inglés
  const votes = new Map(); // edición española -> (edición inglesa -> votos)
  for (const row of spanish) { // las ya enlazadas en corridas anteriores también votan
    const gid = Number(row.attributes?.TcgplayerGroupId);
    if (!gid) continue;
    const tally = votes.get(row.groupId) || new Map();
    tally.set(gid, (tally.get(gid) || 0) + 1);
    votes.set(row.groupId, tally);
  }
  for (const row of todo) {
    const pid = direct.get(row.productId);
    if (!english.has(pid)) continue;
    links.set(row.productId, { pid, gid: english.get(pid) });
    const tally = votes.get(row.groupId) || new Map();
    tally.set(english.get(pid), (tally.get(english.get(pid)) || 0) + 1);
    votes.set(row.groupId, tally);
  }
  const direct_ = links.size;
  const mainGroup = new Map([...votes].map(([groupId, tally]) => [groupId, [...tally].sort((a, b) => b[1] - a[1])[0]]).filter(([, [, count]]) => count >= 2).map(([groupId, [gid]]) => [groupId, gid]));
  for (const [groupId, gid] of mainGroup) {
    const cards = await db.catalogCard.findMany({ where: { groupId: gid, kind: 'card' }, select: { productId: true, number: true } });
    const byNumber = new Map();
    for (const card of cards) byNumber.set(numberKey(card.number), [...(byNumber.get(numberKey(card.number)) || []), card.productId]);
    for (const row of todo) {
      if (row.groupId !== groupId || links.has(row.productId)) continue;
      const found = byNumber.get(numberKey(row.number));
      if (found?.length === 1) links.set(row.productId, { pid: found[0], gid });
    }
  }
  if (!dryRun) {
    const byId = new Map(todo.map((row) => [row.productId, row]));
    await pool([...links], 8, async ([productId, { pid, gid }]) => {
      await db.catalogCard.update({ where: { productId }, data: { attributes: { ...byId.get(productId).attributes, TcgplayerProductId: String(pid), TcgplayerGroupId: String(gid) } } });
    });
    await pool(todo.filter((row) => checked.has(row.productId) && !links.has(row.productId)), 8, async (row) => {
      await db.catalogCard.update({ where: { productId: row.productId }, data: { attributes: { ...row.attributes, TcgplayerLinked: '0' } } });
    });
  }
  log(`Enlace con las cartas inglesas: ${links.size} de ${todo.length} cartas por enlazar (${direct_} por el id de TCGplayer, ${links.size - direct_} por edición y número)`);
  return { todo: todo.length, linked: links.size };
}

export async function runTcgdexSync(options = {}) {
  const {
    db = prisma, dryRun = false, imageCap = 20000, maxMinutes = 55, limitSets = 0, getJson = tcgdexJson,
    upload = defaultUpload, getImages = defaultImages, log = (message) => console.log(message),
  } = options;
  const started = Date.now();
  const deadline = started + maxMinutes * 60000;
  const total = { sets: 0, newSets: 0, newCards: 0, images: 0, noImage: 0, failed: 0, pending: 0, rejected: 0, stopped: '' };
  const outOfBudget = () => {
    if (Date.now() > deadline) { total.stopped ||= 'tiempo'; return true; }
    if (total.images >= imageCap) { total.stopped ||= 'tope de imágenes'; return true; }
    return false;
  };

  if (!dryRun && !options.upload && !hasR2Config()) throw new Error('Falta la configuración de R2 (R2_*).');
  const run = await acquireRun(db, dryRun);
  if (!run) { log('Ya hay una corrida de TCGdex en curso (o empezó hace menos de 75 minutos sin cerrarse). No se hace nada.'); return { skipped: true, ...total }; }
  log(`Cartas en español (TCGdex)${dryRun ? ' (PRUEBA: no se escribe nada)' : ''}: tope ${imageCap} imágenes, ${maxMinutes} min`);

  let status = 'ok';
  try {
    const remoteSets = await getJson('/sets');
    if (!Array.isArray(remoteSets) || remoteSets.length === 0) throw new Error('TCGdex no devolvió ediciones');
    const dbSets = await db.catalogSet.findMany({ where: { categoryId: TCGDEX_CATEGORY }, select: { groupId: true, folder: true, abbreviation: true } });
    const setByTcgdex = new Map(dbSets.map((set) => [set.abbreviation, set]));
    const takenFolders = new Set(dbSets.map((set) => set.folder.toLowerCase()));
    let nextGroup = Math.max(GROUP_BASE, ...dbSets.map((set) => set.groupId)) + 1;
    const lastCard = await db.catalogCard.aggregate({ where: { categoryId: TCGDEX_CATEGORY }, _max: { productId: true } });
    let nextProduct = Math.max(PRODUCT_BASE, lastCard._max.productId || 0) + 1;

    const fresh = remoteSets.filter((set) => set?.id && !setByTcgdex.has(set.id));
    const folderNames = uniqueNames(fresh.map((set) => ({ id: set.id, base: safeSegment(set.name, `Edicion_${set.id}`, MAX_NAME) })));

    for (const remote of limitSets ? remoteSets.slice(0, limitSets) : remoteSets) {
      if (outOfBudget()) break;
      if (!remote?.id) continue;
      total.sets += 1;
      const detail = await getJson(`/sets/${encodeURIComponent(remote.id)}`);
      const cards = usableCards(detail);
      if (cards.length === 0) continue;

      let dbSet = setByTcgdex.get(remote.id);
      const existingRows = dbSet ? await db.catalogCard.findMany({ where: { groupId: dbSet.groupId }, select: { number: true, folder: true } }) : [];
      const have = new Set(existingRows.map((row) => row.number));
      const missing = cards.filter((card) => !have.has(String(card.localId).slice(0, 60)));
      if (missing.length === 0) continue;

      const base = safeSegment(detail.name || remote.name, `Edicion_${remote.id}`, MAX_NAME);
      const folder = dbSet?.folder || (takenFolders.has(folderNames.get(remote.id)?.toLowerCase()) ? withId(base, remote.id) : folderNames.get(remote.id) || base);
      const set = { groupId: dbSet?.groupId ?? nextGroup, categoryId: TCGDEX_CATEGORY, name: String(detail.name || remote.name).slice(0, 120), folder, abbreviation: String(remote.id).slice(0, 40), publishedOn: toIso(detail.releaseDate), modifiedOn: null };

      const used = new Set(existingRows.map((row) => row.folder.toLowerCase()));
      const names = uniqueNames(missing.map((card) => ({ id: card.localId, base: itemBaseName(card.name, card.localId) })));
      const rows = missing.map((card) => {
        let itemFolder = names.get(String(card.localId));
        if (used.has(itemFolder.toLowerCase())) itemFolder = withId(itemFolder, card.localId);
        return {
          source: card, row: {
            productId: nextProduct++, categoryId: TCGDEX_CATEGORY, groupId: set.groupId, kind: 'card', name: String(card.name).slice(0, 200), number: String(card.localId).slice(0, 60), rarity: null,
            folder: itemFolder, ...itemKeys(TCGDEX_GAME.folder, 'card', folder, itemFolder), sourceImageUrl: `${card.image}/high.webp`, tcgplayerUrl: null, attributes: { TcgdexId: card.id, Language: 'es' }, modifiedOn: null,
          },
        };
      });
      const checked = normalizeTcgFile({ format: TCG_IMPORT_FORMAT, version: 1, games: [TCGDEX_GAME], sets: [set], cards: rows.map((entry) => entry.row) });
      if (checked.fatal) { log(`${set.name}: ${checked.fatal}`); continue; }
      total.rejected += checked.errors.length;
      for (const error of checked.errors.slice(0, 3)) log(`${set.name} › ${error.name}: rechazada (${error.message})`);
      const byId = new Map(rows.map((entry) => [entry.row.productId, entry]));
      const valid = checked.cards.map((card) => ({ card, source: byId.get(card.productId).source }));

      if (dryRun) { total.newCards += valid.length; if (!dbSet) total.newSets += 1; continue; }
      if (!dbSet) {
        await db.catalogGame.upsert({ where: { categoryId: TCGDEX_CATEGORY }, create: TCGDEX_GAME, update: {} });
        await db.catalogSet.create({ data: set });
        dbSet = { groupId: set.groupId, folder, abbreviation: remote.id };
        setByTcgdex.set(remote.id, dbSet);
        nextGroup += 1;
        total.newSets += 1;
      }
      for (let at = 0; at < valid.length; at += CHUNK) {
        const done = [];
        await pool(valid.slice(at, at + CHUNK), 6, async ({ card, source }) => {
          if (outOfBudget()) { total.pending += 1; return; }
          total.images += 1;
          try {
            const { large, thumb } = await getImages(card.sourceImageUrl);
            await upload(card.imageKey, large, 'image/webp');
            await upload(card.thumbKey, thumb, 'image/webp');
            const data = { schema: 1, source: 'tcgdex', kind: 'card', language: 'es', game: TCGDEX_GAME.folder, categoryId: TCGDEX_CATEGORY, set: { groupId: set.groupId, tcgdexId: remote.id, name: set.name, publishedOn: set.publishedOn }, productId: card.productId, tcgdexId: source.id, name: card.name, number: card.number, imageUrl: card.sourceImageUrl, downloadedAt: new Date().toISOString() };
            await upload(card.dataKey, Buffer.from(JSON.stringify(data, null, 2)), 'application/json');
            done.push(card);
          } catch (error) {
            total.images -= 1;
            if (error.noImage) { total.noImage += 1; return; } // sin imagen todavía: se reintenta en la próxima corrida
            total.failed += 1;
            total.pending += 1;
            log(`${set.name} › ${card.name}: ${error.message}`);
          }
        });
        if (done.length) { await db.catalogCard.createMany({ data: done, skipDuplicates: true }); total.newCards += done.length; }
      }
    }
  } catch (error) {
    status = 'failed';
    log(`ERROR: ${error.message}`);
  }

  if (!dryRun && status !== 'failed') {
    try { Object.assign(total, { linked: (await linkTcgdexToEnglish({ db, getJson, log })).linked }); } catch (error) { log(`Enlace con las cartas inglesas: ${error.message}`); }
  }
  if (status === 'ok' && (total.stopped || total.failed > 0)) status = 'partial';
  const seconds = Math.round((Date.now() - started) / 1000);
  if (run.id) await db.catalogSyncRun.update({ where: { id: run.id }, data: { status, finishedAt: new Date(), summary: { ...total, seconds } } });
  log(`Fin (${status}) en ${Math.floor(seconds / 60)} min ${seconds % 60} s: ${total.sets} ediciones revisadas · ${total.newSets} nuevas · ${total.newCards} cartas nuevas · ${total.noImage} sin imagen · ${total.failed} fallidas · ${total.rejected} rechazadas${total.stopped ? ` · se detuvo por ${total.stopped}` : ''}`);
  return { status, ...total, seconds };
}
