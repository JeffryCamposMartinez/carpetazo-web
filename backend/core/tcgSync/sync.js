// Sincronización del catálogo de TCGplayer (TCGCSV): lo que TcgplayerUpdate hace a mano, pero sin pasar por el disco.
// Por cada edición que cambió: las cartas y productos que NO están en la base se suben directo a R2 (imagen grande, miniatura y data.json,
// con las mismas rutas de TcgplayerUpdate) y se guardan en CatalogCard. Lo que ya existe no se toca: si TCGplayer lo corrigió,
// la diferencia queda en CatalogChange para revisarla a mano. No borra nada.
import { createHash } from 'node:crypto';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { prisma } from '../db.js';
import { r2Client, hasR2Config } from '../r2.js';
import { normalizeTcgFile, TCG_IMPORT_FORMAT } from '../tcgCatalogImport.js';
import { CLASSIFIER_VERSION, classifyProduct } from './classify.js';
import { MAX_NAME, gameFolderName, itemBaseName, itemKeys, safeSegment, uniqueNames, withId } from './naming.js';
import { TcgcsvClient } from './tcgcsv.js';
import { convertImage, fetchBestImage } from './images.js';

const DATA_SCHEMA = 1;
const CACHE_CONTROL = 'public, max-age=31536000, immutable';
const CHUNK = 100; // elementos nuevos por escritura en la base
// Juegos del sitio (TCGCSV categoryId): Magic, Yu-Gi-Oh!, Pokémon, Pokémon Japón, One Piece, Riftbound, Disney Lorcana y Digimon
export const DEFAULT_CATEGORIES = [1, 2, 3, 85, 68, 89, 71, 63];
const COMPARED = ['kind', 'name', 'number', 'rarity', 'attributes', 'sourceImageUrl', 'tcgplayerUrl'];
const MAX_CHANGES_PER_RUN = 3000;

const stripHtml = (value) => String(value ?? '')
  .replace(/<\s*br\s*\/?>/gi, '\n').replace(/<\/\s*(p|div|li)\s*>/gi, '\n').replace(/<[^>]*>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, "'")
  .replace(/[ \t]+\n/g, '\n').trim();
export const attributesOf = (product) => Object.fromEntries((product.extendedData || []).filter((entry) => entry?.name).map((entry) => [entry.name, stripHtml(entry.value)]));

