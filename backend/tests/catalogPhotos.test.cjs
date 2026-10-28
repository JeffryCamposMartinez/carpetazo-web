// Fotos de la comunidad para cartas del catálogo sin imagen: la propuesta sale sola al subir la foto, Moderación aprueba o rechaza,
// y al aprobar la carta tiene imagen para todos. R2 es el simulado de las pruebas.
const sharp = require('sharp');
const { prisma, NAMES, B, U, call, ok } = require('./fixtures.cjs');

const GAME_ID = 98003;
const GAME = 'CZTEST_Fotos';
const SET_ID = 98000301;
const IDS = { sinImagen: 98000311, otra: 98000312, conImagen: 98000313, producto: 98000314, cuarta: 98000315 };
const ALL_IDS = Object.values(IDS);

const picture = (seed) => sharp({ create: { width: 300, height: 420, channels: 3, background: { r: (seed * 53) % 256, g: (seed * 97) % 256, b: (seed * 29) % 256 } } }).png().toBuffer();
let n = 0;
const upload = async (who, buffer) => {
  const form = new FormData();
  form.append('image', new Blob([buffer], { type: 'image/png' }), 'foto.png');
  form.append('type', 'card');
  const r = await fetch(B + '/users/upload-image', { method: 'POST', headers: { Authorization: 'Bearer test-' + U[who], 'x-test-scan': 'clear', 'X-Forwarded-For': '10.77.3.' + (1 + (n++ % 200)) }, body: form });
  const j = await r.json().catch(() => ({}));
  if (!j.url) throw new Error('La subida falló: ' + r.status + ' ' + JSON.stringify(j));
  return j.url;
};
const r2Log = async () => (await (await fetch(B + '/__test/r2-log')).json()).log;
const keyOf = (url) => new URL(url).pathname.replace(/^\//, '');

(async () => {
  const roles = {};
  try {
    // Catálogo de prueba: 4 cartas (una ya con imagen) y un producto, todas sin imagen salvo una
    await prisma.catalogGame.create({ data: { categoryId: GAME_ID, name: 'CZTEST Fotos', folder: GAME } });
    await prisma.catalogSet.create({ data: { groupId: SET_ID, categoryId: GAME_ID, name: 'CZTEST Edición Fotos', folder: 'Edicion Fotos' } });
    const card = (productId, name, extra = {}) => ({ productId, categoryId: GAME_ID, groupId: SET_ID, kind: 'card', name, cleanName: name.toLowerCase(), number: String(productId % 100), rarity: 'Rare', folder: `${name} (${productId % 100})`, ...extra });
    await prisma.catalogCard.createMany({ data: [
      card(IDS.sinImagen, 'CZTEST Sin Imagen'), card(IDS.otra, 'CZTEST Otra Sin Imagen'),
      card(IDS.conImagen, 'CZTEST Con Imagen', { imageKey: `Carpetazo.cl/${GAME}/${GAME}_DB/${GAME}_Images/Edicion Fotos/x/x.webp` }),
      card(IDS.producto, 'CZTEST Caja', { kind: 'product' }), card(IDS.cuarta, 'CZTEST Cuarta Sin Imagen'),
    ] });
    for (const who of ['jeffry']) roles[who] = (await prisma.user.findUnique({ where: { firebaseUid: U[who] } })).role;
    await prisma.user.update({ where: { firebaseUid: U.jeffry }, data: { role: 'moderator' } });
    const idOf = async (who) => (await prisma.user.findUnique({ where: { firebaseUid: U[who] } })).id;
    const proposals = (where = {}) => prisma.catalogImageProposal.findMany({ where: { productId: { in: ALL_IDS }, ...where } });

    const folder = (await call('POST', '/folders', 'seller', { name: 'CZTEST fotos', tcg: 'Pokemon', color: 'blue', isPublic: true })).j.folder.id;
    const folder2 = (await call('POST', '/folders', 'seller', { name: 'CZTEST fotos 2', tcg: 'Pokemon', color: 'blue', isPublic: true })).j.folder.id;
    const add = (folderId, who, tcgId, imageUrl) => call('POST', `/folders/${folderId}/cards`, who, { tcgId: String(tcgId), name: 'Carta de prueba', price: 1000, stock: 1, imageUrl, data: { catalogOrder: 0 } });

    // --- La propuesta sale sola
    const photoA = await upload('seller', await picture(1));
    ok('la foto de carta se sube a la carpeta propia del usuario', keyOf(photoA).startsWith(`Carpetazo.cl/Usuarios/${U.seller}/card/`));
    let r = await add(folder, 'seller', IDS.sinImagen, photoA);
    ok('agregar la carta con foto propia funciona', r.status === 200);
    let list = await proposals();
    ok('se creó sola una propuesta pendiente para esa carta', list.length === 1 && list[0].status === 'pending' && list[0].productId === IDS.sinImagen && list[0].userId === (await idOf('seller')));
    const copyKey = list[0].imageKey;
    ok('la foto se copió a Propuestas/ (queda aunque la persona cambie la suya)', copyKey === `Carpetazo.cl/Propuestas/${list[0].id}.webp` && (await r2Log()).some((entry) => entry.op === 'copy' && entry.key === copyKey));

    r = await add(folder2, 'seller', IDS.sinImagen, photoA);
    ok('la misma persona no genera otra propuesta para la misma carta', (await proposals()).length === 1);
    r = await add(folder, 'seller', IDS.conImagen, photoA);
    ok('carta que ya tiene imagen: no hay propuesta', r.status === 200 && (await proposals({ productId: IDS.conImagen })).length === 0);
    const photoFolder = await call('GET', `/folders/${folder}`);
    const ownCardShown = (photoFolder.j?.folder?.cards || []).find((entry) => String(entry.tcgId) === String(IDS.conImagen));
    ok('la carpeta pública muestra la foto propia aunque el catálogo tenga imagen', photoFolder.status === 200 && String(ownCardShown?.imageUrl || '').includes('/Usuarios/'), String(ownCardShown?.imageUrl));
    const ownView = await call('GET', `/folders/${folder}`, 'seller');
    ok('la carpeta del dueño también la muestra', String((ownView.j?.folder?.cards || []).find((entry) => String(entry.tcgId) === String(IDS.conImagen))?.imageUrl || '').includes('/Usuarios/'));
    const noImageShown = (photoFolder.j?.folder?.cards || []).find((entry) => String(entry.tcgId) === String(IDS.sinImagen));
    ok('la carta sin imagen en el catálogo también muestra la foto propia en la carpeta', String(noImageShown?.imageUrl || '').includes('/Usuarios/'), String(noImageShown?.imageUrl));
    ok('carta que ya tiene imagen: se guarda con la foto propia', r.status === 200 && String(r.j?.card?.imageUrl || '').includes('/Usuarios/'), String(r.j?.card?.imageUrl));
    ok('un producto (no carta): no hay propuesta', (await add(folder, 'seller', IDS.producto, photoA)).status === 200 && (await proposals({ productId: IDS.producto })).length === 0);
    ok('carta agregada sin foto: no hay propuesta', (await add(folder, 'seller', IDS.otra, undefined)).status === 200 && (await proposals({ productId: IDS.otra })).length === 0);
    const jerryPhoto = await upload('jerry', await picture(2));
    r = await add(folder2, 'seller', IDS.otra, jerryPhoto);
    ok('la foto de otra persona no se propone', (await proposals({ productId: IDS.otra })).length === 0, 'agregar:' + r.status);

    // Otra persona propone la misma carta; el límite diario frena a quien ya llegó al tope
    const jerryId = await idOf('jerry');
    const alePhoto = await upload('ale', await picture(3));
    const aleFolder = (await call('POST', '/folders', 'ale', { name: 'CZTEST ale', tcg: 'Pokemon', color: 'blue', isPublic: true })).j.folder.id;
    await add(aleFolder, 'ale', IDS.sinImagen, alePhoto);
    list = await proposals({ productId: IDS.sinImagen });
    ok('dos personas proponen la misma carta: quedan dos propuestas', list.length === 2);
    const aleId = await idOf('ale');
    await prisma.catalogImageProposal.createMany({ data: Array.from({ length: 20 }, (_, i) => ({ productId: 98000400 + i, userId: jerryId, imageKey: `Carpetazo.cl/Propuestas/relleno-${i}.webp` })) });
    const jerryFolder = (await call('POST', '/folders', 'jerry', { name: 'CZTEST jerry', tcg: 'Pokemon', color: 'blue', isPublic: true })).j.folder.id;
    await add(jerryFolder, 'jerry', IDS.cuarta, jerryPhoto);
    ok('con 20 propuestas en el día no se crean más', (await proposals({ productId: IDS.cuarta })).length === 0);
    await prisma.catalogImageProposal.deleteMany({ where: { productId: { gte: 98000400, lt: 98000420 } } });

    // --- Permisos de la cola
    const route = '/admin/catalog-photos';
    ok('sin sesión → 401', (await call('GET', route, null)).status === 401);
    ok('cuenta normal → 403', (await call('GET', route, 'seller')).status === 403);
    await prisma.user.update({ where: { firebaseUid: U.jeffry }, data: { role: 'support' } });
    ok('soporte (solo lectura) → 403', (await call('GET', route, 'jeffry')).status === 403);
    await prisma.user.update({ where: { firebaseUid: U.jeffry }, data: { role: 'moderator' } });
    r = await call('GET', route, 'jeffry');
    const mine = r.j.proposals?.find((item) => item.card?.productId === IDS.sinImagen && item.username === NAMES.seller);
    ok('el moderador ve la cola con la carta, quién la subió y la foto', r.status === 200 && Boolean(mine) && mine.card.name === 'CZTEST Sin Imagen' && mine.card.edition === 'CZTEST Edición Fotos' && mine.imageUrl.startsWith('https://pub-cztest.r2.dev/Carpetazo.cl/Propuestas/') && mine.samePending === 2);
    ok('la cola no expone correo ni id de usuario', !/@test\.local|"userId"|firebaseUid/.test(JSON.stringify(r.j)));
    ok('el administrador también puede verla', (await call('GET', route, 'admin')).status === 200);
    ok('el contador del menú cuenta las pendientes', (await call('GET', '/admin/summary', 'jeffry')).j.catalogPhotos >= 2);
    ok('aprobar sin permiso → 403', (await call('POST', `${route}/${mine.id}/approve`, 'seller')).status === 403);
    ok('id inválido → 400', (await call('POST', `${route}/no-es-un-id/approve`, 'jeffry')).status === 400);
    ok('propuesta que no existe → 404', (await call('POST', `${route}/00000000-0000-4000-8000-000000000000/approve`, 'jeffry')).status === 404);

    // --- Aprobar
    r = await call('POST', `${route}/${mine.id}/approve`, 'jeffry');
    const approved = await prisma.catalogCard.findUnique({ where: { productId: IDS.sinImagen } });
    const expected = `Carpetazo.cl/${GAME}/${GAME}_DB/${GAME}_Images/Edicion Fotos/CZTEST Sin Imagen (11)/CZTEST Sin Imagen (11).webp`;
    ok('aprobar: la carta queda con su imagen y miniatura en la ruta de TcgplayerUpdate', r.status === 200 && approved.imageKey === expected && approved.thumbKey === expected.replace('_Images/', '_Thumbs/'), JSON.stringify(r.j));
    const log = await r2Log();
    ok('se subieron la imagen y la miniatura a R2 y se borraron las copias de propuestas', log.some((e) => e.op === 'put' && e.key === approved.imageKey) && log.some((e) => e.op === 'put' && e.key === approved.thumbKey) && log.some((e) => e.op === 'delete' && e.key === copyKey));
    const after = await proposals({ productId: IDS.sinImagen });
    ok('la aprobada queda aprobada y la otra de esa carta se cierra', after.filter((p) => p.status === 'approved').length === 1 && after.filter((p) => p.status === 'closed').length === 1 && after.find((p) => p.status === 'approved').decidedAt);
    ok('quedó el registro en la auditoría', (await prisma.moderationAudit.count({ where: { action: 'catalogphoto.approve', targetId: String(IDS.sinImagen) } })) === 1);
    const notice = async (marker) => (await prisma.message.findMany({ where: { receiverId: (await prisma.catalogImageProposal.findUnique({ where: { id: mine.id } })).userId, senderId: await idOf('jeffry') } })).filter((m) => marker.test(JSON.parse(m.content).text));
    ok('al aprobar, la persona recibe un aviso con el nombre de la carta', (await notice(/foto de carta fue aprobada[\s\S]*CZTEST Sin Imagen/)).length === 1);
    ok('aprobar de nuevo → 404 (ya no está pendiente)', (await call('POST', `${route}/${mine.id}/approve`, 'jeffry')).status === 404);
    const folderView = await call('GET', `/folders/${folder}`, null);
    const shown = (folderView.j.folder?.cards || folderView.j.cards || []).find((c) => String(c.tcgId) === String(IDS.sinImagen));
    ok('después de aprobar, la carpeta de quien subió la foto sigue mostrando su foto', Boolean(shown) && String(shown.imageUrl).includes('/Usuarios/'), shown?.imageUrl);
    ok('nuevas fotos para una carta que ya tiene imagen no se proponen', (await add(aleFolder, 'ale', IDS.sinImagen, alePhoto)).status !== 500 && (await proposals({ productId: IDS.sinImagen })).length === 2);

    // --- Rechazar
    const photoB = await upload('seller', await picture(4));
    await add(folder2, 'seller', IDS.cuarta, photoB);
    const toReject = (await proposals({ productId: IDS.cuarta }))[0];
    ok('motivo demasiado largo → 400', (await call('POST', `${route}/${toReject.id}/reject`, 'jeffry', { note: 'x'.repeat(301) })).status === 400);
    ok('rechazar sin permiso → 403', (await call('POST', `${route}/${toReject.id}/reject`, 'seller', { note: 'no' })).status === 403);
    r = await call('POST', `${route}/${toReject.id}/reject`, 'jeffry', { note: 'Foto borrosa' });
    const rejected = await prisma.catalogImageProposal.findUnique({ where: { id: toReject.id } });
    ok('rechazar: queda rechazada con su motivo y la carta sigue sin imagen', r.status === 200 && rejected.status === 'rejected' && rejected.note === 'Foto borrosa' && (await prisma.catalogCard.findUnique({ where: { productId: IDS.cuarta } })).imageKey === null);
    ok('al rechazar, la persona recibe un aviso con el motivo', (await prisma.message.findMany({ where: { receiverId: toReject.userId, senderId: await idOf('jeffry') } })).some((m) => /no fue aprobada[\s\S]*Foto borrosa/.test(JSON.parse(m.content).text)));
    ok('la copia de la propuesta rechazada se borró de R2', (await r2Log()).some((e) => e.op === 'delete' && e.key === toReject.imageKey));
    ok('la persona no puede volver a proponer la misma carta', (await add(folder, 'seller', IDS.cuarta, photoB)).status !== undefined && (await proposals({ productId: IDS.cuarta })).length === 1);
    ok('rechazar de nuevo → 404', (await call('POST', `${route}/${toReject.id}/reject`, 'jeffry', {})).status === 404);
    ok('quedó el registro del rechazo', (await prisma.moderationAudit.count({ where: { action: 'catalogphoto.reject', targetId: String(IDS.cuarta) } })) === 1);

    // --- Carta que ya tiene imagen cuando se decide
    const late = await prisma.catalogImageProposal.create({ data: { productId: IDS.conImagen, userId: aleId, imageKey: 'Carpetazo.cl/Propuestas/tarde.webp' } });
    r = await call('POST', `${route}/${late.id}/approve`, 'jeffry');
    ok('aprobar una carta que ya tiene imagen → 409 y no la pisa', r.status === 409 && (await prisma.catalogCard.findUnique({ where: { productId: IDS.conImagen } })).imageKey.includes('/x/x.webp'));
    ok('el 409 no deja la propuesta a medias', (await prisma.catalogImageProposal.findUnique({ where: { id: late.id } })).status === 'pending');
  } catch (error) {
    ok('las fotos propuestas no lanzaron errores inesperados', false, error.stack);
  } finally {
    await prisma.catalogImageProposal.deleteMany({ where: { OR: [{ productId: { in: ALL_IDS } }, { productId: { gte: 98000400, lt: 98000420 } }] } });
    await prisma.moderationAudit.deleteMany({ where: { targetType: 'catalog', targetId: { in: ALL_IDS.map(String) } } });
    await prisma.catalogCard.deleteMany({ where: { categoryId: GAME_ID } });
    await prisma.catalogSet.deleteMany({ where: { categoryId: GAME_ID } });
    await prisma.catalogGame.deleteMany({ where: { categoryId: GAME_ID } });
    for (const [who, role] of Object.entries(roles)) await prisma.user.update({ where: { firebaseUid: U[who] }, data: { role } }).catch(() => {});
    await prisma.$disconnect();
  }
})();
