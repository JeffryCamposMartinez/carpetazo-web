// Datos de prueba propios: usuarios "cztest-*" creados por la API y borrados al terminar.
// No depende de los usuarios ni carpetas de ninguna base: sirve en local y en la CI.
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const B = process.env.CZ_API_BASE || 'http://localhost:8000/api'; // CZ_TEST_PORT cambia el puerto si el 8000 está ocupado
const UID_PREFIX = 'cztest-';
const PEOPLE = ['seller', 'jerry', 'ignacio', 'ale', 'jeffry', 'nobuyer', 'admin'];
const U = Object.fromEntries([...PEOPLE, 'temp', 'ghost', 'newbie', 'oldie', 'leaver', 'mailnew', 'modrev', 'buy1', 'buy2', 'buy3', 'relink', 'dupname', 'syncb', 'syncc', 'syncd'].map((name) => [name, UID_PREFIX + name]));
const NAMES = Object.fromEntries(PEOPLE.map((name) => [name, 'cztest_' + name]));
// Correo que la simulación de Firebase da al administrador de prueba (ver tests/auth-stub.mjs y tests/run.cjs)
const ADMIN_EMAIL = U.admin + '@test.local';

const call = async (method, path, who, body, ip) => {
  const r = await fetch(B + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(ip ? { 'X-Forwarded-For': ip } : {}), ...(who ? { Authorization: 'Bearer test-' + U[who] } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  let j = null;
  try { j = await r.json(); } catch (_) { /* respuesta sin JSON */ }
  return { status: r.status, j };
};

// Acepta los textos vigentes (sin esto el servidor rechaza cualquier escritura de la cuenta)
const acceptTerms = async (who, extra = {}) => {
  const versions = (await call('GET', '/legal/versions')).j;
  const r = await call('POST', '/users/me/accept-terms', who, { adult: true, termsVersion: versions.termsVersion, privacyVersion: versions.privacyVersion, ...extra });
  if (r.status !== 200) throw new Error('No se pudo aceptar los términos de ' + who + ': ' + r.status);
  return r;
};

const ok = (name, condition, extra = '') => {
  console.log((condition ? 'OK   ' : 'FALLA') + ' ' + name + ' ' + extra);
  if (!condition) process.exitCode = 1;
};

// Borra todo lo de los usuarios de prueba (carpetas, cartas, reseñas y lista de deseos caen en cascada)
const cleanup = async () => {
  const users = await prisma.user.findMany({ where: { firebaseUid: { startsWith: UID_PREFIX } }, select: { id: true } });
  const ids = users.map((user) => user.id);
  if (ids.length === 0) return;
  const reportIds = (await prisma.report.findMany({ where: { OR: [{ reporterId: { in: ids } }, { targetOwnerId: { in: ids } }] }, select: { id: true } })).map((row) => row.id);
  const caseIds = (await prisma.fraudCase.findMany({ where: { subjectUserId: { in: ids } }, select: { id: true } })).map((row) => row.id);
  await prisma.moderationAudit.deleteMany({ where: { OR: [{ reportId: { in: reportIds } }, { actorId: { in: ids } }, { targetId: { in: [...ids, ...caseIds] } }] } });
  await prisma.fraudCase.deleteMany({ where: { id: { in: caseIds } } });
  await prisma.userBlock.deleteMany({ where: { OR: [{ blockerId: { in: ids } }, { blockedId: { in: ids } }] } });
  await prisma.report.deleteMany({ where: { id: { in: reportIds } } });
  await prisma.$transaction([
    prisma.message.deleteMany({ where: { OR: [{ senderId: { in: ids } }, { receiverId: { in: ids } }] } }),
    prisma.order.deleteMany({ where: { OR: [{ sellerId: { in: ids } }, { buyerId: { in: ids } }] } }),
    prisma.user.deleteMany({ where: { id: { in: ids } } })
  ]);
};

// Crea los usuarios y una carpeta pública del vendedor con cartas; devuelve lo que necesitan las pruebas
const setup = async () => {
  await cleanup();
  for (const name of PEOPLE) {
    const r = await call('POST', '/users/sync', name, { displayName: 'Prueba ' + name, username: NAMES[name] });
    if (r.status !== 200 || r.j?.user?.username !== NAMES[name]) throw new Error('No se pudo crear el usuario de prueba ' + name + ': ' + r.status);
    await acceptTerms(name);
  }
  const folder = await call('POST', '/folders', 'seller', { name: 'TEST fixtures', tcg: 'Pokemon', color: 'blue', isPublic: true });
  const folderId = folder.j?.folder?.id;
  if (!folderId) throw new Error('No se pudo crear la carpeta de prueba: ' + folder.status);
  const card = await call('POST', '/folders/' + folderId + '/cards', 'seller', { tcgId: 'tst-fixture', name: 'carta fixture', price: 1000, stock: 20, data: { catalogOrder: 0 } });
  if (!card.j?.card?.id) throw new Error('No se pudo crear la carta de prueba: ' + card.status);
  return { folderId, cardId: card.j.card.id, sellerUsername: NAMES.seller };
};

const fixtures = () => JSON.parse(process.env.CZ_FIXTURES || '{}');

module.exports = { prisma, B, U, NAMES, ADMIN_EMAIL, call, ok, acceptTerms, cleanup, setup, fixtures };
