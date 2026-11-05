// Cartas de Mitos y Leyendas que se suben a mano desde Moderación (las que mazos.cl aún no trae).
// Van a las mismas tablas y rutas de R2 que las del barrido de las 2 am, pero con id propio («manual-…»): el barrido nunca las toca
// porque solo compara por los ids de mazos.cl, y tampoco las borra. Solo se pueden editar las que se crearon aquí.
import crypto from 'node:crypto';
import { CopyObjectCommand } from '@aws-sdk/client-s3';
import { staffLevelOf } from './auth.js';
import { getR2KeyFromPublicUrl, hasR2Config, r2Client, userR2Prefix } from './r2.js';
import { r2PublicUrl } from './tcgCatalogImport.js';
import { MYL_BLOCKS, MYL_CATEGORY, cleanName, safeName } from './mylSync/plan.js';
import { isShortText } from './validation.js';

export const MANUAL_PREFIX = 'manual-';
export const isManualId = (id) => typeof id === 'string' && /^manual-[a-z0-9]{8,24}$/.test(id);
// Además de los administradores, estas cuentas pueden entrar a esta sección (solo para agregar y editar; nadie borra desde aquí)
export const mylEditors = () => String(process.env.MYL_CARD_EDITORS ?? 'rigoberto_godoy_espi,ignacio_andres_peris').split(',').map((name) => name.trim().toLowerCase()).filter(Boolean);
export const TYPES = ['ALIADO', 'TALISMAN', 'ORO', 'TOTEM', 'ARMA', 'MONUMENTO'];
export const FREQUENCIES = ['VASALLO', 'CORTESANO', 'REAL', 'MEGA_REAL', 'ULTRA_REAL', 'LEGENDARIA', 'SECRETA', 'ORO', 'PROMOCIONAL', 'REWORK', 'TOKEN'];
const CACHE_CONTROL = 'public, max-age=31536000, immutable';
const OWN_CARD_PHOTO = /\/card\/[0-9a-f]{32}\.webp$/;
const fail = (status, message, extra = {}) => Object.assign(new Error(message), { status, ...extra });

export const requireMylEditor = (prisma) => async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub } });
    const level = staffLevelOf(req.user, user);
    if (!user || (level < 3 && !mylEditors().includes(String(user.username || '').toLowerCase()))) return res.status(403).json({ success: false, message: 'Acceso restringido' });
    req.dbUser = user;
    return next();
  } catch (error) {
    console.error('Error comprobando el acceso a las cartas de Mitos y Leyendas:', error);
    return res.status(500).json({ success: false, message: 'Error interno' });
  }
};

const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// El efecto se escribe como texto: cada línea es un párrafo
export const effectHtml = (text) => text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => `<p>${escapeHtml(line)}</p>`).join('');
export const plainEffect = (html) => String(html ?? '').replace(/<\s*\/p\s*>\s*<\s*p[^>]*>/gi, '\n').replace(/<\s*br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&').trim();
const slugOf = (name) => cleanName(name).replace(/ /g, '-') || 'carta';
const edition = (name) => String(name).replace(/^[^\p{L}\p{N}]+/u, '').trim();
const get = (extData, name) => (Array.isArray(extData) ? extData.filter((entry) => entry.name === name).map((entry) => entry.value) : []);

const list = (value, max, size) => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > max) return null;
  const items = [...new Set(value.map((item) => String(item ?? '').trim()).filter(Boolean))];
  return items.every((item) => isShortText(item, size)) ? items : null;
};
const optionalInt = (value) => (value === undefined || value === null || value === '' ? '' : /^\d{1,3}$/.test(String(value)) ? String(Number(value)) : null);

