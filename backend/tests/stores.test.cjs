// Ficha del local (plan Tienda): solo el dueño la edita, solo con el plan se publica, datos inválidos → 400, lo público va por lista blanca.
const sharp = require('sharp');
const { prisma, B, U, NAMES, call, ok, snapshotPlans } = require('./fixtures.cjs');

let hit = 0;
const ip = () => '10.71.' + Math.floor(++hit / 250) + '.' + (hit % 250);
const plan = (who, planKey) => call('POST', '/billing/test-plan', who, { planKey }, ip());
const allDays = { mon: [{ open: '00:00', close: '23:59' }], tue: [{ open: '00:00', close: '23:59' }], wed: [{ open: '00:00', close: '23:59' }], thu: [{ open: '00:00', close: '23:59' }], fri: [{ open: '00:00', close: '23:59' }], sat: [{ open: '00:00', close: '23:59' }], sun: [{ open: '00:00', close: '23:59' }] };
const valid = { enabled: true, address: 'Arauco 123', reference: 'Frente a la plaza', comuna: 'Chillán', hours: allDays, paymentMethods: ['cash', 'transfer'], buyGames: ['Pokémon'], sellGames: ['Pokémon', 'Mitos y Leyendas'], buyNote: 'Compramos colecciones', policy: 'Cambios en 7 días.', photos: [] };

