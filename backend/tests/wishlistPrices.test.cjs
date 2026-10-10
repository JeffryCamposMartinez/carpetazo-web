// Lista de deseos: el precio más bajo publicado de cada carta (aunque supere el precio máximo) y las ofertas dentro del precio máximo.
const { prisma, call, ok } = require('./fixtures.cjs');

const TCG_ID = '980000501';

(async () => {
  try {
    // Dos vendedores publican la misma carta de Pokémon a distinto precio, y una tercera copia a un precio caro en una carpeta privada
    const publicA = (await call('POST', '/folders', 'seller', { name: 'TEST precios A', tcg: 'Pokemon', color: 'blue', isPublic: true })).j.folder;
    const publicB = (await call('POST', '/folders', 'jerry', { name: 'TEST precios B', tcg: 'Pokemon', color: 'blue', isPublic: true })).j.folder;
    const privateC = (await call('POST', '/folders', 'ignacio', { name: 'TEST precios C', tcg: 'Pokemon', color: 'blue', isPublic: false })).j.folder;
    await call('POST', '/folders/' + publicA.id + '/cards', 'seller', { tcgId: TCG_ID, name: 'CZTEST carta precio', price: 3000, stock: 2 });
    await call('POST', '/folders/' + publicB.id + '/cards', 'jerry', { tcgId: TCG_ID, name: 'CZTEST carta precio', price: 1800, stock: 1 });
    await call('POST', '/folders/' + privateC.id + '/cards', 'ignacio', { tcgId: TCG_ID, name: 'CZTEST carta precio', price: 100, stock: 1 });

    const added = await call('POST', '/wishlist', 'ale', { external: { categoryId: 3, productId: TCG_ID }, name: 'CZTEST carta precio' });
    const itemId = added.j?.item?.id;
    ok('se agregó la carta a la lista', added.status === 200 && itemId, String(added.status));
    const lonely = await call('POST', '/wishlist', 'ale', { external: { categoryId: 3, productId: '980000502' }, name: 'CZTEST carta sin publicar' });

    let r = await call('GET', '/wishlist/matches', 'ale');
    ok('devuelve el precio más bajo publicado (carpeta pública, sin contar la privada)', r.status === 200 && r.j.prices?.[itemId]?.lowest === 1800 && r.j.prices[itemId].total === 2, JSON.stringify(r.j?.prices));
    ok('indica la publicación más barata para abrirla', typeof r.j.prices?.[itemId]?.cardId === 'string');
    ok('sin precio máximo, las ofertas ordenadas de menor a mayor', r.j.matches?.[itemId]?.offers?.map((offer) => offer.price).join() === '1800,3000', JSON.stringify(r.j?.matches?.[itemId]?.offers?.map((offer) => offer.price)));
    ok('una carta que nadie publica no trae precio', !(lonely.j?.item?.id in (r.j.prices || {})));

    // Con un precio máximo menor al más barato: no hay ofertas dentro del máximo, pero el precio más bajo se sigue mostrando
    await call('PUT', '/wishlist/' + itemId, 'ale', { maxPrice: 1000 });
    r = await call('GET', '/wishlist/matches', 'ale');
    ok('con precio máximo bajo no hay ofertas pero sí precio publicado', !(itemId in (r.j.matches || {})) && r.j.prices?.[itemId]?.lowest === 1800, JSON.stringify(r.j));
    ok('la respuesta no trae datos privados de los vendedores', !JSON.stringify(r.j).match(/firebaseUid|email|"rut"/i));

    // El vendedor no se ve a sí mismo como oferta
    const own = await call('GET', '/wishlist/matches', 'seller');
    ok('quien publica no recibe sus propias cartas como precio', Object.keys(own.j.prices || {}).length === 0);
  } catch (error) {
    ok('la prueba terminó sin excepciones', false, error.message);
  } finally {
    await prisma.folder.deleteMany({ where: { name: { startsWith: 'TEST precios' } } }).catch(() => {});
    await prisma.$disconnect();
  }
})();