// Valida lo que llega del navegador. Devuelve { input } o { error }
export const readCardInput = (body) => {
  const b = body && typeof body === 'object' ? body : {};
  const input = {};
  if (!isShortText(b.name, 120)) return { error: 'Escribe el nombre de la carta (hasta 120 letras).' };
  input.name = b.name.trim();
  if (!Number.isInteger(b.blockId)) return { error: 'Elige el bloque.' };
  input.blockId = b.blockId;
  if (Number.isInteger(b.groupId)) input.groupId = b.groupId;
  else if (isShortText(b.newEdition, 80) && edition(b.newEdition)) input.newEdition = edition(b.newEdition);
  else return { error: 'Elige la edición o escribe el nombre de una nueva.' };
  if (Number.isInteger(b.physicalProductId)) input.physicalProductId = b.physicalProductId;
  else if (isShortText(b.newProduct, 100)) input.newProduct = b.newProduct.trim();
  if (!TYPES.includes(String(b.type || '').toUpperCase())) return { error: 'Elige el tipo de la carta.' };
  input.type = String(b.type).toUpperCase();
  input.cost = optionalInt(b.cost);
  input.force = optionalInt(b.force);
  if (input.cost === null || input.force === null) return { error: 'El coste y la fuerza son números de 0 a 999.' };
  const races = list(b.races, 6, 40);
  if (!races) return { error: 'Las razas son hasta 6, de máximo 40 letras cada una.' };
  input.races = races.map((race) => race.toUpperCase());
  if (!FREQUENCIES.includes(String(b.frequency || '').toUpperCase())) return { error: 'Elige la frecuencia (rareza).' };
  input.frequency = String(b.frequency).toUpperCase();
  if (b.number !== undefined && b.number !== null && b.number !== '' && !isShortText(b.number, 60)) return { error: 'El número de colección es muy largo.' };
  input.number = String(b.number ?? '').trim();
  const mechanics = list(b.mechanics, 12, 60);
  if (!mechanics) return { error: 'Las habilidades son hasta 12, de máximo 60 letras cada una.' };
  input.mechanics = mechanics;
  if (b.effect !== undefined && b.effect !== null && (typeof b.effect !== 'string' || b.effect.length > 4000)) return { error: 'El efecto es muy largo (máximo 4000 letras).' };
  input.effect = String(b.effect ?? '').trim();
  if (b.imageUrl !== undefined && b.imageUrl !== null && b.imageUrl !== '' && typeof b.imageUrl !== 'string') return { error: 'Imagen inválida.' };
  input.imageUrl = String(b.imageUrl || '');
  input.allowDuplicate = b.allowDuplicate === true;
  return { input };
};

// Mismos atributos y mismo orden que las cartas que trae el barrido
export const buildExtData = (input, editionName, blockName) => [
  ['Type', input.type], ['Cost', input.cost], ['Fuerza', input.force], ...input.races.map((race) => ['Race', race]),
  ['Edition', editionName], ['Frequency', input.frequency], ['Number', input.number], ['Format', blockName], ['Slug', slugOf(input.name)],
  ['Effect', input.effect ? effectHtml(input.effect) : ''], ...input.mechanics.map((mechanic) => ['Mechanics', mechanic]),
].map(([name, value]) => ({ name, value: String(value ?? '') })).filter((entry) => entry.value !== '');

// La carta como la edita la pantalla
export const toEditable = (product) => ({
  productId: product.productId, source: isManualId(product.productId) ? 'carpetazo' : 'mazos', name: product.name, imageUrl: product.imageUrl || '', blockId: product.group?.blockId ?? null, groupId: product.groupId, edition: product.group?.name || '',
  physicalProductId: product.physicalProductId ?? null, type: get(product.extData, 'Type')[0] || '', cost: get(product.extData, 'Cost')[0] || '', force: get(product.extData, 'Fuerza')[0] || '',
  races: get(product.extData, 'Race'), frequency: get(product.extData, 'Frequency')[0] || '', number: get(product.extData, 'Number')[0] || '', mechanics: get(product.extData, 'Mechanics'),
  effect: plainEffect(get(product.extData, 'Effect')[0]),
});

