// Fotos de la comunidad para cartas del catálogo sin imagen. Quien sube una foto a una carta del catálogo que no tiene imagen la propone
// sola; Moderación la aprueba (pasa a ser la imagen de esa carta para todos, con la misma ruta de R2 que TcgplayerUpdate) o la rechaza.
import crypto from 'node:crypto';
import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getR2KeyFromPublicUrl, hasR2Config, r2Client, userR2Prefix } from './r2.js';
import { isMylTcg } from './mylIdentity.js';
import { convertImage } from './tcgSync/images.js';
import { itemKeys } from './tcgSync/naming.js';

export const PROPOSALS_PREFIX = 'Carpetazo.cl/Propuestas/';
export const DAILY_PROPOSALS = 20;
const OWN_CARD_PHOTO = /\/card\/[0-9a-f]{32}\.webp$/;
const CACHE_CONTROL = 'public, max-age=31536000, immutable';
const bucket = () => process.env.R2_BUCKET_NAME;
const encodePath = (key) => key.split('/').map(encodeURIComponent).join('/');
const removeObject = (key) => r2Client.send(new DeleteObjectCommand({ Bucket: bucket(), Key: key })).catch((error) => console.warn('No se pudo borrar un objeto de R2:', error?.message || error));
const put = (key, body) => r2Client.send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: 'image/webp', CacheControl: CACHE_CONTROL }));

// Se llama al agregar una carta con foto propia. Nunca falla: la carta se agrega igual si algo de aquí no sale.
export async function proposeCatalogPhoto(db, { userId, firebaseUid, tcg, tcgId, imageUrl }) {
  try {
    if (!imageUrl || !hasR2Config() || isMylTcg(tcg) || !/^[1-9]\d{0,9}$/.test(String(tcgId))) return null;
    const sourceKey = getR2KeyFromPublicUrl(imageUrl);
    // Solo una foto que esta misma persona subió como foto de carta: nunca la de otra persona ni un archivo cualquiera
    if (!sourceKey || sourceKey.includes('..') || !sourceKey.startsWith(userR2Prefix(firebaseUid)) || !OWN_CARD_PHOTO.test(sourceKey)) return null;
    const productId = Number(tcgId);
    const missingImage = await db.catalogCard.findFirst({ where: { productId, kind: 'card', imageKey: null }, select: { productId: true } });
    if (!missingImage) return null;
    const today = await db.catalogImageProposal.count({ where: { userId, createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } } });
    if (today >= DAILY_PROPOSALS) return null;
    const id = crypto.randomUUID();
    const imageKey = `${PROPOSALS_PREFIX}${id}.webp`;
    await r2Client.send(new CopyObjectCommand({ Bucket: bucket(), Key: imageKey, CopySource: `${bucket()}/${encodePath(sourceKey)}`, CacheControl: CACHE_CONTROL, ContentType: 'image/webp', MetadataDirective: 'REPLACE' }));
    // Una propuesta por persona y carta: si ya había una (incluso rechazada), no se repite
    const created = await db.catalogImageProposal.createMany({ data: [{ id, productId, userId, imageKey }], skipDuplicates: true });
    if (created.count === 0) { await removeObject(imageKey); return null; }
    return { id, productId };
  } catch (error) {
    console.warn('No se pudo registrar la propuesta de foto:', error?.message || error);
    return null;
  }
}

const fail = (status, message) => Object.assign(new Error(message), { status });

const readObject = async (key) => {
  const result = await r2Client.send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  return Buffer.from(await result.Body.transformToByteArray());
};

const audit = (tx, actorId, action, proposal, note, extra = {}) => tx.moderationAudit.create({
  data: { actorId, action, targetType: 'catalog', targetId: String(proposal.productId), note, meta: { proposalId: proposal.id, userId: proposal.userId, ...extra } },
});

// Aprueba: la foto pasa a ser la imagen (y la miniatura) de la carta en el catálogo, y las demás propuestas de esa carta se cierran
export async function approveProposal(db, id, actorId) {
  const proposal = await db.catalogImageProposal.findUnique({ where: { id } });
  if (!proposal || proposal.status !== 'pending') throw fail(404, 'La propuesta ya no está pendiente.');
  const card = await db.catalogCard.findUnique({ where: { productId: proposal.productId }, include: { set: { select: { folder: true } }, game: { select: { folder: true } } } });
  if (!card || card.kind !== 'card') throw fail(409, 'La carta ya no existe en el catálogo.');
  if (card.imageKey) throw fail(409, 'La carta ya tiene imagen.');

  const { large, thumb } = await convertImage(await readObject(proposal.imageKey));
  const keys = itemKeys(card.game.folder, 'card', card.set.folder, card.folder);
  const closed = [];
  await db.$transaction(async (tx) => {
    // La fila de la carta se bloquea: dos aprobaciones a la vez no se pisan la imagen
    await tx.$queryRaw`SELECT "productId" FROM "CatalogCard" WHERE "productId" = ${proposal.productId} FOR UPDATE`;
    const fresh = await tx.catalogCard.findUnique({ where: { productId: proposal.productId }, select: { imageKey: true } });
    if (fresh?.imageKey) throw fail(409, 'La carta ya tiene imagen.');
    const stillPending = await tx.catalogImageProposal.updateMany({ where: { id, status: 'pending' }, data: { status: 'approved', decidedById: actorId, decidedAt: new Date() } });
    if (stillPending.count === 0) throw fail(409, 'La propuesta ya fue decidida.');
    await put(keys.imageKey, large);
    await put(keys.thumbKey, thumb);
    await tx.catalogCard.update({ where: { productId: proposal.productId }, data: { imageKey: keys.imageKey, thumbKey: keys.thumbKey } });
    const others = await tx.catalogImageProposal.findMany({ where: { productId: proposal.productId, status: 'pending' }, select: { id: true, imageKey: true } });
    if (others.length) {
      await tx.catalogImageProposal.updateMany({ where: { id: { in: others.map((item) => item.id) } }, data: { status: 'closed', note: 'Otra foto ya se usó para esta carta.', decidedAt: new Date() } });
      closed.push(...others);
    }
    await audit(tx, actorId, 'catalogphoto.approve', proposal, `Foto aprobada para la carta ${card.name} (${proposal.productId})`, { imageKey: keys.imageKey, closed: others.length });
  }, { timeout: 30000, maxWait: 10000 });
  // Las copias de propuestas ya no hacen falta: la imagen del catálogo es una copia propia
  await Promise.all([proposal.imageKey, ...closed.map((item) => item.imageKey)].map(removeObject));
  return { productId: proposal.productId, imageKey: keys.imageKey, closed: closed.length };
}

export async function rejectProposal(db, id, actorId, note) {
  const proposal = await db.catalogImageProposal.findUnique({ where: { id } });
  if (!proposal || proposal.status !== 'pending') throw fail(404, 'La propuesta ya no está pendiente.');
  await db.$transaction(async (tx) => {
    const updated = await tx.catalogImageProposal.updateMany({ where: { id, status: 'pending' }, data: { status: 'rejected', note: note || null, decidedById: actorId, decidedAt: new Date() } });
    if (updated.count === 0) throw fail(409, 'La propuesta ya fue decidida.');
    await audit(tx, actorId, 'catalogphoto.reject', proposal, note ? `Foto rechazada: ${note}` : 'Foto rechazada');
  });
  await removeObject(proposal.imageKey);
  return { productId: proposal.productId };
}
