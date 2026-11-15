// «Tienda verificada»: solo plan Tienda; foto obligatoria; una pendiente a la vez; solo Moderación ve las fotos y decide; la insignia sale en el perfil.
const sharp = require('sharp');
const { prisma, B, U, NAMES, call, ok, snapshotPlans } = require('./fixtures.cjs');

let hit = 0;
const ip = () => '10.77.' + Math.floor(++hit / 250) + '.' + (hit % 250);
const plan = (who, planKey) => call('POST', '/billing/test-plan', who, { planKey }, ip());

(async () => {
  const restorePlans = await snapshotPlans(['nobuyer']);
  const store = (await prisma.user.findFirst({ where: { firebaseUid: 'cztest-nobuyer' }, select: { id: true } })).id;
  const photo = await sharp({ create: { width: 900, height: 700, channels: 3, background: { r: 200, g: 40, b: 40 } } }).jpeg().toBuffer();
  const send = async (who, withPhoto = true) => {
    const form = new FormData();
    if (withPhoto) form.append('facade', new Blob([photo], { type: 'image/jpeg' }), 'fachada.jpg');
    form.append('note', 'Local en la galería');
    const res = await fetch(B + '/stores/me/verification', { method: 'POST', headers: { Authorization: 'Bearer test-' + U[who], 'X-Forwarded-For': ip() }, body: form });
    return { status: res.status, j: await res.json().catch(() => ({})) };
  };
  const verifiedBefore = (await prisma.user.findUnique({ where: { id: store }, select: { identityVerifiedAt: true } })).identityVerifiedAt;
  await prisma.user.update({ where: { id: store }, data: { identityVerifiedAt: new Date() } }); // el local público exige la cuenta verificada
  try {
    await prisma.storeVerification.deleteMany({ where: { userId: store } });
    await prisma.storeProfile.deleteMany({ where: { userId: store } });
    let r;
    await plan('nobuyer', 'free');
    r = await send('nobuyer');
    ok('sin plan Tienda → 403', r.status === 403, String(r.status));
    await plan('nobuyer', 'store');
    await prisma.storeProfile.create({ data: { userId: store, enabled: true, address: 'Arauco 5', comuna: 'Chillán', region: 'Ñuble' } });
    r = await send('nobuyer', false);
    ok('sin foto de fachada → 400', r.status === 400, String(r.status));
    r = await send('nobuyer');
    ok('envía la solicitud', r.status === 200 && r.j.request.status === 'pending', JSON.stringify(r.j));
    const reqId = r.j.request?.id;
    r = await send('nobuyer');
    ok('una pendiente a la vez → 409', r.status === 409, String(r.status));

    r = await call('GET', '/admin/store-verifications', 'jerry', null, ip());
    ok('alguien sin rol no ve la cola', r.status === 401 || r.status === 403, String(r.status));
    const raw = await fetch(B + '/admin/store-verifications/' + reqId + '/photo/facade', { headers: { Authorization: 'Bearer test-' + U.jerry } });
    ok('alguien sin rol no ve la foto', raw.status === 401 || raw.status === 403, String(raw.status));
    const stored = await prisma.storeVerification.findUnique({ where: { id: reqId } });
    ok('la foto se guarda cifrada en la ruta privada', stored.facadeKey.startsWith('Carpetazo.cl/Verificaciones/') && stored.facadeKey.endsWith('.bin'));

    r = await call('GET', '/admin/store-verifications', 'admin', null, ip());
    ok('Moderación ve la solicitud con la dirección', r.status === 200 && r.j.requests.some((x) => x.id === reqId && x.user.address === 'Arauco 5'), String(r.status));
    const pic = await fetch(B + '/admin/store-verifications/' + reqId + '/photo/facade', { headers: { Authorization: 'Bearer test-' + U.admin } });
    // El R2 simulado de las pruebas no guarda archivos (devuelve una imagen fija), así que no se puede descifrar: aquí solo se prueba que Moderación tiene permiso
    ok('Moderación tiene permiso para ver la foto', pic.status !== 401 && pic.status !== 403, String(pic.status));
    r = await call('POST', '/admin/store-verifications/' + reqId + '/reject', 'admin', {}, ip());
    ok('rechazar exige motivo → 400', r.status === 400, String(r.status));
    r = await call('POST', '/admin/store-verifications/' + reqId + '/approve', 'admin', {}, ip());
    ok('Moderación aprueba', r.status === 200, String(r.status));
    r = await call('POST', '/admin/store-verifications/' + reqId + '/approve', 'admin', {}, ip());
    ok('no se decide dos veces → 409', r.status === 409, String(r.status));

    r = await call('GET', '/users/' + NAMES.nobuyer, null, null, ip());
    ok('el perfil muestra «Tienda verificada»', r.j.user?.store?.verified === true, JSON.stringify(r.j.user?.store?.verified));
    ok('el perfil no expone las fotos de verificación', !JSON.stringify(r.j).includes('Verificaciones/'));
    r = await call('GET', '/stores/me/verification', 'nobuyer', null, ip());
    ok('la tienda ve que está verificada', r.j.verified === true);
  } finally {
    await prisma.storeVerification.deleteMany({ where: { userId: store } });
    await prisma.storeProfile.deleteMany({ where: { userId: store } });
    await prisma.moderationAudit.deleteMany({ where: { targetId: store, action: { startsWith: 'store_verification' } } });
    await prisma.user.update({ where: { id: store }, data: { identityVerifiedAt: verifiedBefore } });
    await restorePlans();
    await prisma.$disconnect();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
