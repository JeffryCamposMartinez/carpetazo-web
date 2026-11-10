// Escáner de cartas: sesión obligatoria, imagen y cabeceras validadas, solo campos públicos hacia el navegador y errores genéricos (el motor es un servicio falso).
const { U, B, ok, acceptTerms } = require('./fixtures.cjs');

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);
const straighten = (body, { who = 'seller' } = {}) => fetch(B + '/scanner/straighten', {
  method: 'POST',
  headers: { 'Content-Type': 'image/jpeg', ...(who ? { Authorization: 'Bearer test-' + U[who] } : {}) },
  body,
}).then(async (r) => ({ status: r.status, j: await r.json().catch(() => null) }));
const scan = (body, { who = 'seller', type = 'image/jpeg', headers = {} } = {}) => fetch(B + '/scanner/scan', {
  method: 'POST',
  headers: { 'Content-Type': type, ...(who ? { Authorization: 'Bearer test-' + U[who] } : {}), ...headers },
  body,
}).then(async (r) => ({ status: r.status, j: await r.json().catch(() => null) }));

(async () => {
  try {
    await acceptTerms('seller');
    let r = await scan(JPEG, { who: null });
    ok('sin sesión también reconoce (abierto a visitantes)', r.status === 200 && r.j?.success === true, String(r.status));

    r = await straighten(JPEG, { who: null });
    ok('enderezar sin sesión → 401', r.status === 401, String(r.status));
    r = await straighten(JPEG);
    ok('enderezar con sesión → foto en base64', r.status === 200 && r.j?.found === true && r.j.image === 'AAAA', JSON.stringify(r.j));
    r = await straighten(Buffer.from('no es imagen, solo texto de relleno'));
    ok('enderezar un archivo que no es imagen → 400', r.status === 400, String(r.status));

    r = await scan(JPEG, { headers: { 'x-crop': '0.1,0.1,0.8,0.8', 'x-games': '3,100' } });
    const top = r.j?.top || [];
    ok('con sesión y una imagen válida → candidatas', r.status === 200 && r.j.success === true && r.j.found === true && top.length === 2, JSON.stringify(r.j).slice(0, 200));
    ok('solo campos públicos: sin vista previa, sin campos internos ni líneas del OCR', !('preview' in r.j) && !('indexed' in r.j) && !('relation' in top[0]) && !('secreto' in top[0]) && !('lines' in r.j.ocr), JSON.stringify(r.j).slice(0, 300));
    ok('la imagen de una URL no permitida se descarta y el puntaje se redondea', top[0].image === null && top[0].score === 0.8123 && top[0].categoryId === 3 && top[0].productId === 9876);
    ok('llegan las otras ediciones de la misma carta, solo con campos públicos', Array.isArray(r.j.same) && r.j.same.length === 1 && r.j.same[0].set === 'CZTEST Otra edición' && !('relation' in r.j.same[0]), JSON.stringify(r.j.same));
    ok('llega el idioma leído y la edición de cada candidata, sin la fuente interna', r.j.language?.code === 'es' && r.j.language.confidence === 0.8333 && !('source' in r.j.language) && top[0].groupId === 4321 && top[1].groupId === null, JSON.stringify(r.j.language));
    ok('el OCR llega resumido', r.j.ocr.margin === 0.31 && r.j.ocr.names[0] === 'cztest carta');

    r = await scan(JPEG, { headers: { 'x-games': '99' } });
    ok('un idioma que no es inglés, español ni japonés se descarta', r.status === 200 && r.j.language?.code === null, JSON.stringify(r.j.language));
    r = await scan(JPEG, { headers: { 'x-games': '85' } });
    ok('el motor no encuentra carta → found false', r.status === 200 && r.j.found === false && !r.j.top);

    r = await scan(JPEG, { headers: { 'x-games': '89' } });
    ok('el motor caído → 502 con mensaje genérico', r.status === 502 && !/fallo de prueba|500/.test(JSON.stringify(r.j)), JSON.stringify(r.j));

    ok('un archivo que no es imagen → 400', (await scan(Buffer.from('esto no es una imagen, solo texto largo'))).status === 400);
    ok('tipo de contenido no permitido → 400', (await scan(JPEG, { type: 'application/pdf' })).status === 400);
    ok('cuerpo vacío → 400', (await scan(Buffer.alloc(0))).status === 400);
    ok('recorte inválido → 400', (await scan(JPEG, { headers: { 'x-crop': '0.5,0.5,2,1' } })).status === 400 && (await scan(JPEG, { headers: { 'x-crop': 'a,b,c,d' } })).status === 400 && (await scan(JPEG, { headers: { 'x-crop': '0.1,0.1,0,0.5' } })).status === 400);
    ok('juegos inválidos → 400', (await scan(JPEG, { headers: { 'x-games': '3,999' } })).status === 400 && (await scan(JPEG, { headers: { 'x-games': 'todos' } })).status === 400);
    r = await scan(Buffer.concat([JPEG, Buffer.alloc(4_100_000, 2)]));
    ok('imagen de más de 4 MB → rechazada', r.status === 413 || r.status === 400, String(r.status));
  } catch (error) {
    ok('la prueba terminó sin excepciones', false, error.stack || error.message);
  }
})();
