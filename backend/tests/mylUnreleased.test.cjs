// Las fichas de cartas que mazos.cl aún no revela («Carta Unreleased», «Carta Preview»…) no salen en el catálogo público de Mitos y Leyendas.
const { prisma, call, ok } = require('./fixtures.cjs');

const GROUP = 98990001;
const IDS = { visible: 'cztest-unrel-1', oculta: 'cztest-unrel-2', oculta2: 'cztest-unrel-3', realCarta: 'cztest-unrel-4', conImagen: 'cztest-unrel-5' };

(async () => {
  let createdCategory = false;
  try {
    if (!(await prisma.tcgCategory.findUnique({ where: { categoryId: 99 } }))) {
      await prisma.tcgCategory.create({ data: { categoryId: 99, name: 'Mitos y Leyendas', modifiedOn: new Date() } });
      createdCategory = true;
    }
    await prisma.tcgGroup.create({ data: { groupId: GROUP, categoryId: 99, name: 'CZTEST Edición Oculta', publishedOn: new Date(), modifiedOn: new Date() } });
    const row = (productId, name, type = 'ALIADO') => ({ productId, groupId: GROUP, categoryId: 99, name, cleanName: name.toLowerCase().replace(/[^a-z0-9 ]/g, ''), imageUrl: '', extData: [{ name: 'Type', value: type }] });
    await prisma.tcgProduct.createMany({ data: [row(IDS.visible, 'CZTEST Carta Real'), row(IDS.oculta, 'Carta Unreleased', 'NONE'), row(IDS.oculta2, 'Carta Preview', 'NONE'), row(IDS.realCarta, 'Carta Nautica'), { ...row(IDS.conImagen, 'Carta WIP', 'NONE'), imageUrl: 'https://example.com/a.webp' }] });

    let r = await call('GET', `/tcg/99/${GROUP}/products`, null);
    const names = (r.j?.data || []).map((card) => card.name);
    ok('la lista de la edición trae la carta real y no la «Carta Unreleased»', r.status === 200 && names.includes('CZTEST Carta Real') && !names.includes('Carta Unreleased') && !names.includes('Carta Preview'), JSON.stringify(names));
    r = await call('GET', `/tcg/search?categoryId=99&groupId=${GROUP}&q=`, null);
    const found = (r.j?.data || []).map((card) => card.name);
    ok('la búsqueda tampoco la devuelve', r.status === 200 && found.includes('CZTEST Carta Real') && !found.includes('Carta Unreleased') && !found.includes('Carta Preview'), JSON.stringify(found));
    r = await call('GET', `/tcg/search?categoryId=99&q=Unreleased`, null);
    ok('una carta real que empieza con «Carta» (otro tipo) sí se muestra', names.includes('Carta Nautica') && found.includes('Carta Nautica'));
    ok('una ficha de relleno que ya tiene imagen sí se muestra', names.includes('Carta WIP') && found.includes('Carta WIP'));
    ok('ni buscándola por su nombre', r.status === 200 && !(r.j?.data || []).some((card) => card.name === 'Carta Unreleased'));
  } finally {
    await prisma.tcgProduct.deleteMany({ where: { productId: { in: Object.values(IDS) } } });
    await prisma.tcgGroup.deleteMany({ where: { groupId: GROUP } });
    if (createdCategory) await prisma.tcgCategory.deleteMany({ where: { categoryId: 99 } });
    await prisma.$disconnect();
  }
})();
