// Verificación de identidad por la ruta real: la persona envía RUT, teléfono y tres fotos; Moderación rechaza o aprueba; la insignia y el bloqueo del RUT.
// R2 es el simulado de las pruebas (guarda y no devuelve lo subido), así que aquí no se mira el contenido de las fotos.
const sharp = require('sharp');
const { prisma, NAMES, B, U, call, ok, acceptTerms } = require('./fixtures.cjs');

const RUT = '12345678-5'; // dígito verificador válido
let n = 0;
const photo = (seed) => sharp({ create: { width: 800, height: 600, channels: 3, background: { r: (seed * 53) % 256, g: (seed * 97) % 256, b: (seed * 29) % 256 } } }).png().toBuffer();

const submit = async (who, { rut = RUT, phone = '+56911112222', kinds = ['front', 'back', 'selfie'] } = {}) => {
  const form = new FormData();
  form.append('rut', rut);
  form.append('phone', phone);
  for (const kind of kinds) form.append(kind, new Blob([await photo(kind.length + n)], { type: 'image/png' }), `${kind}.png`);
  const r = await fetch(B + '/verification/request', { method: 'POST', headers: { Authorization: 'Bearer test-' + U[who], 'X-Forwarded-For': '10.88.4.' + (1 + (n++ % 200)) }, body: form });
  return { status: r.status, j: await r.json().catch(() => ({})) };
};

