const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const updates = [
    { old: '12AN Fruto Sagrado MazosCL.webp', new: 'Fruto Sagrado Promocional' },
    { old: '12AN Oraculo MazosCL.webp', new: 'Oráculo Promocional' },
    { old: 'ANIVERSARIO_25 Oro Aniversario MazosCL V.webp', new: 'Oro 25 Aniversario' },
    { old: 'AniversarioES', new: 'Aniversario Espada Sagrada' },
    { old: 'AniversarioHD', new: 'Aniversario Hijos de Daana' },
    { old: 'AniversarioHE', new: 'Aniversario Helénica' },
    { old: 'AniversarioRA', new: 'Aniversario Dominios de Ra' },
    { old: 'Buy a Box: Relatos de Helénica (3 cajas)', new: 'Buy a Box: Relatos de Helénica' }
  ];

  for (const u of updates) {
    await prisma.tcgPhysicalProduct.updateMany({
      where: { name: u.old },
      data: { name: u.new }
    });
  }
  
  // also delete duplicate/weird display products if any?
  // Let's just rename 'Display de sobres Aniversario: Dominios de RA' -> it's basically the same
  await prisma.tcgPhysicalProduct.updateMany({
    where: { name: 'Display de sobres Aniversario: Dominios de RA' },
    data: { name: 'Display de Sobres Aniversario: Dominios de RA' } // capitalize S
  });

  console.log("Renamed weird products");
}
run().finally(() => prisma.$disconnect());
