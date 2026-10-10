// Carga de cartas nuevas desde cartas_incrementales.json: permisos, validación, vista previa y carga (con datos de prueba propios).
const { prisma, call, ok } = require('./fixtures.cjs');

const PATH = '/admin/catalog-import';
const FILE = 'cartas_incrementales.json';
const R2 = 'https://pub-cztest.r2.dev';
const BLOCK_NAME = 'CZTEST Bloque Carga';
const GROUP_ID = 98000001;
const IDS = ['980000001', '980000002', '980000003', '980000004'];

// Simula el archivo real: cada carácter UTF-8 pasa por Latin-1 y se vuelve a guardar como UTF-8
const moji = (text) => Buffer.from(text, 'utf8').toString('latin1');
const card = (n, extra = {}) => ({
  productId: IDS[n], groupId: GROUP_ID, categoryId: 99, physicalProductId: extra.physicalProductId ?? null, name: extra.name ?? `CZTEST Carta ${n}`, cleanName: 'ignorado',
  imageUrl: extra.imageUrl ?? `${R2}/Carpetazo.cl/test/carta${n}.webp`,
  extData: extra.extData ?? [
    { name: 'Type', value: 'ALIADO' }, { name: 'Cost', value: '2' }, { name: 'Race', value: 'BESTIA' },
    { name: 'Edition', value: moji('🍀 CZTEST Edición Carga') }, { name: 'Frequency', value: 'PROMOCIONAL' }, { name: 'Number', value: 'EDICION LIMITADA JO' },
    { name: 'Effect', value: moji('<p>Hace daño a un <strong>Tótem</strong>. &quot;Cita&quot;</p><script>x()</script>') }
  ]
});
const file = (products, links) => ({ format: 'carpetazo-card-catalog-incremental', version: 1, generatedAt: '2026-10-10T12:46:04-03:00', products, physicalLinks: links ?? products.filter((p) => p.physicalProductId).map((p) => ({ productId: p.productId, physicalProductId: p.physicalProductId })) });