// Las fechas de TCGplayer vienen sin zona horaria; se guardan como UTC
export const toIso = (value) => {
  if (!value) return null;
  const text = String(value);
  const date = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(text) ? text : `${text}Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};
const time = (value) => (value ? new Date(value).getTime() : null);

const cleanAttributes = (value) => {
  const out = {};
  for (const [name, raw] of Object.entries(value || {}).slice(0, 60)) {
    if (!name || name.length > 60 || (typeof raw !== 'string' && typeof raw !== 'number')) continue;
    const text = String(raw).slice(0, 4000);
    if (text.trim()) out[name] = text;
  }
  return Object.keys(out).length ? out : null;
};

const stable = (value) => JSON.stringify(value ?? null, (_key, inner) => (inner && typeof inner === 'object' && !Array.isArray(inner) ? Object.fromEntries(Object.entries(inner).sort(([a], [b]) => a.localeCompare(b))) : inner));
// Lo que la base no tiene (vacío) no es una corrección: solo cuenta cuando TCGplayer cambió un dato que ya estaba
const blank = (value) => value === null || value === undefined || value === '' || (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0);
// Espacios y saltos de línea no cuentan (la carga manual y esta los dejan distinto)
const squash = (value) => {
  if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim();
  if (value && typeof value === 'object' && !Array.isArray(value)) return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, squash(inner)]));
  return value;
};
export const changedFields = (existing, card) => COMPARED.filter((field) => !blank(existing[field]) && stable(squash(existing[field])) !== stable(squash(card[field] ?? null)));

// Carpeta de la edición: la que ya tiene en la base; una nueva sale de los nombres de todo el juego (igual que TcgplayerUpdate)
export const editionFolders = (groups, takenFolders = new Set()) => {
  const names = uniqueNames(groups.map((group) => ({ id: group.groupId, base: safeSegment(group.name, `Edicion_${group.groupId}`, MAX_NAME) })));
  const result = new Map();
  for (const group of groups) {
    const base = safeSegment(group.name, `Edicion_${group.groupId}`, MAX_NAME);
    const name = names.get(String(group.groupId));
    result.set(group.groupId, takenFolders.has(name.toLowerCase()) ? withId(base, group.groupId) : name);
  }
  return result;
};

// Clasifica los productos de una edición y les da carpeta (cartas y productos tienen árboles separados, igual que TcgplayerUpdate)
export const planItems = (products) => {
  const classified = products.map((product) => {
    const attributes = attributesOf(product);
    return { product, attributes, ...classifyProduct(product, attributes) };
  });
  const items = [];
  for (const kind of ['card', 'product']) {
    const list = classified.filter((item) => item.kind === kind);
    const names = uniqueNames(list.map((item) => ({ id: item.product.productId, base: itemBaseName(item.product.name, kind === 'card' ? item.attributes.Number : '') })));
    for (const item of list) items.push({ ...item, itemFolder: names.get(String(item.product.productId)) });
  }
  return items;
};

const defaultUpload = async (key, body, type) => {
  const md5 = createHash('md5').update(body).digest('hex');
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await r2Client.send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key, Body: body, ContentType: type, CacheControl: CACHE_CONTROL }));
    if (String(result.ETag || '').replaceAll('"', '').toLowerCase() === md5) return; // R2 devuelve el MD5: así se verifica que llegó completo
  }
  throw new Error('La verificación de integridad (MD5) no coincide');
};

const defaultImages = async (imageUrl) => convertImage(await fetchBestImage(imageUrl));

const pool = async (list, size, task) => {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(size, list.length) }, async () => {
    while (cursor < list.length) await task(list[cursor++]);
  }));
};

const acquireRun = async (db, dryRun) => {
  if (dryRun) return { id: null };
  // Un solo recorrido a la vez; una corrida que quedó "running" hace más de 3 horas se considera muerta
  const rows = await db.$queryRaw`INSERT INTO "CatalogSyncRun" ("id","status","dryRun","startedAt") SELECT gen_random_uuid()::text,'running',false,(now() AT TIME ZONE 'UTC') WHERE NOT EXISTS (SELECT 1 FROM "CatalogSyncRun" WHERE "source"='tcgplayer' AND "status"='running' AND "startedAt" > (now() AT TIME ZONE 'UTC') - interval '3 hours') RETURNING "id"`;
  return rows[0] || null;
};

export async function runSync(options = {}) {
  const {
    db = prisma, categories = DEFAULT_CATEGORIES, dryRun = false, imageCap = 6000, maxMinutes = 50, limitSets = 0, allEditions = false,
    client = new TcgcsvClient({ onWait: (message) => options.log?.(message) }), upload = defaultUpload, getImages = defaultImages,
    log = (message) => console.log(message),
  } = options;
  const started = Date.now();
  const deadline = started + maxMinutes * 60000;
  const total = { games: 0, groupsChecked: 0, groupsSkipped: 0, groupsError: 0, newCards: 0, newProducts: 0, imagesFilled: 0, imagesUploaded: 0, noImage: 0, failed: 0, pending: 0, changes: 0, rejected: 0, stopped: '' };
  const budget = { images: 0 };
  const outOfBudget = () => {
    if (Date.now() > deadline) { total.stopped ||= 'tiempo'; return true; }
    if (budget.images >= imageCap) { total.stopped ||= 'tope de imágenes'; return true; }
    return false;
  };

  if (!dryRun && !options.upload && !hasR2Config()) throw new Error('Falta la configuración de R2 (R2_*).');
  const run = await acquireRun(db, dryRun);
  if (!run) { log('Ya hay una sincronización en curso (o terminó hace menos de 3 horas sin cerrarse). No se hace nada.'); return { skipped: true, ...total }; }
  log(`Sincronización del catálogo TCG${dryRun ? ' (PRUEBA: no se escribe nada)' : ''}: ${categories.length} juego(s), tope ${imageCap} imágenes, ${maxMinutes} min`);

  let failedGames = 0;
  try {
    const remoteCategories = await client.categories();
    for (const categoryId of categories) {
      if (outOfBudget()) break;
      const remote = remoteCategories.find((item) => item.categoryId === categoryId);
      const dbGame = await db.catalogGame.findUnique({ where: { categoryId } });
      if (!remote && !dbGame) { log(`Juego ${categoryId}: TCGCSV no lo lista; se omite.`); continue; }
      const category = { categoryId, name: remote?.name, displayName: remote?.displayName || remote?.name };
      const game = dbGame || { categoryId, name: String(category.displayName).slice(0, 120), folder: gameFolderName(category) };
      const gameStats = { checked: 0, skipped: 0, cards: 0, products: 0, filled: 0, images: 0, noImage: 0, failed: 0, pending: 0, changes: 0, rejected: 0 };
      total.games += 1;
      try {
        await syncGame({ db, client, category, game, gameStats, dryRun, upload, getImages, log, budget, outOfBudget, limitSets, allEditions });
      } catch (error) {
        failedGames += 1;
        log(`${game.name}: ERROR ${error.message}`);
      }
      for (const [from, to] of [['checked', 'groupsChecked'], ['skipped', 'groupsSkipped'], ['cards', 'newCards'], ['products', 'newProducts'], ['filled', 'imagesFilled'], ['images', 'imagesUploaded'], ['noImage', 'noImage'], ['failed', 'failed'], ['pending', 'pending'], ['changes', 'changes'], ['rejected', 'rejected']]) total[to] += gameStats[from];
      log(`${game.name}: ${gameStats.checked} ediciones revisadas (${gameStats.skipped} sin cambios) · ${gameStats.cards} cartas y ${gameStats.products} productos nuevos · ${gameStats.filled} imágenes completadas · ${gameStats.images} imágenes subidas · ${gameStats.failed} fallidas · ${gameStats.pending} para mañana · ${gameStats.changes} correcciones por revisar`);
    }
  } catch (error) {
    failedGames += 1;
    log(`ERROR: ${error.message}`);
  }

  const status = failedGames > 0 && total.games === 0 ? 'failed' : (failedGames > 0 || total.stopped || total.failed > 0 ? 'partial' : 'ok');
  const seconds = Math.round((Date.now() - started) / 1000);
  const summary = { ...total, failedGames, seconds };
  if (run.id) await db.catalogSyncRun.update({ where: { id: run.id }, data: { status, finishedAt: new Date(), summary } });
  log(`Fin (${status}) en ${Math.floor(seconds / 60)} min ${seconds % 60} s: ${total.newCards} cartas y ${total.newProducts} productos nuevos, ${total.imagesFilled} imágenes completadas, ${total.imagesUploaded} imágenes, ${total.failed} fallidas, ${total.pending} para mañana, ${total.changes} correcciones por revisar${total.stopped ? ` · se detuvo por ${total.stopped}; sigue la próxima noche` : ''}`);
  return { status, ...summary };
}

async function syncGame({ db, client, category, game, gameStats, dryRun, upload, getImages, log, budget, outOfBudget, limitSets, allEditions }) {
  const groups = await client.groups(category.categoryId);
  if (groups.length === 0) { log(`${game.name}: TCGplayer no tiene ediciones`); return; }
  const dbSets = await db.catalogSet.findMany({ where: { categoryId: category.categoryId }, select: { groupId: true, folder: true, modifiedOn: true } });
  const setById = new Map(dbSets.map((set) => [set.groupId, set]));
  const taken = new Set(dbSets.map((set) => set.folder.toLowerCase()));
  const folders = editionFolders(groups.filter((group) => !setById.has(group.groupId)), taken);
  let changeBudget = MAX_CHANGES_PER_RUN;

  for (const group of limitSets ? groups.slice(0, limitSets) : groups) {
    if (outOfBudget()) return;
    const dbSet = setById.get(group.groupId);
    if (!allEditions && dbSet?.modifiedOn && time(dbSet.modifiedOn) === time(toIso(group.modifiedOn))) { gameStats.skipped += 1; continue; }
    gameStats.checked += 1;
    const products = await client.products(category.categoryId, group.groupId);
    if (products === null) { log(`${game.name} › ${group.name}: sin datos en TCGplayer`); continue; }
    const editionFolder = dbSet?.folder || folders.get(group.groupId);
    const set = {
      groupId: group.groupId, categoryId: category.categoryId, name: String(group.name).slice(0, 120), folder: editionFolder,
      abbreviation: group.abbreviation ? String(group.abbreviation).slice(0, 40) : null, publishedOn: toIso(group.publishedOn), modifiedOn: toIso(group.modifiedOn),
    };

    const ids = products.map((product) => product.productId);
    const existingRows = await db.catalogCard.findMany({ where: { productId: { in: ids } } });
    const existingById = new Map(existingRows.map((row) => [row.productId, row]));
    const usedFolders = { card: new Set(), product: new Set() };
    for (const row of existingRows) if (row.groupId === group.groupId) usedFolders[row.kind]?.add(row.folder.toLowerCase());

    const items = planItems(products);
    const rows = items.map((item) => {
      const { product, attributes, kind } = item;
      const existing = existingById.get(product.productId);
      let folder = existing?.folder || item.itemFolder;
      if (!existing && usedFolders[kind].has(folder.toLowerCase())) folder = withId(folder, product.productId);
      const keys = existing ? { imageKey: existing.imageKey, thumbKey: existing.thumbKey, dataKey: existing.dataKey } : itemKeys(game.folder, kind, editionFolder, folder);
      return {
        item, existing, row: {
          productId: product.productId, categoryId: category.categoryId, groupId: group.groupId, kind,
          name: String(product.name || '').slice(0, 200), number: attributes.Number ? String(attributes.Number).slice(0, 60) : null,
          rarity: attributes.Rarity ? String(attributes.Rarity).slice(0, 60) : null, folder, ...keys,
          sourceImageUrl: product.imageUrl || null, tcgplayerUrl: product.url || null, attributes: cleanAttributes(attributes), modifiedOn: toIso(product.modifiedOn),
        },
      };
    });

    // Misma validación que la carga manual de Moderación; se hace antes de subir nada para no subir lo que se va a rechazar
    const valid = [];
    for (let at = 0; at < rows.length; at += 4500) {
      const slice = rows.slice(at, at + 4500);
      const checked = normalizeTcgFile({ format: TCG_IMPORT_FORMAT, version: 1, games: [{ categoryId: game.categoryId, name: game.name, folder: game.folder }], sets: [set], cards: slice.map((entry) => entry.row) });
      if (checked.fatal) { log(`${game.name} › ${group.name}: ${checked.fatal}`); continue; }
      gameStats.rejected += checked.errors.length;
      for (const error of checked.errors.slice(0, 3)) log(`${game.name} › ${group.name} › ${error.name}: rechazada (${error.message})`);
      const byId = new Map(slice.map((entry) => [entry.row.productId, entry]));
      for (const card of checked.cards) valid.push({ ...byId.get(card.productId), card });
    }

    // Lo que ya existe no se toca: las diferencias quedan para revisión manual
    const changes = [];
    for (const { existing, card } of valid) {
      if (!existing || existing.categoryId !== category.categoryId) continue;
      const fields = changedFields(existing, card);
      if (fields.length === 0) continue;
      const after = Object.fromEntries(fields.map((field) => [field, card[field] ?? null]));
      changes.push({ productId: card.productId, categoryId: category.categoryId, groupId: existing.groupId, digest: createHash('sha1').update(stable(after)).digest('hex').slice(0, 20), before: Object.fromEntries(fields.map((field) => [field, existing[field] ?? null])), after });
    }
    const fresh = valid.filter((entry) => !entry.existing);
    // Lo que ya está en la base pero sin imagen, y TCGplayer ya la tiene: se completa solo la imagen (no cuenta como corrección)
    const fill = valid.filter((entry) => entry.existing && entry.existing.categoryId === category.categoryId && !entry.existing.imageKey && entry.card.sourceImageUrl && entry.item.product.imageCount !== 0);
    gameStats.changes += Math.min(changes.length, Math.max(0, changeBudget));
    if (!dryRun && changes.length && changeBudget > 0) {
      await db.catalogChange.createMany({ data: changes.slice(0, changeBudget), skipDuplicates: true });
      changeBudget -= changes.length;
    }

    let complete = true;
    if (dryRun) {
      for (const entry of fresh) gameStats[entry.card.kind === 'card' ? 'cards' : 'products'] += 1;
      gameStats.filled += fill.length;
      continue;
    }
    const { groupId, ...setData } = set;
    if (!dbSet) {
      // Una edición nueva queda con modifiedOn vacío hasta terminarla: así, si falta algo, mañana se vuelve a revisar
      await db.catalogGame.upsert({ where: { categoryId: game.categoryId }, create: { categoryId: game.categoryId, name: game.name, folder: game.folder }, update: {} });
      await db.catalogSet.create({ data: { ...set, modifiedOn: null } });
    }

    for (let at = 0; at < fresh.length; at += CHUNK) {
      const done = [];
      await pool(fresh.slice(at, at + CHUNK), 6, async (entry) => {
        const { card, item } = entry;
        const label = `${game.name} › ${group.name} › ${card.name}`;
        try {
          const wantsImage = card.sourceImageUrl && item.product.imageCount !== 0;
          let keys = { imageKey: card.imageKey, thumbKey: card.thumbKey };
          if (wantsImage) {
            if (outOfBudget()) { complete = false; gameStats.pending += 1; return; }
            budget.images += 1;
            try {
              const { large, thumb } = await getImages(card.sourceImageUrl);
              await upload(card.imageKey, large, 'image/webp');
              await upload(card.thumbKey, thumb, 'image/webp');
              gameStats.images += 1;
            } catch (error) {
              if (!error.noImage) throw error;
              keys = { imageKey: null, thumbKey: null }; // TCGplayer no tiene imagen de este elemento: no es un fallo
              gameStats.noImage += 1;
            }
          } else keys = { imageKey: null, thumbKey: null };
          const data = {
            schema: DATA_SCHEMA, source: 'tcgcsv', kind: card.kind, classification: { kind: card.kind, reason: item.reason, version: CLASSIFIER_VERSION },
            game: game.folder, categoryId: category.categoryId, set: { groupId: group.groupId, name: group.name, abbreviation: group.abbreviation || null, publishedOn: group.publishedOn || null, modifiedOn: group.modifiedOn || null },
            productId: card.productId, name: item.product.name, cleanName: item.product.cleanName || null, number: item.attributes.Number || null, rarity: item.attributes.Rarity || null,
            imageUrl: item.product.imageUrl || null, url: item.product.url || null, modifiedOn: item.product.modifiedOn || null, imageCount: item.product.imageCount ?? null,
            attributes: item.attributes, extendedData: item.product.extendedData || [], downloadedAt: new Date().toISOString(),
          };
          await upload(card.dataKey, Buffer.from(JSON.stringify(data, null, 2)), 'application/json');
          done.push({ ...card, ...keys });
        } catch (error) {
          complete = false;
          gameStats.failed += 1;
          gameStats.pending += 1;
          log(`${label}: ${error.message}`);
        }
      });
      if (done.length) {
        await db.catalogCard.createMany({ data: done, skipDuplicates: true });
        for (const card of done) gameStats[card.kind === 'card' ? 'cards' : 'products'] += 1;
      }
    }
    for (let at = 0; at < fill.length; at += CHUNK) {
      await pool(fill.slice(at, at + CHUNK), 6, async ({ existing, card }) => {
        if (outOfBudget()) { complete = false; gameStats.pending += 1; return; }
        budget.images += 1;
        try {
          const { large, thumb } = await getImages(card.sourceImageUrl);
          const keys = itemKeys(game.folder, existing.kind, editionFolder, existing.folder);
          await upload(keys.imageKey, large, 'image/webp');
          await upload(keys.thumbKey, thumb, 'image/webp');
          await db.catalogCard.updateMany({ where: { productId: existing.productId, imageKey: null }, data: { imageKey: keys.imageKey, thumbKey: keys.thumbKey } });
          gameStats.filled += 1;
          gameStats.images += 1;
        } catch (error) {
          if (error.noImage) { gameStats.noImage += 1; return; } // TCGplayer aún no tiene la imagen: se vuelve a intentar cuando la edición cambie
          complete = false;
          gameStats.failed += 1;
          gameStats.pending += 1;
          log(`${game.name} › ${group.name} › ${card.name}: ${error.message}`);
        }
      });
    }
    if (complete && time(set.modifiedOn) !== time(dbSet?.modifiedOn)) await db.catalogSet.update({ where: { groupId }, data: { modifiedOn: setData.modifiedOn } });
  }
}
