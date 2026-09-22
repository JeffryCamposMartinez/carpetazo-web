const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const baseDir = "C:\\Users\\Jeffry\\Desktop\\CarpetazoUpdater\\Primer_Bloque_DB\\Primer_Bloque_Data";

async function update() {
    console.log("Actualizando las URLs de imágenes a Cloudflare R2...");
    const products = fs.readdirSync(baseDir);
    let updatedTcg = 0;
    
    // Obtenemos todos los tcgIds para optimizar
    for (const prodName of products) {
        const prodPath = path.join(baseDir, prodName);
        if (fs.statSync(prodPath).isDirectory()) {
            const cards = fs.readdirSync(prodPath);
            for (const cardName of cards) {
                const cardPath = path.join(prodPath, cardName);
                if (fs.statSync(cardPath).isDirectory()) {
                    const jsonPath = path.join(cardPath, 'data.json');
                    if (fs.existsSync(jsonPath)) {
                        try {
                            const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
                            const imgName = `${cardName}.webp`;
                            const newUrl = `https://imagenes.carpetazo.cl/Carpetazo.cl/Mitos_y_Leyendas/Primer_Bloque_Images/${encodeURIComponent(prodName)}/${encodeURIComponent(cardName)}/${encodeURIComponent(imgName)}`;
                            
                            // 1. Actualizar catálogo maestro (tcgProduct)
                            await prisma.tcgProduct.updateMany({
                                where: { productId: data.id },
                                data: { imageUrl: newUrl }
                            });
                            
                            // 2. Actualizar las cartas en las colecciones de los usuarios (Card)
                            await prisma.card.updateMany({
                                where: { tcgId: String(data.id) },
                                data: { imageUrl: newUrl }
                            });
                            
                            updatedTcg++;
                            if (updatedTcg % 500 === 0) console.log(`Procesadas ${updatedTcg} cartas...`);
                        } catch(e) {
                            console.error("Error procesando:", cardPath, e.message);
                        }
                    }
                }
            }
        }
    }
    console.log("¡Actualización completa! Cartas procesadas:", updatedTcg);
}

update().catch(console.error).finally(() => prisma.$disconnect());