(async () => {
  let createdCategory = false;
  let digest = '';
  let newDigest = '';
  try {
    // Datos propios: un bloque, una edición y un producto físico de prueba
    if (!(await prisma.tcgCategory.findUnique({ where: { categoryId: 99 } }))) {
      await prisma.tcgCategory.create({ data: { categoryId: 99, name: 'Mitos y Leyendas', modifiedOn: new Date() } });
      createdCategory = true;
    }
    // Los ids se eligen a mano: en una base restaurada la secuencia automática puede ir atrasada
    const nextBlock = ((await prisma.tcgBlock.aggregate({ _max: { id: true } }))._max.id || 0) + 1000;
    const nextPhysical = ((await prisma.tcgPhysicalProduct.aggregate({ _max: { id: true } }))._max.id || 0) + 1000;
    const block = await prisma.tcgBlock.create({ data: { id: nextBlock, categoryId: 99, name: BLOCK_NAME } });
    await prisma.tcgGroup.create({ data: { groupId: GROUP_ID, name: 'CZTEST Edición Carga', blockId: block.id, categoryId: 99, publishedOn: new Date(), modifiedOn: new Date() } });
    const physical = await prisma.tcgPhysicalProduct.create({ data: { id: nextPhysical, name: 'CZTEST Producto', categoryId: 99, blockId: block.id } });
    const otherBlock = await prisma.tcgBlock.create({ data: { id: nextBlock + 1, categoryId: 99, name: BLOCK_NAME + ' B' } });
    const foreign = await prisma.tcgPhysicalProduct.create({ data: { id: nextPhysical + 1, name: 'CZTEST Ajeno', categoryId: 99, blockId: otherBlock.id } });

    const good = file([card(0, { physicalProductId: physical.id }), card(1, { physicalProductId: physical.id })]);

    // Permisos y forma de la petición
    ok('sin sesión → 401', (await call('POST', PATH + '/preview', null, { fileName: FILE, data: good })).status === 401);
    ok('moderador sin ser administrador (cuenta normal) → 403', (await call('POST', PATH + '/preview', 'seller', { fileName: FILE, data: good })).status === 403);
    ok('nombre de archivo distinto → 400', (await call('POST', PATH + '/preview', 'admin', { fileName: 'otro.json', data: good })).status === 400);
    ok('contenido que no es objeto → 400', (await call('POST', PATH + '/preview', 'admin', { fileName: FILE, data: [1, 2] })).status === 400);
    ok('formato desconocido → 400', (await call('POST', PATH + '/preview', 'admin', { fileName: FILE, data: { format: 'x', version: 1, products: [] } })).status === 400);
    ok('archivo sin cartas → 400', (await call('POST', PATH + '/preview', 'admin', { fileName: FILE, data: file([]) })).status === 400);
    ok('apply sin sesión → 401', (await call('POST', PATH + '/apply', null, { fileName: FILE, data: good, digest: 'a'.repeat(64) })).status === 401);

    // Vista previa: no escribe nada y limpia los textos
    let r = await call('POST', PATH + '/preview', 'admin', { fileName: FILE, data: good });
    ok('vista previa válida → 200 con 2 cartas nuevas', r.status === 200 && r.j.counts.new === 2 && r.j.counts.exists === 0 && r.j.errors.length === 0, JSON.stringify(r.j?.counts));
    ok('vista previa: puede cargarse', r.j.canApply === true);
    ok('vista previa: edición reparada (sin emoji ni doble codificación)', r.j.editions[0]?.name === 'CZTEST Edición Carga');
    ok('vista previa: sin correo ni datos internos', !JSON.stringify(r.j).match(/firebaseUid|email/i));
    digest = r.j.digest;
    ok('la vista previa no creó cartas', (await prisma.tcgProduct.count({ where: { productId: { in: IDS } } })) === 0);

    // Errores que impiden cargar
    r = await call('POST', PATH + '/preview', 'admin', { fileName: FILE, data: file([{ ...card(0, { physicalProductId: physical.id }), groupId: 12345678 }]) });
    ok('edición inexistente → error y no se puede cargar', r.status === 200 && r.j.errors.length === 1 && r.j.canApply === false, JSON.stringify(r.j?.errors));
    r = await call('POST', PATH + '/preview', 'admin', { fileName: FILE, data: file([card(0, { physicalProductId: foreign.id })]) });
    ok('producto físico de otro bloque → error', r.j.errors.length === 1 && /bloque/.test(r.j.errors[0].message), JSON.stringify(r.j?.errors));
    r = await call('POST', PATH + '/preview', 'admin', { fileName: FILE, data: file([card(0, { imageUrl: 'https://evil.example.com/a.webp' })]) });
    ok('imagen en un dominio no permitido → error', r.j.errors.length === 1, JSON.stringify(r.j?.errors));
    r = await call('POST', PATH + '/preview', 'admin', { fileName: FILE, data: file([card(0, { extData: [{ name: 'Edition', value: 'CZTEST Edición Carga' }, { name: 'Admin', value: 'si' }] })]) });
    ok('campo no permitido → error', r.j.errors.length === 1 && /no permitido/.test(r.j.errors[0].message), JSON.stringify(r.j?.errors));
    r = await call('POST', PATH + '/preview', 'admin', { fileName: FILE, data: file([card(0, { extData: [{ name: 'Edition', value: 'Otra edición distinta' }] })]) });
    ok('edición del archivo distinta a la de la base → error', r.j.errors.length === 1 && /no coincide/.test(r.j.errors[0].message), JSON.stringify(r.j?.errors));
    r = await call('POST', PATH + '/preview', 'admin', { fileName: FILE, data: file([card(0), card(0)]) });
    ok('ID repetido en el archivo → error', r.j.errors.length === 1 && /repetido/.test(r.j.errors[0].message), JSON.stringify(r.j?.errors));
    r = await call('POST', PATH + '/preview', 'admin', { fileName: FILE, data: file([{ ...card(0), categoryId: 1 }]) });
    ok('categoría que no es Mitos y Leyendas → error', r.j.errors.length === 1);

    // Carga
    ok('apply sin digest → 400', (await call('POST', PATH + '/apply', 'admin', { fileName: FILE, data: good })).status === 400);
    ok('apply con digest de otra revisión → 409', (await call('POST', PATH + '/apply', 'admin', { fileName: FILE, data: good, digest: 'b'.repeat(64) })).status === 409);
    r = await call('POST', PATH + '/apply', 'admin', { fileName: FILE, data: file([{ ...card(0, { physicalProductId: physical.id }), groupId: 12345678 }]), digest });
    ok('apply con errores en el archivo → 409', r.status === 409);
    ok('nada se creó con los intentos fallidos', (await prisma.tcgProduct.count({ where: { productId: { in: IDS } } })) === 0);

    r = await call('POST', PATH + '/apply', 'admin', { fileName: FILE, data: good, digest });
    ok('apply válido → 200 con 2 creadas', r.status === 200 && r.j.created === 2 && r.j.existing === 0, JSON.stringify(r.j));
    const rows = await prisma.tcgProduct.findMany({ where: { productId: { in: IDS } }, include: { physicalLinks: true }, orderBy: { productId: 'asc' } });
    ok('las cartas quedaron en la categoría, edición y producto físico', rows.length === 2 && rows.every((row) => row.categoryId === 99 && row.groupId === GROUP_ID && row.physicalLinks.some((link) => link.physicalProductId === physical.id)));
    const effect = rows[0].extData.find((entry) => entry.name === 'Effect')?.value;
    ok('el efecto se guardó como texto plano (sin etiquetas ni scripts, con tildes y comillas)', effect === 'Hace daño a un Tótem. "Cita"', effect);
    ok('se agregó el formato del bloque', rows[0].extData.some((entry) => entry.name === 'Format' && entry.value === BLOCK_NAME));
    ok('la edición guardada no lleva emoji', rows[0].extData.find((entry) => entry.name === 'Edition').value === 'CZTEST Edición Carga');
    ok('quedó registro en la auditoría', (await prisma.moderationAudit.count({ where: { action: 'catalog.import', targetId: digest.slice(0, 16) } })) === 1);

    // Segunda carga: no duplica
    r = await call('POST', PATH + '/preview', 'admin', { fileName: FILE, data: good });
    ok('después de cargar, la vista previa dice que ya existen', r.j.counts.new === 0 && r.j.counts.exists === 2 && r.j.canApply === false, JSON.stringify(r.j?.counts));
    r = await call('POST', PATH + '/apply', 'admin', { fileName: FILE, data: good, digest: r.j.digest });
    ok('cargar otra vez no crea nada (no se procesa dos veces)', r.status === 200 && r.j.created === 0 && r.j.existing === 2, JSON.stringify(r.j));
    ok('sigue habiendo solo 2 cartas', (await prisma.tcgProduct.count({ where: { productId: { in: IDS } } })) === 2);

    // Un ID ya usado por otra carta no se pisa
    r = await call('POST', PATH + '/preview', 'admin', { fileName: FILE, data: file([card(0, { physicalProductId: physical.id, name: 'Zzqx Otra Cosa Distinta' })]) });
    ok('ID usado por otra carta → error de conflicto', r.j.errors.length === 1 && /otra carta/.test(r.j.errors[0].message), JSON.stringify(r.j?.errors));

    // Corrección de una carta que ya existe (mismo ID y edición, nombre parecido): se actualiza en vez de rechazarla
    const fixedCard = card(0, { physicalProductId: physical.id, name: 'CZTEST Carta Cero' });
    r = await call('POST', PATH + '/preview', 'admin', { fileName: FILE, data: file([fixedCard]) });
    ok('nombre corregido de una carta existente → se marca como corrección', r.status === 200 && r.j.errors.length === 0 && r.j.counts.updated === 1 && r.j.counts.new === 0 && r.j.cards[0].status === 'update' && r.j.cards[0].previousName === 'CZTEST Carta 0' && r.j.canApply === true, JSON.stringify(r.j?.counts) + JSON.stringify(r.j?.errors));
    r = await call('POST', PATH + '/apply', 'admin', { fileName: FILE, data: file([fixedCard]), digest: r.j.digest });
    ok('apply de una corrección → actualiza nombre y no crea nada', r.status === 200 && r.j.created === 0 && r.j.updated === 1, JSON.stringify(r.j));
    const fixedRow = await prisma.tcgProduct.findUnique({ where: { productId: IDS[0] } });
    ok('la carta quedó con el nombre corregido, en la misma edición', fixedRow.name === 'CZTEST Carta Cero' && fixedRow.cleanName === 'cztest carta cero' && fixedRow.groupId === GROUP_ID, JSON.stringify(fixedRow));
    r = await call('POST', PATH + '/preview', 'admin', { fileName: FILE, data: file([fixedCard]) });
    ok('repetir la corrección → sin cambios', r.j.counts.updated === 0 && r.j.counts.exists === 1 && r.j.canApply === false, JSON.stringify(r.j?.counts));

    // Edición y producto que no existen en la base: el archivo trae sus nombres y se crean al cargar
    const withDefs = (products, extra = {}) => ({ ...file(products), ...extra });
    const newCard = card(2, { physicalProductId: 98000098, extData: [{ name: 'Type', value: 'ALIADO' }, { name: 'Edition', value: 'CZTEST Edición Nueva' }, { name: 'Number', value: 'X-1' }] });
    const newFile = withDefs([{ ...newCard, groupId: 98000099 }], { groups: [{ groupId: 98000099, name: moji('CZTEST Edición Nueva'), blockName: BLOCK_NAME }], physicalProducts: [{ id: 98000098, name: 'CZTEST Producto Nuevo', blockName: BLOCK_NAME }] });
    r = await call('POST', PATH + '/preview', 'admin', { fileName: FILE, data: newFile });
    ok('edición y producto nuevos: se planea crearlos', r.status === 200 && r.j.errors.length === 0 && r.j.counts.newGroups === 1 && r.j.counts.newProducts === 1 && r.j.counts.new === 1, JSON.stringify(r.j?.counts) + JSON.stringify(r.j?.errors));
    ok('edición y producto nuevos: se marcan como nuevos en la revisión', r.j.editions[0]?.isNew === true && r.j.physicalProducts[0]?.isNew === true);
    ok('la vista previa no creó la edición ni el producto', (await prisma.tcgGroup.count({ where: { name: 'CZTEST Edición Nueva' } })) === 0 && (await prisma.tcgPhysicalProduct.count({ where: { name: 'CZTEST Producto Nuevo' } })) === 0);
    newDigest = r.j.digest;
    r = await call('POST', PATH + '/apply', 'admin', { fileName: FILE, data: newFile, digest: newDigest });
    ok('apply con edición y producto nuevos → 200', r.status === 200 && r.j.created === 1 && r.j.newGroups === 1 && r.j.newProducts === 1, JSON.stringify(r.j));
    const made = await prisma.tcgProduct.findUnique({ where: { productId: IDS[2] }, include: { group: true, physicalProduct: true, physicalLinks: true } });
    ok('la carta quedó en la edición nueva (dentro del bloque) y enlazada al producto nuevo', made?.group.name === 'CZTEST Edición Nueva' && made.group.blockId === block.id && made.physicalProduct?.name === 'CZTEST Producto Nuevo' && made.physicalProduct.blockId === block.id && made.physicalLinks.length === 1, JSON.stringify(made));
    r = await call('POST', PATH + '/preview', 'admin', { fileName: FILE, data: newFile });
    ok('repetir: ya existe y no pide crear nada otra vez', r.j.counts.newGroups === 0 && r.j.counts.newProducts === 0 && r.j.counts.exists === 1, JSON.stringify(r.j?.counts));

    // Los ids de otra base no importan si el archivo trae los nombres: se encuentra la edición y el producto existentes
    const foreignIds = withDefs([{ ...card(3, { physicalProductId: 5550001 }), groupId: 5550002 }], { groups: [{ groupId: 5550002, name: 'CZTEST Edición Carga', blockName: BLOCK_NAME }], physicalProducts: [{ id: 5550001, name: 'CZTEST Producto', blockName: BLOCK_NAME }] });
    r = await call('POST', PATH + '/preview', 'admin', { fileName: FILE, data: foreignIds });
    ok('ids distintos pero mismos nombres → usa la edición y el producto de la base', r.j.errors.length === 0 && r.j.counts.newGroups === 0 && r.j.counts.newProducts === 0 && r.j.editions[0]?.groupId === GROUP_ID, JSON.stringify(r.j?.counts) + JSON.stringify(r.j?.errors));
    r = await call('POST', PATH + '/preview', 'admin', { fileName: FILE, data: withDefs([{ ...card(3), groupId: 5550003 }], { groups: [{ groupId: 5550003, name: 'Edición cualquiera', blockName: 'Bloque que no existe' }] }) });
    ok('bloque que no existe en la base → error', r.j.errors.length === 1 && /bloque/i.test(r.j.errors[0].message), JSON.stringify(r.j?.errors));
  } catch (error) {
    ok('la prueba terminó sin excepciones', false, error.message);
  } finally {
    await prisma.moderationAudit.deleteMany({ where: { action: 'catalog.import', targetType: 'catalog', targetId: { in: [digest.slice(0, 16), (typeof newDigest === 'string' ? newDigest : digest).slice(0, 16)] } } }).catch(() => {});
    await prisma.tcgProduct.deleteMany({ where: { productId: { in: IDS } } }).catch(() => {});
    await prisma.tcgPhysicalProduct.deleteMany({ where: { name: { startsWith: 'CZTEST' } } }).catch(() => {});
    await prisma.tcgGroup.deleteMany({ where: { OR: [{ groupId: GROUP_ID }, { name: { startsWith: 'CZTEST' } }] } }).catch(() => {});
    await prisma.tcgBlock.deleteMany({ where: { name: { startsWith: BLOCK_NAME } } }).catch(() => {});
    if (createdCategory) await prisma.tcgCategory.delete({ where: { categoryId: 99 } }).catch(() => {});
    await prisma.$disconnect();
  }
})();
