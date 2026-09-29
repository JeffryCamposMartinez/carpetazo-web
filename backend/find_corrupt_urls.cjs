const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();
const path = require('path');

async function main() {
    const cards = await prisma.tcgProduct.findMany({
        where: { categoryId: 99 }
    });
    console.log('Total Mitos y Leyendas cards in DB:', cards.length);
    
    let corrupt = [];
    const localBase = 'C:\\Users\\Jeffry\\Desktop\\CarpetazoUpdater\\Descargas\\Mitos_y_Leyendas\\';
    
    for (const card of cards) {
        if (!card.imageUrl) {
            corrupt.push({ id: card.id, name: card.name, issue: 'No imageUrl' });
            continue;
        }
        
        let relativePath = '';
        if (card.imageUrl.includes('/Mitos_y_Leyendas/')) {
            relativePath = card.imageUrl.split('/Mitos_y_Leyendas/')[1];
        } else {
            corrupt.push({ id: card.id, name: card.name, issue: 'Does not contain /Mitos_y_Leyendas/', url: card.imageUrl });
            continue;
        }
        
        // Decode URL components
        relativePath = decodeURIComponent(relativePath);
        
        const localPath = path.join(localBase, relativePath.replace(/\//g, '\\'));
        if (!fs.existsSync(localPath)) {
            corrupt.push({ id: card.id, name: card.name, issue: 'File does not exist locally', url: card.imageUrl, localPath });
        }
    }
    
    console.log('Corrupt URLs count:', corrupt.length);
    if (corrupt.length > 0) {
        fs.writeFileSync('corrupt_urls.json', JSON.stringify(corrupt, null, 2));
        console.log('Saved to corrupt_urls.json');
    }
}
main().catch(console.error).finally(() => prisma.$disconnect());
