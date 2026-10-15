// Varias listas de deseos: una sola activa (la del perfil), cada carta en su lista, propiedad y límites.
const { prisma, NAMES, call, ok } = require('./fixtures.cjs');

const card = (id, name) => ({ external: { categoryId: 3, productId: id }, name });

(async () => {
  try {
    await prisma.wishlist.deleteMany({ where: { user: { username: NAMES.ale } } }); // otras pruebas también usan a esta persona
    // La primera consulta crea la lista inicial, activa
    let r = await call('GET', '/wishlist/me', 'ale');
    const first = r.j?.lists?.[0];
    ok('al entrar hay una lista inicial y está activa', r.status === 200 && r.j.lists.length === 1 && first.isActive === true && first.count === 0 && r.j.maxLists === 10, JSON.stringify(r.j?.lists));

    // Sin indicar lista, la carta va a la activa
    r = await call('POST', '/wishlist', 'ale', card('980000701', 'CZTEST lista A'));
    ok('sin indicar lista, la carta entra a la activa', r.status === 200 && r.j.item.wishlistId === first.id, JSON.stringify(r.j));

    // Crear otra lista: no es activa
    r = await call('POST', '/wishlists', 'ale', { name: '  Para el torneo  ' });
    const second = r.j?.list;
    ok('crear lista → inactiva y con el nombre sin espacios sobrantes', r.status === 200 && second.isActive === false && second.name === 'Para el torneo' && second.count === 0, JSON.stringify(r.j));
    r = await call('POST', '/wishlists', 'ale', { name: '' });
    ok('nombre vacío → 400', r.status === 400, String(r.status));
    r = await call('POST', '/wishlists', 'ale', { name: 'x'.repeat(41) });
    ok('nombre de más de 40 caracteres → 400', r.status === 400, String(r.status));

    // Agregar a una lista elegida; la misma carta puede estar en dos listas
    r = await call('POST', '/wishlist', 'ale', { ...card('980000701', 'CZTEST lista A'), wishlistId: second.id });
    ok('la misma carta puede estar en otra lista (no se suma a la primera)', r.status === 200 && r.j.item.wishlistId === second.id && r.j.item.quantity === 1, JSON.stringify(r.j));
    r = await call('GET', '/wishlist/me', 'ale');
    ok('cada lista cuenta sus cartas', r.j.lists.find((list) => list.id === first.id).count === 1 && r.j.lists.find((list) => list.id === second.id).count === 1 && r.j.items.length === 2, JSON.stringify(r.j?.lists));

    // Propiedad: no se puede usar ni tocar la lista de otra persona
    r = await call('POST', '/wishlist', 'jerry', { ...card('980000702', 'CZTEST ajena'), wishlistId: second.id });
    ok('agregar a la lista de otra persona → 404', r.status === 404, String(r.status));
    r = await call('PUT', '/wishlists/' + second.id, 'jerry', { isActive: true });
    ok('activar la lista de otra persona → 404', r.status === 404, String(r.status));
    r = await call('DELETE', '/wishlists/' + second.id, 'jerry');
    ok('borrar la lista de otra persona → 404', r.status === 404, String(r.status));
    r = await call('POST', '/wishlist', 'ale', { ...card('980000702', 'CZTEST lista id inválido'), wishlistId: 123 });
    ok('lista con tipo inválido → 400', r.status === 400, String(r.status));

    // El perfil público muestra solo la lista activa
    r = await call('GET', '/users/' + NAMES.ale + '/wishlist');
    ok('el perfil muestra la lista activa (1 carta)', r.status === 200 && r.j.total === 1 && r.j.items.length === 1, JSON.stringify(r.j));
    await call('POST', '/wishlist', 'ale', { ...card('980000703', 'CZTEST solo en la segunda'), wishlistId: second.id });
    r = await call('GET', '/users/' + NAMES.ale + '/wishlist');
    ok('las cartas de otra lista no aparecen en el perfil', r.j.total === 1 && !r.j.items.some((item) => /segunda/.test(item.name)), JSON.stringify(r.j?.items?.map((item) => item.name)));

    // Cambiar la activa: la anterior deja de serlo y el perfil cambia
    r = await call('PUT', '/wishlists/' + second.id, 'ale', { isActive: true });
    ok('activar otra lista → solo una activa', r.status === 200 && r.j.lists.filter((list) => list.isActive).length === 1 && r.j.lists.find((list) => list.id === second.id).isActive, JSON.stringify(r.j?.lists));
    r = await call('GET', '/users/' + NAMES.ale + '/wishlist');
    ok('el perfil pasa a mostrar la nueva lista activa (2 cartas)', r.j.total === 2, JSON.stringify(r.j?.total));
    r = await call('PUT', '/wishlists/' + first.id, 'ale', { isActive: false });
    ok('no se puede "desactivar" a mano → 400', r.status === 400, String(r.status));
    r = await call('PUT', '/wishlists/' + first.id, 'ale', { name: 'Renombrada' });
    ok('renombrar no cambia cuál es la activa', r.status === 200 && r.j.lists.find((list) => list.id === first.id).name === 'Renombrada' && r.j.lists.find((list) => list.id === second.id).isActive, JSON.stringify(r.j?.lists));
    r = await call('PUT', '/wishlists/' + first.id, 'ale', {});
    ok('sin cambios → 400', r.status === 400, String(r.status));

    // Borrar: si era la activa, pasa a serlo la más antigua; nunca queda sin listas
    r = await call('DELETE', '/wishlists/' + second.id, 'ale');
    ok('borrar la activa → la otra queda activa', r.status === 200 && r.j.lists.length === 1 && r.j.lists[0].id === first.id && r.j.lists[0].isActive === true, JSON.stringify(r.j?.lists));
    r = await call('GET', '/wishlist/me', 'ale');
    ok('sus cartas se borran con la lista', r.j.items.every((item) => item.wishlistId === first.id), JSON.stringify(r.j?.items?.length));
    r = await call('DELETE', '/wishlists/' + first.id, 'ale');
    ok('no se puede borrar la única lista → 400', r.status === 400, String(r.status));

    // Máximo de listas
    for (let i = 2; i <= 10; i++) await call('POST', '/wishlists', 'ale', { name: 'Lista ' + i });
    r = await call('POST', '/wishlists', 'ale', { name: 'Lista 11' });
    ok('más de 10 listas → 400', r.status === 400, String(r.status));

    // La lista oculta por la persona sigue sin mostrarse aunque tenga lista activa
    r = await call('GET', '/users/' + NAMES.ale + '/wishlist');
    ok('la respuesta pública no trae ids de listas ni datos privados', r.status === 200 && !JSON.stringify(r.j).match(/wishlistId|userId|firebaseUid|email/i), JSON.stringify(r.j).slice(0, 200));
  } catch (error) {
    ok('la prueba terminó sin excepciones', false, error.message);
  } finally {
    await prisma.wishlist.deleteMany({ where: { user: { username: NAMES.ale } } }).catch(() => {});
    await prisma.$disconnect();
  }
})();
