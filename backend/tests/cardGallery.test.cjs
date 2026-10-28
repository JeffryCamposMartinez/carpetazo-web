// Galería de una carta: hasta 5 fotos extra por carta, para cualquier plan; solo fotos propias; se ven en la carpeta pública y en la ficha. R2 es el simulado.
const sharp = require('sharp');
const { prisma, NAMES, B, U, call, ok } = require('./fixtures.cjs');

let n = 0;
const picture = (seed) => sharp({ create: { width: 300, height: 420, channels: 3, background: { r: (seed * 53) % 256, g: (seed * 97) % 256, b: (seed * 29) % 256 } } }).png().toBuffer();
const upload = async (who, buffer) => {
  const form = new FormData();
  form.append('image', new Blob([buffer], { type: 'image/png' }), 'foto.png');
  form.append('type', 'card');
  const r = await fetch(B + '/users/upload-image', { method: 'POST', headers: { Authorization: 'Bearer test-' + U[who], 'x-test-scan': 'clear', 'X-Forwarded-For': '10.99.5.' + (1 + (n++ % 200)) }, body: form });
  const j = await r.json().catch(() => ({}));
  if (!j.url) throw new Error('La subida falló: ' + r.status + ' ' + JSON.stringify(j));
  return j.url;
};
const r2Log = async () => (await (await fetch(B + '/__test/r2-log')).json()).log;

