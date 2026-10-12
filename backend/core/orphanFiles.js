// Limpieza de archivos subidos que nunca se usaron: una foto o nota de voz del chat que al final no se envió, o la foto
// de una carta que se descartó. Sin esto se acumulan para siempre y alguien podría llenar el almacenamiento de a poco.
// Es conservadora a propósito: solo mira las carpetas message/, voice/ y card/ de cada usuario (nunca fotos de perfil),
// solo archivos con más de 7 días, y solo borra los que ningún perfil, carta, mensaje, lista de deseos ni reporte
// (que guarda copias como prueba) menciona. Corre una vez al día y borra como mucho 500 archivos por vuelta.
import { DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { prisma } from './db.js';
import { hasR2Config, r2Client } from './r2.js';

const USERS_PREFIX = 'Carpetazo.cl/Usuarios/';
const CLEANABLE = /^Carpetazo\.cl\/Usuarios\/[A-Za-z0-9_-]+\/(message|voice|card)\/([0-9a-f]{32})\.(webp|webm|ogg|m4a|mp3)$/;
const MIN_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_DELETES_PER_RUN = 500;
const CHECK_BATCH = 100;
const RUN_EVERY_MS = 24 * 60 * 60 * 1000;

// Nombres (32 caracteres hexadecimales) que aparecen en algún lugar de la base
const referencedNames = async (names) => {
  if (!names.length) return new Set();
  const rows = await prisma.$queryRaw`
    SELECT n FROM unnest(${names}::text[]) AS n
    WHERE EXISTS (SELECT 1 FROM "Message" m WHERE m."content" LIKE '%' || n || '%')
       OR EXISTS (SELECT 1 FROM "Card" c WHERE c."imageUrl" LIKE '%' || n || '%')
       OR EXISTS (SELECT 1 FROM "WishlistItem" w WHERE w."imageUrl" LIKE '%' || n || '%')
       OR EXISTS (SELECT 1 FROM "Report" r WHERE r."snapshot"::text LIKE '%' || n || '%')
       OR EXISTS (SELECT 1 FROM "User" u WHERE u."photoURL" LIKE '%' || n || '%' OR u."bannerBase64" LIKE '%' || n || '%' OR u."wallpaperBase64" LIKE '%' || n || '%')`;
  return new Set(rows.map((row) => row.n));
};

// De una lista de archivos ({ key, lastModified }), los que se pueden borrar sin romper nada
export const findOrphanFiles = async (objects, now = Date.now()) => {
  const candidates = objects
    .map((object) => ({ key: object.key, name: CLEANABLE.exec(object.key || '')?.[2], age: now - new Date(object.lastModified).getTime() }))
    .filter((object) => object.name && Number.isFinite(object.age) && object.age >= MIN_AGE_MS);
  const orphans = [];
  for (let at = 0; at < candidates.length && orphans.length < MAX_DELETES_PER_RUN; at += CHECK_BATCH) {
    const batch = candidates.slice(at, at + CHECK_BATCH);
    const used = await referencedNames(batch.map((object) => object.name));
    for (const object of batch) if (!used.has(object.name) && orphans.length < MAX_DELETES_PER_RUN) orphans.push(object.key);
  }
  return orphans;
};

const listUserFiles = async () => {
  const objects = [];
  let token;
  do {
    const page = await r2Client.send(new ListObjectsV2Command({ Bucket: process.env.R2_BUCKET_NAME, Prefix: USERS_PREFIX, ContinuationToken: token }));
    for (const item of page?.Contents || []) objects.push({ key: item.Key, lastModified: item.LastModified });
    token = page?.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return objects;
};

export const cleanupOrphanFiles = async () => {
  if (!hasR2Config() || !process.env.R2_BUCKET_NAME) return { deleted: 0 };
  const orphans = await findOrphanFiles(await listUserFiles());
  let deleted = 0;
  for (const key of orphans) {
    try {
      await r2Client.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }));
      deleted += 1;
    } catch (error) {
      console.warn('No se pudo borrar un archivo sin uso:', error?.message || error);
    }
  }
  if (deleted) {
    console.log(`Limpieza de archivos sin uso: ${deleted} borrados`);
    await prisma.moderationAudit.create({ data: { actorId: null, action: 'files.orphans_deleted', targetType: 'system', targetId: null, note: `Se borraron ${deleted} archivos subidos que nunca se usaron (más de 7 días sin aparecer en mensajes, cartas, perfiles, listas de deseos ni reportes)` } }).catch(() => {});
  }
  return { deleted };
};

export const startOrphanCleanup = () => {
  if (process.env.TEST_AUTH_STUB) return;
  const run = () => cleanupOrphanFiles().catch((error) => console.error('Error en la limpieza de archivos sin uso:', error?.message || error));
  setTimeout(run, 10 * 60 * 1000).unref?.(); // primera vuelta 10 minutos después de arrancar
  setInterval(run, RUN_EVERY_MS).unref?.();
};
