// Sincronización de Mitos y Leyendas con mazos.cl: lo que CarpetazoUpdate hace a mano, pero sin pasar por el disco.
// Por cada bloque: las cartas que NO están en la base se suben a R2 (imagen, con las mismas rutas de CarpetazoUpdate) y se guardan en la base;
// a las que ya están solo se les completa lo que les falta (datos en blanco o imagen). Lo que mazos.cl cambió de una carta existente
// NO se aplica: se cuenta como corrección para revisarla a mano. No borra nada.
import { createHash } from 'node:crypto';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { prisma } from '../db.js';
import { r2Client, hasR2Config } from '../r2.js';
import { r2PublicUrl } from '../tcgCatalogImport.js';
import { MazosClient } from './mazos.js';
import { MYL_BLOCKS, MYL_CATEGORY, cardChanges, cardExtData, cleanName, collectBlock, planBlock, safeName } from './plan.js';

const GROUP_ID_BASE = 900000; // ids propios para ediciones que no vienen de TCGplayer (los mismos que usa el script de importación)
const CACHE_CONTROL = 'public, max-age=31536000, immutable';
const CHUNK = 100; // cartas nuevas por escritura en la base
const IMAGE_HOSTS = new Set(['cdn.mazos.cl', 'codicetcg.b-cdn.net']); // de dónde se aceptan imágenes
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_FILLS_PER_RUN = 2000;
const MAX_LISTED = 600; // elementos que cada lista del resumen de la corrida guarda para el panel (el total siempre se cuenta completo)

const listed = (list, item) => { if (list.length < MAX_LISTED) list.push(item); };

const pool = async (list, size, task) => {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(size, list.length) }, async () => {
    while (cursor < list.length) await task(list[cursor++]);
  }));
};

// Imagen de una carta: solo https y hosts de mazos.cl; si no viene en WebP se convierte
export const fetchCardImage = async (url) => {
  const parsed = new URL(String(url));
  if (parsed.protocol !== 'https:' || !IMAGE_HOSTS.has(parsed.hostname)) throw new Error('Imagen de un origen no permitido');
  const response = await fetch(parsed, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`La imagen respondió ${response.status}`);
  if (!IMAGE_HOSTS.has(new URL(response.url).hostname)) throw new Error('Redirección a un origen no permitido');
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length <= 1024 || buffer.length > MAX_IMAGE_BYTES) throw new Error('Imagen vacía o demasiado grande');
  return /webp/i.test(response.headers.get('content-type') || '') ? buffer : sharp(buffer).webp({ quality: 82 }).toBuffer();
};

const defaultUpload = async (key, body) => {
  const md5 = createHash('md5').update(body).digest('hex');
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await r2Client.send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key, Body: body, ContentType: 'image/webp', CacheControl: CACHE_CONTROL }));
    if (String(result.ETag || '').replaceAll('"', '').toLowerCase() === md5) return; // R2 devuelve el MD5: así se verifica que llegó completo
  }
  throw new Error('La verificación de integridad (MD5) no coincide');
};

const acquireRun = async (db, dryRun) => {
  if (dryRun) return { id: null };
  // Un solo recorrido a la vez; una corrida que quedó "running" hace más de 3 horas se considera muerta
  const rows = await db.$queryRaw`INSERT INTO "CatalogSyncRun" ("id","status","dryRun","source","startedAt") SELECT gen_random_uuid()::text,'running',false,'myl',(now() AT TIME ZONE 'UTC') WHERE NOT EXISTS (SELECT 1 FROM "CatalogSyncRun" WHERE "source"='myl' AND "status"='running' AND "startedAt" > (now() AT TIME ZONE 'UTC') - interval '3 hours') RETURNING "id"`;
  return rows[0] || null;
};

const digestOf = (value) => createHash('sha1').update(JSON.stringify(value)).digest('hex');
const mapValues = (object, pick) => Object.fromEntries(Object.entries(object).map(([key, value]) => [key, pick(value)]));

// Deja para revisar a mano lo que mazos.cl corrigió y las cartas nuevas sin edición. Lo ya guardado no se repite (misma carta y mismo cambio).
const saveFindings = async (db, block, report) => {
  const rows = [
    ...report.correcciones.map((item) => ({ kind: 'correction', productId: item.id, name: item.name, blockName: block.name, digest: digestOf(item.changes), before: mapValues(item.changes, (change) => change.before), after: mapValues(item.changes, (change) => change.after) })),
    ...report.nuevasSinEdicion.map((item) => ({ kind: 'noEdition', productId: item.id, name: item.name, blockName: block.name, digest: 'sin-edicion' })),
  ];
  for (let i = 0; i < rows.length; i += 500) await db.mylSyncFinding.createMany({ data: rows.slice(i, i + 500), skipDuplicates: true });
};