(async () => {
  const restorePlans = await snapshotPlans(['nobuyer', 'ignacio']);
  const id = async (who) => (await prisma.user.findFirst({ where: { firebaseUid: 'cztest-' + who }, select: { id: true } })).id;
  const store = await id('nobuyer');
  const common = await id('ignacio');
  const verifiedBefore = (await prisma.user.findUnique({ where: { id: store }, select: { identityVerifiedAt: true } })).identityVerifiedAt;
  try {
    await prisma.storeProfile.deleteMany({ where: { userId: { in: [store, common] } } });
    let r;
    r = await call('GET', '/stores/me', null, null, ip());
    ok('sin sesión → 401', r.status === 401, String(r.status));

    await plan('nobuyer', 'free');
    r = await call('PUT', '/stores/me', 'nobuyer', valid, ip());
    ok('Free no guarda ficha → 403 plan_feature_locked', r.status === 403 && r.j.code === 'plan_feature_locked' && r.j.feature === 'storeTools', JSON.stringify(r.j));
    r = await call('GET', '/stores/me', 'nobuyer', null, ip());
    ok('Free: /stores/me dice que no está permitido', r.status === 200 && r.j.allowed === false && r.j.store === null, JSON.stringify(r.j));

    await plan('nobuyer', 'store');
    await prisma.user.update({ where: { id: store }, data: { identityVerifiedAt: null } });
    r = await call('PUT', '/stores/me', 'nobuyer', valid, ip());
    ok('sin cuenta verificada no se publica el local → 403 identity_required', r.status === 403 && r.j.code === 'identity_required', JSON.stringify(r.j));
    r = await call('PUT', '/stores/me', 'nobuyer', { ...valid, enabled: false }, ip());
    ok('sin verificar sí se puede guardar la ficha oculta', r.status === 200 && r.j.store.enabled === false, JSON.stringify(r.j));
    r = await call('GET', '/stores/me', 'nobuyer', null, ip());
    ok('/stores/me informa que falta verificar', r.j.identityVerified === false);
    await prisma.user.update({ where: { id: store }, data: { identityVerifiedAt: new Date() } });
    r = await call('PUT', '/stores/me', 'nobuyer', valid, ip());
    ok('plan Tienda guarda la ficha', r.status === 200 && r.j.store.address === 'Arauco 123' && r.j.store.enabled === true, JSON.stringify(r.j));
    r = await call('PUT', '/stores/me', 'nobuyer', { ...valid, comuna: 'Gotham', address: 'Otra 1' }, ip());
    ok('comuna inventada → 400', r.status === 400, String(r.status));
    r = await call('PUT', '/stores/me', 'nobuyer', { ...valid, photos: ['javascript:alert(1)'] }, ip());
    ok('foto javascript: → 400', r.status === 400, String(r.status));
    r = await call('PUT', '/stores/me', 'nobuyer', { ...valid, hours: { mon: [{ open: '25:00', close: '20:00' }] } }, ip());
    ok('hora 25:00 → 400', r.status === 400, String(r.status));
    r = await call('PUT', '/stores/me', 'nobuyer', { ...valid, policy: 'x'.repeat(30000) }, ip());
    ok('cuerpo gigante → 400', r.status === 400, String(r.status));
    const saved = await prisma.storeProfile.findUnique({ where: { userId: store } });
    ok('los rechazos no tocaron la ficha', saved.address === 'Arauco 123' && saved.comuna === 'Chillán');

    r = await call('GET', '/users/' + NAMES.nobuyer, null, null, ip());
    const pub = r.j.user?.store;
    ok('perfil público trae la ficha', r.status === 200 && pub?.address === 'Arauco 123' && pub.openNow?.open === true, JSON.stringify(pub));
    ok('la ficha pública no trae campos internos', pub && !['id', 'userId', 'enabled', 'createdAt', 'updatedAt', 'email'].some((k) => k in pub), Object.keys(pub || {}).join(','));

    r = await call('GET', '/sellers?kind=store', null, null, ip());
    const names = (r.j.sellers || []).map((s) => s.username);
    ok('«Tiendas» incluye a la tienda y no al vendedor común', r.status === 200 && names.includes(NAMES.nobuyer) && !names.includes(NAMES.ignacio), names.join(','));
    r = await call('GET', '/sellers?kind=store&open=1', null, null, ip());
    ok('«Abiertas ahora» incluye la tienda abierta todo el día', r.status === 200 && r.j.sellers.some((s) => s.username === NAMES.nobuyer && s.store.openNow === true), JSON.stringify(r.j.sellers?.map((s) => s.username)));
    r = await call('GET', '/sellers?kind=otra', null, null, ip());
    ok('kind desconocido → 400', r.status === 400, String(r.status));
    r = await call('GET', '/sellers?open=1', null, null, ip());
    ok('open=1 sin kind=store → 400', r.status === 400, String(r.status));

    // Vendedor común con una ficha guardada directo en la base: nunca se publica
    await plan('ignacio', 'free');
    await prisma.storeProfile.create({ data: { userId: common, enabled: true, address: 'Secreta 999', comuna: 'Chillán', region: 'Ñuble' } });
    r = await call('GET', '/users/' + NAMES.ignacio, null, null, ip());
    ok('vendedor sin plan Tienda no expone dirección', r.status === 200 && r.j.user.store === null && !JSON.stringify(r.j).includes('Secreta 999'), JSON.stringify(r.j.user?.store));

    // Si pierde la verificación, el local se oculta aunque siga guardado
    await prisma.user.update({ where: { id: store }, data: { identityVerifiedAt: null } });
    r = await call('GET', '/users/' + NAMES.nobuyer, null, null, ip());
    ok('sin cuenta verificada el perfil no muestra el local', r.status === 200 && r.j.user.store === null, JSON.stringify(r.j.user?.store));
    r = await call('GET', '/sellers?kind=store', null, null, ip());
    ok('y no sale en «Tiendas»', !(r.j.sellers || []).some((s) => s.username === NAMES.nobuyer));
    await prisma.user.update({ where: { id: store }, data: { identityVerifiedAt: new Date() } });

    // Baja de plan: se oculta, no se borra
    await plan('nobuyer', 'free');
    r = await call('GET', '/users/' + NAMES.nobuyer, null, null, ip());
    ok('al bajar de plan la ficha se oculta', r.status === 200 && r.j.user.store === null, JSON.stringify(r.j.user?.store));
    r = await call('GET', '/stores/me', 'nobuyer', null, ip());
    ok('…pero sigue guardada para el dueño', r.status === 200 && r.j.store?.address === 'Arauco 123' && r.j.allowed === false, JSON.stringify(r.j));

    // Fotos del local: solo con plan Tienda
    const png = await sharp({ create: { width: 320, height: 240, channels: 3, background: { r: 30, g: 60, b: 120 } } }).png().toBuffer();
    const upload = async (who) => {
      const form = new FormData();
      form.append('image', new Blob([png], { type: 'image/png' }), 'local.png');
      form.append('type', 'store');
      const res = await fetch(B + '/users/upload-image', { method: 'POST', headers: { Authorization: 'Bearer test-' + U[who], 'x-test-scan': 'clear', 'X-Forwarded-For': ip() }, body: form });
      return { status: res.status, j: await res.json().catch(() => ({})) };
    };
    r = await upload('nobuyer');
    ok('Free no sube fotos del local → 403', r.status === 403, String(r.status));
    await plan('nobuyer', 'store');
    r = await upload('nobuyer');
    ok('plan Tienda sube foto del local a su carpeta', r.status === 200 && /\/store\/[0-9a-f]{32}\.webp$/.test(r.j.url || ''), JSON.stringify(r.j));
    const photoUrl = r.j.url;
    r = await call('PUT', '/stores/me', 'nobuyer', { ...valid, photos: [photoUrl] }, ip());
    ok('la ficha acepta la foto propia', r.status === 200 && r.j.store.photos[0] === photoUrl, JSON.stringify(r.j));
  } finally {
    await prisma.storeProfile.deleteMany({ where: { userId: { in: [store, common] } } });
    await prisma.user.update({ where: { id: store }, data: { identityVerifiedAt: verifiedBefore } });
    await restorePlans();
    await prisma.$disconnect();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
