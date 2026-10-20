// Sincroniza el catálogo de TCGplayer (TCGCSV) con la base y R2: lo que TcgplayerUpdate hace a mano, pero sin pasar por el disco.
// Corre en producción como tarea programada de Coolify (todos los días a las 00:00), dentro del contenedor del backend:
//   node scripts/catalog/sync_tcgcsv.cjs
// Solo agrega cartas y productos que faltan; lo que ya existe no se toca (las correcciones de TCGplayer quedan en CatalogChange).
//   --dry-run          no escribe nada (ni R2 ni la base): cuenta qué haría
//   --only=3,71        solo esos juegos (categoryId de TCGCSV)
//   --image-cap=800    tope de imágenes por corrida (el resto sigue la próxima noche)
//   --max-minutes=50   tiempo máximo; al cumplirse termina limpio y sigue la próxima noche
//   --limit-sets=5     solo las primeras N ediciones de cada juego (para pruebas)
// TCG_SYNC_ENABLED=0 apaga la tarea sin tocar Coolify. TCG_SYNC_IMAGE_CAP y TCG_SYNC_MAX_MINUTES cambian los topes por defecto.
const args = process.argv.slice(2);
const opt = (name) => { const hit = args.find((arg) => arg.startsWith(`--${name}=`)); return hit ? hit.slice(name.length + 3) : undefined; };
const number = (value, fallback) => (Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback);

(async () => {
  if (process.env.TCG_SYNC_ENABLED === '0') { console.log('Sincronización de catálogo desactivada (TCG_SYNC_ENABLED=0).'); return 0; }
  await import('../../core/env.js');
  const { runSync, DEFAULT_CATEGORIES } = await import('../../core/tcgSync/sync.js');
  const { prisma } = await import('../../core/db.js');
  try {
    const only = opt('only');
    const result = await runSync({
      dryRun: args.includes('--dry-run'),
      categories: only ? only.split(',').map(Number).filter(Number.isInteger) : DEFAULT_CATEGORIES,
      imageCap: number(opt('image-cap') ?? process.env.TCG_SYNC_IMAGE_CAP, 800),
      maxMinutes: number(opt('max-minutes') ?? process.env.TCG_SYNC_MAX_MINUTES, 50),
      limitSets: number(opt('limit-sets'), 0),
    });
    return result.status === 'failed' ? 1 : 0;
  } finally {
    await prisma.$disconnect();
  }
})().then((code) => process.exit(code), (error) => { console.error('La sincronización falló:', error.message); process.exit(1); });