// Lo que mazos.cl dice de un bloque: cartas de cada producto y el catálogo completo (Imperio no tiene productos)
export const readBlock = async (client, block, { limitProducts = 0, log = () => {} } = {}) => {
  let products = await client.products(block.key);
  if (limitProducts) products = products.slice(0, limitProducts);
  const productCards = [];
  for (const [index, product] of products.entries()) {
    productCards.push({ name: product.name, cards: await client.productCards(product.id) });
    if ((index + 1) % 20 === 0) log(`   productos ${index + 1}/${products.length}`);
  }
  const catalogCards = [];
  if (!limitProducts) {
    for await (const { page, pages, cards } of client.catalog(block.key)) {
      catalogCards.push(...cards);
      if (page % 10 === 0 || page === pages) log(`   catálogo ${page}/${pages}`);
    }
  }
  return collectBlock({ productCards, catalogCards });
};

// Estado de la base para un bloque
const loadState = async (db, block, cards) => {
  const dbBlock = await db.tcgBlock.findFirst({ where: { categoryId: MYL_CATEGORY, name: block.name } });
  if (!dbBlock) return null;
  const ids = [...cards.keys()];
  const existing = [];
  for (let i = 0; i < ids.length; i += 5000) {
    existing.push(...await db.tcgProduct.findMany({ where: { productId: { in: ids.slice(i, i + 5000) } }, select: { productId: true, name: true, imageUrl: true, extData: true, group: { select: { blockId: true } } } }));
  }
  const [groups, physical, blockCards] = await Promise.all([
    db.tcgGroup.findMany({ where: { blockId: dbBlock.id }, select: { groupId: true, name: true } }),
    db.tcgPhysicalProduct.findMany({ where: { categoryId: MYL_CATEGORY, blockId: dbBlock.id }, select: { id: true, name: true } }),
    db.tcgProduct.findMany({ where: { group: { blockId: dbBlock.id } }, select: { productId: true, imageUrl: true } }),
  ]);
  return { dbBlock, existing, groups, physical, blockCards };
};

export async function runMylSync(options = {}) {
  const {
    dryRun = false, blocks = MYL_BLOCKS, only = null, limitProducts = 0, imageCap = 3000, maxMinutes = 50, checkImages = 0,
    client = new MazosClient(), upload = defaultUpload, fetchImage = fetchCardImage, db = prisma, log = console.log,
  } = options;
  if (!dryRun && upload === defaultUpload && !hasR2Config()) throw new Error('Falta la configuración de R2');
  const run = await acquireRun(db, dryRun);
  if (!run) { log('Hay otra sincronización de Mitos y Leyendas en curso: no se hace nada.'); return { status: 'skipped' }; }
  const started = Date.now();
  const deadline = started + maxMinutes * 60 * 1000;
  const budget = { images: 0 };
  const outOfBudget = () => {
    if (budget.images >= imageCap) return 'tope de imágenes';
    if (Date.now() > deadline) return 'tiempo máximo';
    return '';
  };
  const total = { newCards: 0, noEdition: 0, newEditions: 0, newProducts: 0, filledData: 0, filled: 0, imagesUploaded: 0, imagesFilled: 0, imagesFailed: 0, corrections: 0, stopped: '', lists: { cards: [], products: [], editions: [], filled: [] } };
  const perBlock = {};
  let status = 'ok';
  try {
    for (const block of blocks.filter((item) => !only || only.includes(item.key))) {
      log(`\n== ${block.name}`);
      try {
        const cards = await readBlock(client, block, { limitProducts, log });
        const state = await loadState(db, block, cards);
        if (!state) { log(`${block.name}: no existe en la base, se omite`); continue; }
        const report = planBlock({ ...block, id: state.dbBlock.id }, cards, {
          existingById: new Map(state.existing.map((card) => [card.productId, { ...card, blockId: card.group?.blockId }])),
          groupNames: new Set(state.groups.map((group) => cleanName(group.name))),
          productNames: new Set(state.physical.map((product) => product.name)),
          blockCardIds: new Set(state.blockCards.map((card) => card.productId)),
        });
        total.corrections += report.correcciones.length;
        total.noEdition += report.nuevasSinEdicion.length;
        perBlock[block.name] = { cartasEnMazos: report.cartasEnMazos, nuevas: report.nuevas.length, sinEdicion: report.nuevasSinEdicion.length, correcciones: report.correcciones.length, porCompletar: report.porCompletar };
        log(`${block.name}: ${report.cartasEnMazos} cartas en mazos.cl · ${report.nuevas.length} nuevas (${report.nuevasSinEdicion.length} sin edición) · ${report.correcciones.length} correcciones · por completar ${JSON.stringify(report.porCompletar)}`);
        if (dryRun) continue;
        await saveFindings(db, block, report);
        await applyBlock({ db, block, cards, state, upload, fetchImage, budget, outOfBudget, total, log });
        total.stopped ||= outOfBudget();
      } catch (error) {
        status = 'partial';
        log(`${block.name}: ${error.message}`);
        perBlock[block.name] = { error: String(error.message).slice(0, 200) };
      }
      if (total.stopped) break;
    }
  } finally {
    const seconds = Math.round((Date.now() - started) / 1000);
    if (total.stopped || total.imagesFailed) status = status === 'failed' ? status : 'partial';
    if (run.id) await db.catalogSyncRun.update({ where: { id: run.id }, data: { status, finishedAt: new Date(), summary: { ...total, blocks: perBlock, seconds } } });
    log(`\nFin (${status}) en ${seconds} s: ${total.newCards} cartas nuevas, ${total.imagesUploaded} imágenes subidas, ${total.imagesFilled} imágenes completadas, ${total.filledData} datos completados, ${total.corrections} correcciones por revisar.${total.stopped ? ` Se detuvo por ${total.stopped}; sigue la próxima noche.` : ''}`);
  }
  return { status, ...total, blocks: perBlock };
}

