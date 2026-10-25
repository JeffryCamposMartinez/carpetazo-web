// Sincroniza Mitos y Leyendas con mazos.cl: lo que CarpetazoUpdate hace a mano, pero sin pasar por el disco.
// Por defecto SIMULA (no escribe nada, ni en R2 ni en la base) y cuenta qué haría. Con --apply sube las cartas nuevas y sus imágenes,
// y completa los datos o imágenes que les faltan a las que ya están; lo que mazos.cl corrigió se cuenta aparte (no se aplica) y no borra nada.
// Corre en producción como tarea programada de Coolify, dentro del contenedor del backend:
//   node scripts/catalog/sync_myl.cjs --apply
//   --only=imperio,primer-bloque   solo esos bloques (clave de mazos.cl: primer-bloque, furia-extendido, primera-era, imperio)
//   --image-cap=3000               tope de imágenes por corrida (el resto sigue la próxima noche)
//   --max-minutes=50               tiempo máximo; al cumplirse termina limpio y sigue la próxima noche
//   --limit-products=5             solo los primeros N productos de cada bloque y sin catálogo (para pruebas)
//   --report=informe.json          guarda el resultado completo
// MYL_SYNC_ENABLED=0 apaga la tarea sin tocar Coolify.
const fs = require('fs');

const args = process.argv.slice(2);
const opt = (name) => { const hit = args.find((arg) => arg.startsWith(`--${name}=`)); return hit ? hit.slice(name.length + 3) : undefined; };
const number = (value, fallback) => (Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback);

(async () => {
  if (process.env.MYL_SYNC_ENABLED === '0') { console.log('Sincronización de Mitos y Leyendas desactivada (MYL_SYNC_ENABLED=0).'); return 0; }
  await import('../../core/env.js');
  const { runMylSync } = await import('../../core/mylSync/sync.js');
  const { prisma } = await import('../../core/db.js');
  try {
    const apply = args.includes('--apply');
    if (!apply) console.log('SIMULACIÓN (no se escribe nada). Agrega --apply para subir las cartas nuevas.');
    const result = await runMylSync({
      dryRun: !apply,
      only: opt('only') ? opt('only').split(',') : null,
      limitProducts: number(opt('limit-products'), 0),
      imageCap: number(opt('image-cap') ?? process.env.MYL_SYNC_IMAGE_CAP, 3000),
      maxMinutes: number(opt('max-minutes') ?? process.env.MYL_SYNC_MAX_MINUTES, 50),
    });
    if (opt('report')) fs.writeFileSync(opt('report'), JSON.stringify(result, null, 1));
    return result.status === 'failed' ? 1 : 0;
  } finally {
    await prisma.$disconnect();
  }
})().then((code) => process.exit(code ?? 0)).catch((error) => { console.error('ERROR:', error.message); process.exit(1); });
