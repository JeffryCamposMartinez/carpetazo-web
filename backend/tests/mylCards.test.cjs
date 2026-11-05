// Cartas de Mitos y Leyendas subidas a mano desde Moderación: quién entra, validación, creación, duplicados, edición, bloqueo durante el barrido y que no hay forma de borrar.
const { prisma, call, ok } = require('./fixtures.cjs');

const PATH = '/admin/myl-cards';
const EDITION = 'CZTEST Edición Manual';

(async () => {
  let createdCategory = false;
  let createdBlock = null;
  try {
    if (!(await prisma.tcgCategory.findUnique({ where: { categoryId: 99 } }))) {
      await prisma.tcgCategory.create({ data: { categoryId: 99, name: 'Mitos y Leyendas', modifiedOn: new Date() } });
      createdCategory = true;
    }
    let block = await prisma.tcgBlock.findFirst({ where: { categoryId: 99, name: 'Primer Bloque' } });
    if (!block) {
      const nextBlock = ((await prisma.tcgBlock.aggregate({ _max: { id: true } }))._max.id || 0) + 1000;
      block = createdBlock = await prisma.tcgBlock.create({ data: { id: nextBlock, categoryId: 99, name: 'Primer Bloque' } });
    }
    const card = (extra = {}) => ({
      name: 'CZTEST Dragón Manual', blockId: block.id, newEdition: EDITION, newProduct: 'CZTEST Colección Manual', type: 'aliado', cost: '3', force: '2', races: ['dragon', 'bestia'],
      frequency: 'real', number: 'CZT-001-100', mechanics: ['Robar'], effect: 'Cuando entra en juego, roba una carta.\nSegunda línea <b>sin html</b>.', ...extra,
    });

    // Quién entra
    ok('sin sesión → 401', (await call('GET', PATH + '/access')).status === 401);
    ok('una cuenta normal → 403', (await call('GET', PATH + '/access', 'seller')).status === 403);
    ok('un administrador entra', (await call('GET', PATH + '/access', 'admin')).status === 200);
    ok('una cuenta de la lista de editores entra sin ser del equipo', (await call('GET', PATH + '/access', 'ignacio')).status === 200);
    ok('una cuenta normal no puede crear', (await call('POST', PATH, 'seller', card())).status === 403);
    let r = await call('GET', PATH + '/options', 'ignacio');
    ok('las opciones traen bloques, ediciones, productos y listas', r.status === 200 && r.j.blocks.some((item) => item.id === block.id) && r.j.types.includes('ALIADO') && r.j.frequencies.includes('REAL') && Array.isArray(r.j.races) && Array.isArray(r.j.mechanics), JSON.stringify(r.j).slice(0, 120));

    // Validación
    const bad = async (name, extra) => ok(name, (await call('POST', PATH, 'ignacio', card(extra))).status === 400);
    await bad('sin nombre → 400', { name: '' });
    await bad('tipo inválido → 400', { type: 'DRAGON' });
    await bad('frecuencia inválida → 400', { frequency: 'MUY_RARA' });
    await bad('coste que no es número → 400', { cost: 'abc' });
    await bad('más de 6 razas → 400', { races: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] });
    await bad('efecto demasiado largo → 400', { effect: 'x'.repeat(4001) });
    await bad('sin edición → 400', { newEdition: undefined });
    await bad('bloque inexistente → 400', { blockId: 987654321 });
    await bad('imagen de otra ruta → no se acepta', { imageUrl: 'https://example.com/a.webp' });

    // Crear
    r = await call('POST', PATH, 'ignacio', card());
    const created = r.j?.card;
    ok('crear una carta válida → 200 con id manual', r.status === 200 && /^manual-[a-z0-9]+$/.test(created?.productId), JSON.stringify(r.j).slice(0, 160));
    const row = await prisma.tcgProduct.findUnique({ where: { productId: created.productId }, include: { group: true, physicalLinks: true } });
    const names = row.extData.map((entry) => entry.name);
    ok('queda en la categoría 99, con la edición nueva y su producto', row.categoryId === 99 && row.group.name === EDITION && row.group.groupId >= 900000 && row.group.blockId === block.id && row.physicalLinks.length === 1);
    ok('los datos siguen el mismo formato que las demás cartas', names.join(',') === 'Type,Cost,Fuerza,Race,Race,Edition,Frequency,Number,Format,Slug,Effect,Mechanics', names.join(','));
    ok('tipo, razas y frecuencia quedan en mayúsculas', row.extData.find((e) => e.name === 'Type').value === 'ALIADO' && row.extData.filter((e) => e.name === 'Race').map((e) => e.value).join() === 'DRAGON,BESTIA' && row.extData.find((e) => e.name === 'Frequency').value === 'REAL');
    ok('el efecto sale como párrafos y sin html del usuario', row.extData.find((e) => e.name === 'Effect').value === '<p>Cuando entra en juego, roba una carta.</p><p>Segunda línea &lt;b&gt;sin html&lt;/b&gt;.</p>');
    ok('el formato es el bloque y el slug sale del nombre', row.extData.find((e) => e.name === 'Format').value === 'Primer Bloque' && row.extData.find((e) => e.name === 'Slug').value === 'cztest-dragon-manual');
    ok('queda en el registro de auditoría', (await prisma.moderationAudit.count({ where: { action: 'myl.card.create', targetId: created.productId } })) === 1);

    // Duplicados
    r = await call('POST', PATH, 'ignacio', card({ newEdition: undefined, groupId: row.groupId }));
    ok('la misma carta en la misma edición → 409 con la carta parecida', r.status === 409 && r.j.code === 'duplicate' && r.j.duplicates[0]?.productId === created.productId, JSON.stringify(r.j).slice(0, 140));
    r = await call('POST', PATH, 'ignacio', card({ name: 'CZTEST Otro Nombre', newEdition: undefined, groupId: row.groupId }));
    ok('mismo número de colección con otro nombre también avisa', r.status === 409 && r.j.code === 'duplicate');
    r = await call('POST', PATH, 'ignacio', card({ newEdition: undefined, groupId: row.groupId, allowDuplicate: true }));
    ok('con confirmación se permite igual', r.status === 200 && r.j.card.productId !== created.productId);
    const second = r.j.card;
    ok('una edición escrita igual no se duplica', (await prisma.tcgGroup.count({ where: { name: EDITION, categoryId: 99 } })) === 1);

    // Buscar duplicadas en todo el catálogo
    r = await call('GET', PATH + '?all=1&q=a', 'ignacio');
    ok('buscar en todo el catálogo pide al menos 2 letras', r.status === 400);
    r = await call('GET', PATH + '?all=1&q=dragon manual', 'ignacio');
    ok('la búsqueda total encuentra las manuales y dice de dónde vienen', r.status === 200 && r.j.cards.length >= 2 && r.j.cards.every((item) => item.source === 'carpetazo'));
    const fromMazos = await prisma.tcgProduct.findFirst({ where: { categoryId: 99, NOT: { productId: { startsWith: 'manual-' } } }, select: { name: true } });
    if (fromMazos) {
      r = await call('GET', PATH + '?all=1&q=' + encodeURIComponent(fromMazos.name), 'ignacio');
      ok('una carta del barrido sale marcada como de mazos', r.status === 200 && r.j.cards.some((item) => item.source === 'mazos'));
    }
    ok('una cuenta normal no puede buscar', (await call('GET', PATH + '?all=1&q=dragon', 'seller')).status === 403);

    // Lista y edición
    r = await call('GET', PATH + '?q=dragon manual', 'ignacio');
    ok('la lista trae solo cartas manuales, las más nuevas primero', r.status === 200 && r.j.total >= 2 && r.j.cards.every((item) => item.productId.startsWith('manual-')) && r.j.cards[0].productId === second.productId);
    ok('la lista devuelve todos los campos para editarlos', r.j.cards[1].type === 'ALIADO' && r.j.cards[1].races.length === 2 && r.j.cards[1].effect.includes('roba una carta') && r.j.cards[1].edition === EDITION);
    r = await call('PUT', `${PATH}/${created.productId}`, 'ignacio', card({ name: 'CZTEST Dragón Corregido', newEdition: undefined, groupId: row.groupId, newProduct: undefined, cost: '4', frequency: 'LEGENDARIA', number: 'CZT-001-101', effect: 'Efecto nuevo.' }));
    ok('editar una carta manual → 200', r.status === 200 && r.j.card.productId === created.productId && r.j.card.name === 'CZTEST Dragón Corregido' && r.j.card.cost === '4' && r.j.card.effect === 'Efecto nuevo.', JSON.stringify(r.j).slice(0, 160));
    ok('editar deja registro de auditoría', (await prisma.moderationAudit.count({ where: { action: 'myl.card.update', targetId: created.productId } })) === 1);
    r = await call('PUT', `${PATH}/${created.productId}`, 'seller', card());
    ok('una cuenta normal no puede editar', r.status === 403);
    r = await call('PUT', `${PATH}/12345`, 'ignacio', card());
    ok('una carta que no es manual no se puede editar → 404', r.status === 404);
    const other = await prisma.tcgProduct.findFirst({ where: { categoryId: 99, NOT: { productId: { startsWith: 'manual-' } } }, select: { productId: true, name: true } });
    if (other) {
      r = await call('PUT', `${PATH}/${other.productId}`, 'admin', card());
      ok('ni un administrador edita las cartas del barrido por aquí', r.status === 404);
      ok('y esa carta quedó igual', (await prisma.tcgProduct.findUnique({ where: { productId: other.productId } })).name === other.name);
    }

    // El barrido de las 2 am
    const run = await prisma.catalogSyncRun.create({ data: { status: 'running', source: 'myl' } });
    r = await call('POST', PATH, 'ignacio', card({ name: 'CZTEST Durante Barrido', number: 'CZT-777' }));
    ok('mientras el barrido corre no se escribe → 409', r.status === 409 && r.j.code === 'sync_running');
    await prisma.catalogSyncRun.delete({ where: { id: run.id } });
    r = await call('POST', PATH, 'ignacio', card({ name: 'CZTEST Después Barrido', number: 'CZT-778' }));
    ok('al terminar, se vuelve a poder', r.status === 200);

    // Nadie borra
    ok('no existe ninguna ruta para borrar', (await call('DELETE', `${PATH}/${created.productId}`, 'admin')).status === 404);
    ok('la carta sigue ahí', Boolean(await prisma.tcgProduct.findUnique({ where: { productId: created.productId } })));
  } catch (error) {
    ok('las cartas manuales no lanzaron errores inesperados', false, error.stack);
  } finally {
    const manual = await prisma.tcgProduct.findMany({ where: { productId: { startsWith: 'manual-' }, name: { startsWith: 'CZTEST' } }, select: { productId: true } });
    const ids = manual.map((item) => item.productId);
    await prisma.moderationAudit.deleteMany({ where: { targetId: { in: ids } } });
    await prisma.tcgProductPhysicalProduct.deleteMany({ where: { productId: { in: ids } } });
    await prisma.tcgProduct.deleteMany({ where: { productId: { in: ids } } });
    await prisma.tcgPhysicalProduct.deleteMany({ where: { name: { startsWith: 'CZTEST' }, categoryId: 99 } });
    await prisma.tcgGroup.deleteMany({ where: { name: { startsWith: 'CZTEST' }, categoryId: 99 } });
    if (createdBlock) await prisma.tcgBlock.delete({ where: { id: createdBlock.id } }).catch(() => {});
    if (createdCategory) await prisma.tcgCategory.delete({ where: { categoryId: 99 } }).catch(() => {});
    await prisma.$disconnect();
  }
})();
