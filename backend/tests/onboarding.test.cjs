// Primeros pasos del vendedor: el avance sale de lo guardado y el recordatorio único llega solo a quien se registró ayer y aún no publica.
// Los correos de esta prueba nunca salen: quedan en memoria (sin credenciales reales ni claves de notificaciones)
Object.assign(process.env, { MAIL_TEST_OUTBOX: '1', SMTP_USER: '', SMTP_PASS: '', VAPID_PUBLIC_KEY: '', VAPID_PRIVATE_KEY: '' });
const { prisma, B, U, call, ok, acceptTerms } = require('./fixtures.cjs');

const HOUR = 60 * 60 * 1000;
const make = async (name) => {
  const r = await call('POST', '/users/sync', name, { displayName: 'Prueba ' + name, username: 'cztest_' + name });
  if (r.status !== 200) throw new Error('no se pudo crear ' + name);
  await acceptTerms(name);
  return prisma.user.findUnique({ where: { firebaseUid: U[name] }, select: { id: true } });
};

(async () => {
  try {
    // ---- Avance
    const anon = await fetch(B + '/onboarding');
    ok('sin sesión → 401', anon.status === 401, String(anon.status));
    const one = await make('ob1');
    let r = await call('GET', '/onboarding', 'ob1');
    const keys = (state) => state.steps.map((step) => `${step.key}:${step.done ? 1 : 0}`).join(' ');
    ok('cuenta nueva: ningún paso hecho', r.status === 200 && keys(r.j) === 'profile:0 folder:0 cards:0 share:0' && r.j.complete === false && r.j.done === 0 && r.j.folderId === null, JSON.stringify(r.j));
    ok('la guía dice qué le falta al perfil', JSON.stringify(r.j.steps[0].missing) === '["foto","comuna"]');

    const folder = (await call('POST', '/folders', 'ob1', { name: 'TEST guia', tcg: 'Pokemon', color: 'blue', isPublic: true })).j.folder;
    r = await call('GET', '/onboarding', 'ob1');
    ok('crear la carpeta marca el paso y entrega dónde agregar cartas', keys(r.j) === 'profile:0 folder:1 cards:0 share:0' && r.j.folderId === folder.id && r.j.shareFolderId === folder.id, JSON.stringify(r.j));
    for (let i = 0; i < 4; i += 1) await prisma.card.create({ data: { tcgId: 'tst-ob-' + i, name: 'Carta guía ' + i, price: 1000, stock: 1, folderId: folder.id } });
    await prisma.card.create({ data: { tcgId: 'tst-ob-sin', name: 'Sin stock', price: 1000, stock: 0, folderId: folder.id } });
    r = await call('GET', '/onboarding', 'ob1');
    ok('4 cartas con stock y una agotada: aún faltan', r.j.steps[2].done === false && r.j.steps[2].count === 4 && r.j.steps[2].goal === 5, JSON.stringify(r.j.steps[2]));
    await prisma.card.create({ data: { tcgId: 'tst-ob-5', name: 'Carta guía 5', price: 1000, stock: 2, folderId: folder.id } });
    r = await call('GET', '/onboarding', 'ob1');
    ok('con 5 cartas con stock el paso queda hecho', r.j.steps[2].done === true && r.j.steps[2].count === 5);

    await prisma.user.update({ where: { id: one.id }, data: { photoURL: 'https://lh3.googleusercontent.com/a/ob', publicComuna: 'Santiago' } });
    r = await call('GET', '/onboarding', 'ob1');
    ok('foto y comuna completan el perfil', r.j.steps[0].done === true && r.j.steps[0].missing.length === 0);
    ok('el paso de compartir no se marca solo', r.j.steps[3].done === false && r.j.complete === false);
    r = await call('POST', '/onboarding/shared', 'ob1');
    ok('marcar que compartió → 200', r.status === 200);
    await call('POST', '/onboarding/shared', 'ob1');
    r = await call('GET', '/onboarding', 'ob1');
    ok('todos los pasos hechos → completa (y repetir no rompe nada)', r.j.complete === true && r.j.done === 4 && r.j.total === 4);
    r = await call('GET', '/onboarding', 'seller');
    ok('cada persona ve solo su propio avance', r.status === 200 && r.j.folderId !== folder.id);
    ok('la guía no devuelve datos personales', !/email|phone|rut|firebaseUid/i.test(JSON.stringify(r.j)));

    // ---- Recordatorio único
    const { runOnboardingNudges, buildNudge } = await import('../core/onboarding.js');
    const fresh = await make('ob2'); // se registró hace 30 h y no tiene cartas
    const old = await make('ob3'); // se registró hace 5 días
    const active = await make('ob4'); // hace 30 h pero ya publicó
    await prisma.user.update({ where: { id: fresh.id }, data: { createdAt: new Date(Date.now() - 30 * HOUR) } });
    await prisma.user.update({ where: { id: old.id }, data: { createdAt: new Date(Date.now() - 5 * 24 * HOUR) } });
    await prisma.user.update({ where: { id: active.id }, data: { createdAt: new Date(Date.now() - 30 * HOUR) } });
    const activeFolder = (await call('POST', '/folders', 'ob4', { name: 'TEST guia activa', tcg: 'Pokemon', color: 'blue', isPublic: true })).j.folder;
    await prisma.card.create({ data: { tcgId: 'tst-ob-act', name: 'Carta activa', price: 1000, stock: 1, folderId: activeFolder.id } });

    const sentTo = [];
    const send = async (userId, message) => { sentTo.push({ userId, message }); return { sent: true }; };
    const ours = [fresh.id, old.id, active.id];
    await runOnboardingNudges({ send });
    const mine = sentTo.filter((entry) => ours.includes(entry.userId));
    ok('solo recibe el recordatorio quien se registró ayer y no ha publicado', mine.length === 1 && mine[0].userId === fresh.id, JSON.stringify(mine.map((entry) => entry.userId)));
    ok('queda anotado y no se repite', (await prisma.user.findUnique({ where: { id: fresh.id }, select: { onboardingNudgeAt: true } })).onboardingNudgeAt !== null);
    await runOnboardingNudges({ send });
    ok('una segunda pasada no vuelve a escribirle', sentTo.filter((entry) => entry.userId === fresh.id).length === 1);
    ok('las cuentas antiguas y las que ya publicaron no se marcan', (await prisma.user.findMany({ where: { id: { in: [old.id, active.id] }, onboardingNudgeAt: { not: null } } })).length === 0);

    // Si el correo falla por algo pasajero se reintenta; si nunca se podrá enviar (términos sin aceptar) se deja de intentar
    await prisma.user.update({ where: { id: fresh.id }, data: { onboardingNudgeAt: null } });
    await runOnboardingNudges({ send: async () => ({ sent: false, reason: 'send_failed' }) });
    ok('un fallo pasajero no marca el recordatorio como enviado', (await prisma.user.findUnique({ where: { id: fresh.id }, select: { onboardingNudgeAt: true } })).onboardingNudgeAt === null);
    await runOnboardingNudges({ send: async () => ({ sent: false, reason: 'terms_not_accepted' }) });
    ok('sin términos aceptados se deja de intentar', (await prisma.user.findUnique({ where: { id: fresh.id }, select: { onboardingNudgeAt: true } })).onboardingNudgeAt !== null);

    const nudge = buildNudge('Ana <b>');
    ok('el correo escapa el nombre, tiene 3 pasos y dice que es único', !nudge.html.includes('Ana <b>') && /único recordatorio/.test(nudge.text) && (nudge.text.match(/^\d\. /gm) || []).length === 3);
  } catch (error) {
    ok('la prueba terminó sin excepciones', false, error.stack || error.message);
  } finally {
    await prisma.$disconnect();
  }
})();
