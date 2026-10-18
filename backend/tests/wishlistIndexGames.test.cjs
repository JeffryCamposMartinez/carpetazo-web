// Deseadas desde el catálogo local: el índice nombra los juegos con claves técnicas (Pokemon_Japan, One_Piece) y deben aceptarse.
const { prisma, NAMES, call, ok } = require('./fixtures.cjs');

const fromIndex = (categoryId, productId, game) => ({ external: { categoryId, productId }, productId, name: 'CZTEST ' + game, imageUrl: null, detail: 'Edición de prueba', game });

(async () => {
  try {
    await prisma.wishlist.deleteMany({ where: { user: { username: NAMES.jerry } } });
    let r = await call('POST', '/wishlist', 'jerry', fromIndex(85, '980000801', 'Pokemon_Japan'));
    ok('una carta japonesa del índice (Pokemon_Japan) se agrega → 200', r.status === 200, JSON.stringify(r.j));
    ok('...y se guarda como Pokémon', r.j?.item?.game === 'Pokémon', JSON.stringify(r.j?.item?.game));
    r = await call('POST', '/wishlist', 'jerry', fromIndex(68, '980000802', 'One_Piece'));
    ok('una carta de One Piece del índice (One_Piece) se agrega → 200', r.status === 200, JSON.stringify(r.j));
    ok('...y se guarda como One Piece', r.j?.item?.game === 'One Piece', JSON.stringify(r.j?.item?.game));
    r = await call('POST', '/wishlist', 'jerry', fromIndex(3, '980000803', 'Pokemon'));
    ok('Pokemon sin tilde sigue aceptándose', r.status === 200 && r.j?.item?.game === 'Pokémon', JSON.stringify(r.j));
    r = await call('POST', '/wishlist', 'jerry', fromIndex(3, '980000804', 'Juego_Inventado'));
    ok('un juego que no existe sigue rechazándose → 400', r.status === 400, String(r.status));
    await prisma.wishlist.deleteMany({ where: { user: { username: NAMES.jerry } } });
  } finally {
    await prisma.$disconnect();
  }
})();