async function applyBlock({ db, block, cards, state, upload, fetchImage, budget, outOfBudget, total, log }) {
  const { dbBlock, existing, groups, physical, blockCards } = state;
  const existingById = new Map(existing.map((card) => [card.productId, card]));
  const newEntries = [...cards].filter(([id, entry]) => !existingById.has(id) && entry.json.edition?.name);

  // Ediciones y productos que las cartas nuevas necesitan
  const groupIdByName = new Map(groups.map((group) => [cleanName(group.name), group.groupId]));
  let nextGroupId = Math.max(GROUP_ID_BASE, ((await db.tcgGroup.aggregate({ _max: { groupId: true } }))._max.groupId || 0) + 1);
  for (const [, entry] of newEntries) {
    const name = String(entry.json.edition.name).replace(/^[^\p{L}\p{N}]+/u, '').trim(); // sin el emoji que mazos.cl pone delante
    if (!groupIdByName.has(cleanName(name))) {
      const created = await db.tcgGroup.create({ data: { groupId: nextGroupId++, name, blockId: dbBlock.id, categoryId: MYL_CATEGORY, publishedOn: new Date(), modifiedOn: new Date() } });
      groupIdByName.set(cleanName(name), created.groupId);
      total.newEditions += 1;
      listed(total.lists.editions, { name, block: block.name });
    }
  }
  const physicalIdByName = new Map(physical.map((product) => [product.name, product.id]));
  // Los productos físicos se importaron con ids propios: el contador automático puede ir atrasado y chocar. Se pone al día antes de crear
  await db.$executeRaw`SELECT setval(pg_get_serial_sequence('"TcgPhysicalProduct"', 'id'), GREATEST((SELECT COALESCE(MAX("id"), 0) FROM "TcgPhysicalProduct"), 1))`;
  for (const [, entry] of newEntries) {
    for (const name of entry.products) {
      if (physicalIdByName.has(name)) continue;
      const created = await db.tcgPhysicalProduct.create({ data: { name, blockId: dbBlock.id, categoryId: MYL_CATEGORY } });
      physicalIdByName.set(name, created.id);
      total.newProducts += 1;
      listed(total.lists.products, { name, block: block.name });
    }
  }

  // Carpetas de imagen ya usadas por producto (dos cartas con el mismo nombre en un producto llevan «Nombre 2», como en CarpetazoUpdate)
  const used = new Map();
  const remember = (url) => {
    const parts = String(url || '').split('?')[0].split('/').slice(-3).map((part) => { try { return decodeURIComponent(part); } catch (_) { return part; } });
    if (parts.length === 3) { if (!used.has(parts[0])) used.set(parts[0], new Set()); used.get(parts[0]).add(parts[1].toLowerCase()); }
  };
  blockCards.forEach((card) => remember(card.imageUrl));
  const imageKeyFor = (entry) => {
    const productDir = [...entry.products][0];
    const base = safeName(entry.json.name);
    if (!used.has(productDir)) used.set(productDir, new Set());
    const taken = used.get(productDir);
    let folder = base;
    for (let n = 2; taken.has(folder.toLowerCase()); n += 1) folder = `${base} ${n}`;
    taken.add(folder.toLowerCase());
    return `Carpetazo.cl/Mitos_y_Leyendas/${block.folder}_DB/${block.folder}_Images/${productDir}/${folder}/${base}.webp`;
  };
  // Sube la imagen; devuelve su dirección pública, o '' si no hay imagen o falló (la carta se guarda igual y la imagen se completa otra noche)
  const uploadImage = async (entry, counter) => {
    if (!entry.json.imageUrl || outOfBudget()) return '';
    const key = imageKeyFor(entry);
    try {
      await upload(key, await fetchImage(entry.json.imageUrl));
      budget.images += 1;
      total[counter] += 1;
      return r2PublicUrl(key);
    } catch (error) {
      total.imagesFailed += 1;
      log(`  imagen de «${entry.json.name}» (${entry.json.id}): ${error.message}`);
      return '';
    }
  };

  // Cartas nuevas
  for (let i = 0; i < newEntries.length; i += CHUNK) {
    const slice = newEntries.slice(i, i + CHUNK);
    const rows = [];
    await pool(slice, 4, async ([id, entry]) => {
      const name = String(entry.json.name).trim();
      const editionName = String(entry.json.edition.name).replace(/^[^\p{L}\p{N}]+/u, '').trim();
      const imageUrl = await uploadImage(entry, 'imagesUploaded');
      rows.push({ productId: id, name, cleanName: cleanName(name), imageUrl, extData: cardExtData(entry.json), groupId: groupIdByName.get(cleanName(editionName)), categoryId: MYL_CATEGORY, physicalProductId: physicalIdByName.get([...entry.products][0]), _products: [...entry.products], _edition: editionName });
    });
    await db.$transaction(async (tx) => {
      await tx.tcgProduct.createMany({ data: rows.map(({ _products, _edition, ...row }) => row), skipDuplicates: true });
      await tx.tcgProductPhysicalProduct.createMany({ data: rows.flatMap((row) => row._products.map((name) => ({ productId: row.productId, physicalProductId: physicalIdByName.get(name) }))), skipDuplicates: true });
    });
    total.newCards += rows.length;
    for (const row of rows) listed(total.lists.cards, { id: row.productId, name: row.name, block: block.name, edition: row._edition, product: row._products[0], imageUrl: row.imageUrl || null });
    // Una carta que antes no tenía edición y ya entró deja de estar pendiente
    await db.mylSyncFinding.deleteMany({ where: { kind: 'noEdition', productId: { in: rows.map((row) => row.productId) } } });
  }

  // Cartas que ya estaban: completar datos en blanco y, si les falta, la imagen
  let fills = 0;
  const toFill = [];
  for (const [id, entry] of cards) {
    const current = existingById.get(id);
    if (!current || (current.group?.blockId ?? dbBlock.id) !== dbBlock.id) continue;
    const { missing } = cardChanges(current, entry.json, { withMechanics: entry.fromProduct });
    const dataKeys = missing.filter((key) => key !== 'name');
    const needsImage = !current.imageUrl && entry.json.imageUrl;
    if (dataKeys.length || needsImage) toFill.push({ current, entry, dataKeys, needsImage });
  }
  for (const { current, entry, dataKeys, needsImage } of toFill) {
    if (fills >= MAX_FILLS_PER_RUN) break;
    const data = {};
    if (dataKeys.length) {
      const added = cardExtData(entry.json).filter((item) => dataKeys.includes(item.name));
      data.extData = [...(Array.isArray(current.extData) ? current.extData : []), ...added];
      total.filledData += 1;
    }
    if (needsImage) {
      const imageUrl = await uploadImage(entry, 'imagesFilled');
      if (imageUrl) data.imageUrl = imageUrl;
    }
    if (Object.keys(data).length) {
      await db.tcgProduct.update({ where: { productId: current.productId }, data });
      fills += 1;
      total.filled += 1;
      listed(total.lists.filled, { id: current.productId, name: current.name, block: block.name, imageUrl: data.imageUrl || current.imageUrl || null, what: [data.imageUrl ? 'imagen' : '', dataKeys.length ? 'datos' : ''].filter(Boolean).join(' y ') });
    }
  }
}
