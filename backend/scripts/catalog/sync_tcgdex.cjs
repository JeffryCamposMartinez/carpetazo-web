// Cartas Pokémon en español desde TCGdex (https://tcgdex.dev/es) al catálogo y R2, como juego aparte «Pokémon (Español)».
// Tarea programada de Coolify, dentro del contenedor del backend:
//   node scripts/catalog/sync_tcgdex.cjs
// Solo agrega las cartas que faltan (con imagen en español); lo que ya existe no se toca.
//   --dry-run          no escribe nada (ni R2 ni la base): cuenta qué haría
//   --image-cap=20000  tope de imágenes por corrida
//   --max-minutes=55   tiempo máximo; al cumplirse termina limpio y lo que falte entra en la próxima corrida
//   --limit-sets=3     solo las primeras N ediciones (para pruebas)
const args = process.argv.slice(2);
const opt = (name) => { const hit = args.find((arg) => arg.startsWith(`--${name}=`)); return hit ? hit.slice(name.length + 3) : undefined; };
const number = (value, fallback) => (Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback);

(async () => {
  await import('../../core/env.js');
  const { runTcgdexSync } = await import('../../core/tcgSync/tcgdex.js');
  const { prisma } = await import('../../core/db.js');
  try {
    const result = await runTcgdexSync({
      dryRun: args.includes('--dry-run'),
      imageCap: number(opt('image-cap'), 20000),
      maxMinutes: number(opt('max-minutes'), 55),
      limitSets: number(opt('limit-sets'), 0),
    });
    return result.status === 'failed' ? 1 : 0;
  } finally {
    await prisma.$disconnect();
  }
})().then((code) => process.exit(code), (error) => { console.error('La corrida de TCGdex falló:', error.message); process.exit(1); });