(async () => {
  let moderatorRole;
  try {
    moderatorRole = (await prisma.user.findUnique({ where: { firebaseUid: U.jeffry } })).role;
    await prisma.user.update({ where: { firebaseUid: U.jeffry }, data: { role: 'moderator' } });
    const seller = await prisma.user.findUnique({ where: { firebaseUid: U.seller } });
    await prisma.identityVerification.deleteMany({ where: { userId: seller.id } });
    await prisma.user.update({ where: { id: seller.id }, data: { identityVerifiedAt: null } });
    await acceptTerms?.('seller');

    let r = await call('GET', '/verification/me', 'seller');
    ok('la verificación está disponible y la persona parte sin verificar', r.status === 200 && r.j.available === true && r.j.verified === false && r.j.request === null, JSON.stringify(r.j));

    r = await submit('seller', { kinds: ['front', 'back'] });
    ok('sin la foto del rostro no se envía', r.status === 400 && /Faltan fotos/.test(r.j.message || ''), JSON.stringify(r));
    r = await submit('seller', { rut: '12345678-9' });
    ok('un RUT con dígito verificador incorrecto se rechaza', r.status === 400 && /RUT/.test(r.j.message || ''), JSON.stringify(r));
    r = await submit('seller', { phone: 'abc' });
    ok('un teléfono inválido se rechaza', r.status === 400 && /teléfono/.test(r.j.message || ''), JSON.stringify(r));
    ok('nada de lo rechazado quedó guardado', (await prisma.identityVerification.count({ where: { userId: seller.id } })) === 0);

    r = await submit('seller', { rut: '12.345.678-5' });
    ok('una solicitud completa queda en revisión', r.status === 200 && r.j.request?.status === 'pending', JSON.stringify(r));
    const row = await prisma.identityVerification.findFirst({ where: { userId: seller.id } });
    ok('el RUT se guarda normalizado y las fotos van cifradas bajo Verificaciones/', row.rut === RUT && [row.frontKey, row.backKey, row.selfieKey].every((key) => key.startsWith('Carpetazo.cl/Verificaciones/') && key.endsWith('.bin')), JSON.stringify(row));
    r = await submit('seller');
    ok('no puede tener dos solicitudes en revisión', r.status === 409, JSON.stringify(r));

    r = await call('GET', '/verification/me', 'seller');
    ok('la persona ve su solicitud en revisión', r.j.request?.status === 'pending' && r.j.verified === false);
    r = await call('GET', '/users/' + NAMES.seller);
    ok('en revisión todavía no es verificado', r.j.user.verified === false);

    r = await call('GET', '/admin/verifications', 'seller');
    ok('una persona sin rol de equipo no ve la cola', r.status === 403);
    r = await call('GET', '/admin/verifications', 'jeffry');
    const listed = r.j.requests?.find((entry) => entry.id === row.id);
    ok('Moderación ve la solicitud con el RUT y la persona', r.status === 200 && listed?.rut === RUT && listed?.user?.username === NAMES.seller, JSON.stringify(r.j).slice(0, 300));
    ok('la cola no trae las rutas de las fotos', !/Verificaciones|frontKey|selfieKey/.test(JSON.stringify(r.j)));
    r = await call('GET', '/admin/verifications/' + row.id + '/photo/passport', 'jeffry');
    ok('una foto que no existe se rechaza', r.status === 400);
    r = await call('GET', '/admin/verifications/' + row.id + '/photo/front', 'seller');
    ok('la persona no puede pedir las fotos por la ruta del equipo', r.status === 403);

    r = await call('POST', '/admin/verifications/' + row.id + '/reject', 'jeffry', {});
    ok('rechazar sin motivo no se permite', r.status === 400, JSON.stringify(r.j));
    r = await call('POST', '/admin/verifications/' + row.id + '/reject', 'jeffry', { reason: 'La foto del carnet salió borrosa.' });
    ok('Moderación rechaza con motivo', r.status === 200, JSON.stringify(r.j));
    r = await call('POST', '/admin/verifications/' + row.id + '/approve', 'jeffry', {});
    ok('una solicitud ya decidida no se decide otra vez', r.status === 409);
    r = await call('GET', '/verification/me', 'seller');
    ok('la persona ve el motivo para corregir', r.j.request?.status === 'rejected' && r.j.request?.reason === 'La foto del carnet salió borrosa.' && r.j.verified === false, JSON.stringify(r.j));

    r = await submit('seller');
    ok('después de un rechazo puede enviar otra solicitud', r.status === 200 && r.j.request?.status === 'pending', JSON.stringify(r));
    const second = await prisma.identityVerification.findFirst({ where: { userId: seller.id, status: 'pending' } });
    r = await call('POST', '/admin/verifications/' + second.id + '/approve', 'seller', {});
    ok('la persona no puede aprobarse a sí misma', r.status === 403);
    r = await call('POST', '/admin/verifications/' + second.id + '/approve', 'jeffry', {});
    ok('Moderación aprueba', r.status === 200, JSON.stringify(r.j));
    r = await call('GET', '/users/' + NAMES.seller);
    ok('el perfil público muestra la insignia de verificado', r.j.user.verified === true && !JSON.stringify(r.j).includes('identityVerifiedAt'));
    r = await call('GET', '/verification/me', 'seller');
    ok('la persona ve que está verificada', r.j.verified === true && r.j.request?.status === 'approved');
    r = await submit('seller');
    ok('una persona verificada no envía otra solicitud', r.status === 409, JSON.stringify(r));
    r = await call('PUT', '/users/me', 'seller', { rut: '11111111-1' });
    ok('el RUT verificado ya no se puede cambiar desde el perfil', r.status === 400 && /verificados/.test(r.j.error || ''), JSON.stringify(r.j));
    const audits = await prisma.moderationAudit.findMany({ where: { targetId: seller.id, action: { startsWith: 'identity.' } } });
    ok('el rechazo y la aprobación quedaron en el registro del equipo', audits.some((a) => a.action === 'identity.reject') && audits.some((a) => a.action === 'identity.approve'));
  } catch (error) {
    ok('la verificación por la ruta no lanzó errores inesperados', false, error.stack);
  } finally {
    const seller = await prisma.user.findUnique({ where: { firebaseUid: U.seller } });
    if (seller) {
      await prisma.moderationAudit.deleteMany({ where: { targetId: seller.id, action: { startsWith: 'identity.' } } });
      await prisma.identityVerification.deleteMany({ where: { userId: seller.id } });
      await prisma.user.update({ where: { id: seller.id }, data: { identityVerifiedAt: null } });
    }
    if (moderatorRole) await prisma.user.update({ where: { firebaseUid: U.jeffry }, data: { role: moderatorRole } });
    await prisma.$disconnect();
  }
})();