export const newManualId = () => `${MANUAL_PREFIX}${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;

// El barrido de las 2 am crea ediciones y cartas con sus propios contadores: mientras corre no se escribe aquí
const assertNoSync = async (db) => {
  const running = await db.catalogSyncRun.findFirst({ where: { source: 'myl', status: 'running', startedAt: { gte: new Date(Date.now() - 3 * 3600 * 1000) } }, select: { id: true } });
  if (running) throw fail(409, 'El barrido automático de Mitos y Leyendas está corriendo. Intenta de nuevo en unos minutos.', { code: 'sync_running' });
};

// Una carta es la misma si tiene el mismo nombre en la misma edición o el mismo número de colección dentro del bloque
const duplicatesOf = async (db, { cleanedName, blockId, groupId, number, exceptId }) => {
  const byNumber = number ? (await db.$queryRaw`SELECT p."productId" FROM "TcgProduct" p JOIN "TcgGroup" g ON g."groupId" = p."groupId", jsonb_array_elements(p."extData"::jsonb) e WHERE p."categoryId" = ${MYL_CATEGORY} AND g."blockId" = ${blockId} AND e->>'name' = 'Number' AND e->>'value' = ${number} LIMIT 20`).map((row) => row.productId) : [];
  const found = await db.tcgProduct.findMany({
    where: { categoryId: MYL_CATEGORY, ...(exceptId ? { productId: { not: exceptId } } : {}), OR: [{ cleanName: cleanedName, ...(groupId ? { groupId } : { groupId: -1 }) }, { productId: { in: byNumber } }] },
    select: { productId: true, name: true, extData: true, group: { select: { name: true } } }, take: 20,
  });
  return found.map((card) => ({ productId: card.productId, name: card.name, edition: card.group?.name || '', number: get(card.extData, 'Number')[0] || '' }));
};

// Carpeta de la imagen: igual que el barrido («Nombre», «Nombre 2»… dentro de la carpeta del producto)
const imageKeyFor = async (db, blockFolder, productDir, name, { fresh = false } = {}) => {
  const base = safeName(name);
  const root = `Carpetazo.cl/Mitos_y_Leyendas/${blockFolder}_DB/${blockFolder}_Images/${productDir}/`;
  const urls = await db.tcgProduct.findMany({ where: { imageUrl: { startsWith: r2PublicUrl(root) } }, select: { imageUrl: true } });
  const taken = new Set(urls.map(({ imageUrl }) => { try { return decodeURIComponent(imageUrl.split('?')[0].split('/').slice(-2)[0]).toLowerCase(); } catch (_) { return ''; } }));
  let folder = base;
  for (let n = 2; taken.has(folder.toLowerCase()); n += 1) folder = `${base} ${n}`;
  // Las imágenes se sirven con caché de un año: una imagen nueva necesita una dirección nueva
  return `${root}${folder}/${base}${fresh ? `-${crypto.randomBytes(3).toString('hex')}` : ''}.webp`;
};

// La foto que la persona subió con el cargador de imágenes (solo la suya) pasa a la ruta del catálogo
const copyUploadedImage = async (firebaseUid, imageUrl, key) => {
  if (!hasR2Config()) throw fail(503, 'El servidor no tiene configurado R2 para guardar imágenes.');
  const sourceKey = getR2KeyFromPublicUrl(imageUrl);
  if (!sourceKey || sourceKey.includes('..') || !sourceKey.startsWith(userR2Prefix(firebaseUid)) || !OWN_CARD_PHOTO.test(sourceKey)) throw fail(400, 'Sube la imagen de nuevo.');
  const bucket = process.env.R2_BUCKET_NAME;
  const encodePath = (path) => path.split('/').map(encodeURIComponent).join('/');
  await r2Client.send(new CopyObjectCommand({ Bucket: bucket, Key: key, CopySource: `${bucket}/${encodePath(sourceKey)}`, CacheControl: CACHE_CONTROL, ContentType: 'image/webp', MetadataDirective: 'REPLACE' }));
  return r2PublicUrl(key);
};

// Resuelve (y crea si hace falta) la edición y el producto físico de la carta dentro de una transacción
const resolveGroups = async (tx, input, block) => {
  let group;
  if (input.groupId) {
    group = await tx.tcgGroup.findFirst({ where: { groupId: input.groupId, categoryId: MYL_CATEGORY, blockId: block.id } });
    if (!group) throw fail(400, 'Esa edición no es de ese bloque.');
  } else {
    const same = (await tx.tcgGroup.findMany({ where: { categoryId: MYL_CATEGORY, blockId: block.id }, select: { groupId: true, name: true } })).find((item) => cleanName(item.name) === cleanName(input.newEdition));
    if (same) group = same;
    else {
      const next = Math.max(900000, ((await tx.tcgGroup.aggregate({ _max: { groupId: true } }))._max.groupId || 0) + 1);
      group = await tx.tcgGroup.create({ data: { groupId: next, name: input.newEdition, blockId: block.id, categoryId: MYL_CATEGORY, publishedOn: new Date(), modifiedOn: new Date() } });
    }
  }
  let physical = null;
  if (input.physicalProductId) {
    physical = await tx.tcgPhysicalProduct.findFirst({ where: { id: input.physicalProductId, categoryId: MYL_CATEGORY, blockId: block.id } });
    if (!physical) throw fail(400, 'Ese producto no es de ese bloque.');
  } else if (input.newProduct) {
    physical = await tx.tcgPhysicalProduct.findFirst({ where: { categoryId: MYL_CATEGORY, blockId: block.id, name: input.newProduct } });
    if (!physical) {
      await tx.$executeRaw`SELECT setval(pg_get_serial_sequence('"TcgPhysicalProduct"', 'id'), GREATEST((SELECT COALESCE(MAX("id"), 0) FROM "TcgPhysicalProduct"), 1))`;
      physical = await tx.tcgPhysicalProduct.create({ data: { name: input.newProduct, blockId: block.id, categoryId: MYL_CATEGORY } });
    }
  }
  return { group, physical };
};

const loadBlock = async (db, blockId) => {
  const block = await db.tcgBlock.findFirst({ where: { id: blockId, categoryId: MYL_CATEGORY } });
  const known = block && MYL_BLOCKS.find((item) => item.name === block.name);
  if (!known) throw fail(400, 'Ese bloque no existe.');
  return { ...block, folder: known.folder };
};

const save = async (db, actor, input, { existing } = {}) => {
  await assertNoSync(db);
  const block = await loadBlock(db, input.blockId);
  const cleaned = cleanName(input.name);
  if (!cleaned) throw fail(400, 'El nombre de la carta no es válido.');
  const groupId = input.groupId || (await db.tcgGroup.findMany({ where: { categoryId: MYL_CATEGORY, blockId: block.id }, select: { groupId: true, name: true } })).find((item) => cleanName(item.name) === cleanName(input.newEdition))?.groupId;
  if (!input.allowDuplicate) {
    const duplicates = await duplicatesOf(db, { cleanedName: cleaned, blockId: block.id, groupId, number: input.number, exceptId: existing?.productId });
    if (duplicates.length) throw fail(409, 'Ya hay una carta parecida en la base.', { code: 'duplicate', duplicates });
  }
  return db.$transaction(async (tx) => {
    const { group, physical } = await resolveGroups(tx, input, block);
    const productDir = safeName(physical?.name || group.name);
    let imageUrl = existing?.imageUrl || '';
    if (input.imageUrl && input.imageUrl !== imageUrl) imageUrl = await copyUploadedImage(actor.firebaseUid, input.imageUrl, await imageKeyFor(tx, block.folder, productDir, input.name, { fresh: Boolean(existing?.imageUrl) }));
    const data = { name: input.name, cleanName: cleaned, imageUrl, extData: buildExtData(input, group.name, block.name), groupId: group.groupId, categoryId: MYL_CATEGORY, physicalProductId: physical?.id ?? null };
    const productId = existing?.productId || newManualId();
    if (existing) await tx.tcgProduct.update({ where: { productId }, data });
    else await tx.tcgProduct.create({ data: { productId, ...data } });
    await tx.tcgProductPhysicalProduct.deleteMany({ where: { productId } });
    if (physical) await tx.tcgProductPhysicalProduct.create({ data: { productId, physicalProductId: physical.id } });
    await tx.moderationAudit.create({ data: { actorId: actor.id, action: existing ? 'myl.card.update' : 'myl.card.create', targetType: 'catalog', targetId: productId, note: `${existing ? 'Carta editada' : 'Carta nueva'}: ${input.name} (${group.name})`, meta: { block: block.name } } });
    return toEditable(await tx.tcgProduct.findUnique({ where: { productId }, include: { group: { select: { name: true, blockId: true } } } }));
  }, { timeout: 30000, maxWait: 10000 });
};

export const createManualCard = (db, actor, input) => save(db, actor, input);
export const updateManualCard = async (db, actor, productId, input) => {
  const existing = isManualId(productId) ? await db.tcgProduct.findUnique({ where: { productId }, select: { productId: true, imageUrl: true } }) : null;
  if (!existing) throw fail(404, 'Esa carta no se creó desde aquí, así que no se puede editar.');
  return save(db, actor, input, { existing });
};
