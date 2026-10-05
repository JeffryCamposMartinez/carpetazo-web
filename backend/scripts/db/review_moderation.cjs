// Moderación de reseñas: lista las reportadas (visibles u ocultas) y las que no cuentan por venir de la misma conexión; permite aprobarlas o borrarlas.
// Uso:  node scripts/db/review_moderation.cjs list
//       node scripts/db/review_moderation.cjs approve <id>   (vuelve a contar y se muestra; se borran sus reportes)
//       node scripts/db/review_moderation.cjs remove <id>    (borra la reseña; el comprador podrá volver a calificar ese vendedor)
// Usa DATABASE_URL del entorno (backend/.env). Revisa a qué base apunta antes de aprobar o borrar.
const path = require('path');
const { PrismaClient } = require('@prisma/client');

try {
  require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });
} catch (_) {
  // dotenv es opcional si el entorno ya está cargado
}

const prisma = new PrismaClient();
const [command, id] = process.argv.slice(2);

(async () => {
  if (command === 'list') {
    const rows = await prisma.sellerReview.findMany({
      where: { OR: [{ counts: false }, { flag: 'reported' }] },
      orderBy: { createdAt: 'desc' },
      include: {
        seller: { select: { username: true } },
        reviewer: { select: { username: true } },
        reports: { select: { reason: true, createdAt: true } },
      },
    });
    if (rows.length === 0) console.log('No hay reseñas pendientes de revisión.');
    for (const r of rows) {
      console.log(`\n${r.id}  [${r.flag}${r.counts ? ', visible' : ', oculta'}]  ${r.rating}★  vendedor=@${r.seller?.username}  comprador=@${r.reviewer?.username}  ${r.createdAt.toISOString().slice(0, 10)}`);
      if (r.comment) console.log(`  "${r.comment}"`);
      r.reports.forEach((rep) => console.log(`  reporte: ${rep.reason || '(sin motivo)'}`));
    }
  } else if (command === 'approve' && id) {
    await prisma.$transaction([
      prisma.reviewReport.deleteMany({ where: { reviewId: id } }),
      prisma.sellerReview.update({ where: { id }, data: { counts: true, flag: null } }),
    ]);
    console.log('Reseña aprobada: vuelve a mostrarse y contar.');
  } else if (command === 'remove' && id) {
    await prisma.sellerReview.delete({ where: { id } });
    console.log('Reseña borrada.');
  } else {
    console.log('Uso: node scripts/db/review_moderation.cjs list | approve <id> | remove <id>');
  }
})()
  .catch((error) => { console.error('Error:', error.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