(async () => {
  try {
    const folder = (await call('POST', '/folders', 'seller', { name: 'CZTEST galería', tcg: 'Pokemon', color: 'blue', isPublic: true })).j.folder.id;
    const added = await call('POST', `/folders/${folder}/cards`, 'seller', { tcgId: '98001001', name: 'CZTEST Galería', price: 1000, stock: 1, data: { catalogOrder: 0 } });
    const cardId = added.j.card.id;
    const route = `/folders/${folder}/cards/${cardId}/photos`;

    const urls = [];
    for (let i = 1; i <= 6; i++) urls.push(await upload('seller', await picture(i)));
    let r = await call('POST', route, 'seller', { url: urls[0] });
    ok('el dueño agrega una foto a su carta', r.status === 200 && r.j.photos?.length === 1 && r.j.photos[0].url === urls[0], JSON.stringify(r.j));
    r = await call('POST', route, 'seller', { url: urls[0] });
    ok('la misma foto no se agrega dos veces', r.status === 409);
    for (let i = 1; i < 5; i++) r = await call('POST', route, 'seller', { url: urls[i] });
    ok('puede llegar a 5 fotos', r.status === 200 && r.j.photos.length === 5, JSON.stringify(r.j));
    r = await call('POST', route, 'seller', { url: urls[5] });
    ok('la sexta foto se rechaza con un mensaje claro', r.status === 409 && /hasta 5/.test(r.j.message || ''), JSON.stringify(r.j));

    r = await call('POST', route, 'seller', { url: 'https://evil.example.com/x.webp' });
    ok('una dirección que no es de nuestro R2 se rechaza', r.status === 400);
    const foreign = await upload('jerry', await picture(9));
    r = await call('POST', route, 'seller', { url: foreign });
    ok('la foto de otra persona no se puede agregar', r.status === 400 || r.status === 409, JSON.stringify(r));
    const stranger = await call('POST', route, 'jerry', { url: await upload('jerry', await picture(10)) });
    ok('quien no es el dueño de la carta no agrega fotos (404)', stranger.status === 404);

    let view = await call('GET', `/folders/${folder}`);
    const shown = (view.j?.folder?.cards || []).find((entry) => entry.id === cardId);
    ok('la carpeta pública muestra las 5 fotos en orden', view.status === 200 && shown?.photos?.length === 5 && shown.photos.every((photo, i) => photo.url === urls[i]), JSON.stringify(shown?.photos));
    r = await call('GET', `/cards/${cardId}/offers`);
    ok('la ficha de la carta trae su galería', r.status === 200 && r.j.card?.photos?.length === 5, JSON.stringify(r.j.card?.photos));

    const first = shown.photos[0];
    r = await call('DELETE', `${route}/${first.id}`, 'jerry');
    ok('otra persona no puede quitar una foto ajena (404)', r.status === 404);
    r = await call('DELETE', `${route}/${first.id}`, 'seller');
    ok('el dueño quita una foto y quedan 4', r.status === 200 && r.j.photos?.length === 4);
    ok('al quitarla se borra su archivo de R2', (await r2Log()).some((entry) => entry.op === 'delete' && entry.key.endsWith(urls[0].split('/').pop())));
    r = await call('POST', route, 'seller', { url: urls[5] });
    ok('con espacio liberado vuelve a poder agregar', r.status === 200 && r.j.photos.length === 5);

    // --- Fotos extra al agregar la carta, y descartar las que no se guardan
    const keyName = (url) => url.split('/').pop();
    const mine = [];
    for (let k = 21; k < 28; k++) mine.push(await upload('seller', await picture(k)));
    const newCard = (photos) => call('POST', `/folders/${folder}/cards`, 'seller', { tcgId: '98001002', name: 'CZTEST Galería 2', price: 1000, stock: 1, data: { catalogOrder: 1 }, photos });
    r = await newCard(mine.slice(0, 6));
    ok('más de 5 fotos extra al agregar la carta se rechaza', r.status === 400, JSON.stringify(r.j));
    r = await newCard([mine[0], mine[0]]);
    ok('fotos repetidas al agregar la carta se rechazan', r.status === 400);
    r = await newCard([foreign]);
    ok('la foto de otra persona al agregar la carta se rechaza', r.status === 400);
    ok('nada de eso creó la carta', (await prisma.card.count({ where: { folderId: folder, tcgId: '98001002' } })) === 0);
    r = await newCard(mine.slice(0, 2));
    ok('al agregar la carta se guardan sus fotos extra, en orden', r.status === 200 && r.j.card?.photos?.length === 2 && r.j.card.photos[0].url === mine[0] && r.j.card.photos[1].url === mine[1], JSON.stringify(r.j));

    const log0 = (await r2Log()).length;
    r = await call('POST', '/users/discard-card-photo', 'seller', { url: mine[5] });
    ok('una foto subida que no se guardó se descarta y se borra de R2', r.status === 200 && r.j.deleted === true && (await r2Log()).slice(log0).some((entry) => entry.op === 'delete' && entry.key.endsWith(keyName(mine[5]))), JSON.stringify(r.j));
    const log1 = (await r2Log()).length;
    r = await call('POST', '/users/discard-card-photo', 'seller', { url: mine[0] });
    ok('una foto que ya está en una carta no se borra', r.status === 200 && r.j.deleted === false && !(await r2Log()).slice(log1).some((entry) => entry.op === 'delete'), JSON.stringify(r.j));
    r = await call('POST', '/users/discard-card-photo', 'seller', { url: foreign });
    ok('no se puede descartar la foto de otra persona', r.status === 400);
    r = await call('POST', '/users/discard-card-photo', 'seller', { url: 'https://evil.example.com/x.webp' });
    ok('una dirección ajena no se descarta', r.status === 400);

    // La limpieza diaria de archivos sin uso no toca las fotos de una galería
    const { findOrphanFiles } = await import('../core/orphanFiles.js');
    const old = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const orphans = await findOrphanFiles([{ key: new URL(mine[1]).pathname.replace(/^\//, ''), lastModified: old }, { key: new URL(urls[2]).pathname.replace(/^\//, ''), lastModified: old }]);
    ok('la limpieza diaria no borra fotos de galería aunque tengan más de 7 días', orphans.length === 0, JSON.stringify(orphans));
  } catch (error) {
    ok('la galería no lanzó errores inesperados', false, error.stack);
  } finally {
    await prisma.folder.deleteMany({ where: { name: 'CZTEST galería' } });
    await prisma.$disconnect();
  }
})();
