const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function visualize() {
    const totalGroups = await prisma.tcgGroup.count({ where: { blockId: 2 } });
    const totalCards = await prisma.tcgProduct.count({ where: { group: { blockId: 2 } } });
    
    const allCards = await prisma.tcgProduct.findMany({
        where: { group: { blockId: 2 } },
        select: { cleanName: true }
    });
    
    const counts = {};
    for (const c of allCards) {
        if (c.cleanName) counts[c.cleanName] = (counts[c.cleanName] || 0) + 1;
    }
    
    const multiVariants = Object.entries(counts).filter(([k,v]) => v > 2).slice(0, 3).map(e => e[0]);
    
    let md = `# Estructura de Base de Datos (Primer Bloque)\n\n`;
    md += `El bloque ahora se divide dinámicamente en **${totalGroups}** grupos (ediciones/promos) que contienen un total de **${totalCards}** variantes en este momento (la inyección ya casi termina).\n\n`;
    md += `## ¿Cómo funcionan las variantes ahora?\n`;
    md += `A diferencia de antes (que estaban regadas y separadas), ahora Carpetazo sabe que todas las cartas que comparten el mismo **nombre** son la misma carta pero con diferente ilustración/edición.\n\n`;
    md += `### Ejemplos en tu Base de Datos Real:\n`;
    
    for (const name of multiVariants) {
        const variants = await prisma.tcgProduct.findMany({
            where: { cleanName: name, categoryId: 99 },
            select: { productId: true, name: true, imageUrl: true, group: { select: { name: true } } }
        });
        
        if (variants.length > 0) {
            md += `\n**Carta:** \`${variants[0].name}\` (Tiene ${variants.length} variantes conectadas)\n`;
            for (const v of variants) {
                md += `- **ID:** ${v.productId} | **Edición:** ${v.group?.name || 'Desconocida'}\n`;
                md += `  *Ruta VPS:* \`${v.imageUrl}\`\n`;
            }
        }
    }
    
    fs.writeFileSync('C:\\Users\\Jeffry\\.gemini\\antigravity\\brain\\ce895985-b7a2-4454-b577-6aea33cc67c0\\estructura.md', md, 'utf8');
}

visualize().catch(console.error).finally(() => prisma.$disconnect());
